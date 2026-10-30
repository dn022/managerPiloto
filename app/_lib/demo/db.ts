import fs from "node:fs";
import path from "node:path";
import "server-only";

import { seedDemo } from "./seed";
import { STUBS_SQL } from "./stubs";

// Modo demo: Postgres embutido (PGlite) com as migrations reais, RLS ativo e dados de exemplo.
// Nada sai da máquina e nada é persistido: reiniciar o servidor recria os dados.
export const DEMO = process.env.DEMO_MODE === "1";

type Db = import("@electric-sql/pglite").PGlite;

const g = globalThis as unknown as { __demoDb?: Promise<Db>; __demoQueue?: Promise<unknown> };

async function init(): Promise<Db> {
  const { PGlite } = await import("@electric-sql/pglite");
  const db = new PGlite();
  await db.exec(STUBS_SQL);
  const dir = path.join(process.cwd(), "supabase", "migrations");
  for (const f of fs.readdirSync(dir).filter((n) => n.endsWith(".sql")).sort()) {
    await db.exec(fs.readFileSync(path.join(dir, f), "utf8"));
  }
  await seedDemo(db);
  return db;
}

export function getDb() {
  // Se a inicialização falhar, a próxima chamada tenta de novo.
  return (g.__demoDb ??= init().catch((e) => {
    g.__demoDb = undefined;
    throw e;
  }));
}

// Consultas são serializadas: o role/claim de cada uma é definido na mesma conexão.
function enqueue<T>(job: () => Promise<T>): Promise<T> {
  const next = (g.__demoQueue ?? Promise.resolve()).then(job, job);
  g.__demoQueue = next.catch(() => undefined);
  return next;
}

// Executa como o usuário (role authenticated + claim sub), ou anon se uid for nulo: RLS vale.
export function queryAs<T = Record<string, unknown>>(uid: string | null, sql: string, params: unknown[] = []) {
  return enqueue(async () => {
    const db = await getDb();
    await db.exec("reset role");
    await db.query("select set_config('request.jwt.claim.sub', $1, false)", [uid ?? ""]);
    await db.exec(uid ? "set role authenticated" : "set role anon");
    try {
      return (await db.query<T>(sql, params)).rows;
    } finally {
      await db.exec("reset role");
    }
  });
}

// Sem RLS (equivalente ao service role): só para o que o Auth do Supabase faria.
export function queryAdmin<T = Record<string, unknown>>(sql: string, params: unknown[] = []) {
  return enqueue(async () => {
    const db = await getDb();
    await db.exec("reset role");
    return (await db.query<T>(sql, params)).rows;
  });
}

// Arquivos enviados no modo demo (logo) ficam em memória.
type Asset = { bytes: Uint8Array; type: string };
export const demoAssets = ((globalThis as unknown as { __demoAssets?: Map<string, Asset> }).__demoAssets ??=
  new Map<string, Asset>());
