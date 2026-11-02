// Harness compartilhado: Postgres embutido (PGlite) + stub do que o Supabase fornece.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { STUBS_SQL } from "../../app/_lib/demo/stubs.ts";

const dir = path.dirname(fileURLToPath(import.meta.url));
const migrationsDir = path.join(dir, "..", "migrations");

export async function createDb() {
  const db = new PGlite();

  await db.exec(STUBS_SQL);

  for (const f of fs.readdirSync(migrationsDir).filter((n) => n.endsWith(".sql")).sort()) {
    await db.exec(fs.readFileSync(path.join(migrationsDir, f), "utf8"));
  }

  let failures = 0;

  function check(name, ok, extra = "") {
    if (!ok) failures++;
    console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok ? "" : ` ${extra}`}`);
  }

  // Executa uma query como o usuário autenticado (role `authenticated` + claim sub).
  async function as(userId, sql, params = []) {
    await db.exec("reset role");
    await db.exec(`select set_config('request.jwt.claim.sub', '${userId ?? ""}', false)`);
    await db.exec("set role authenticated");
    try {
      return { rows: (await db.query(sql, params)).rows, error: null };
    } catch (e) {
      return { rows: [], error: e.message };
    } finally {
      await db.exec("reset role");
    }
  }

  const user = async (email) =>
    (await db.query("insert into auth.users (email) values ($1) returning id", [email])).rows[0].id;

  function finish() {
    console.log(failures === 0 ? "\nTodos os testes passaram." : `\n${failures} teste(s) falharam.`);
    process.exit(failures === 0 ? 0 : 1);
  }

  return { db, check, as, user, finish };
}
