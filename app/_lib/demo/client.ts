import type { SupabaseClient } from "@supabase/supabase-js";
import "server-only";

import { demoAssets, queryAdmin, queryAs } from "./db";

// Cliente que imita o subconjunto do supabase-js usado pelo app, sobre o Postgres embutido.
// A tradução para SQL é feita aqui (não passa pelo PostgREST); o RLS continua valendo.

export const DEMO_COOKIE = "demo_uid";

type Err = { message: string; code?: string } | null;
type Result = { data: unknown; error: Err };
type Cookies = { get(name: string): { value: string } | undefined; set(name: string, value: string, o?: object): unknown; delete(name: string): unknown };

type Rel = { table: string; cols: string[]; refTable: string; refCols: string[] };
const g = globalThis as unknown as { __demoRels?: Promise<Rel[]>; __demoFns?: Promise<Map<string, { set: boolean; void: boolean }>> };

const q = (id: string) => `"${id.replace(/"/g, '""')}"`;
// Views herdam as relações da tabela base.
const BASE: Record<string, string> = { invoices_with_status: "invoices", class_occupancy: "classes" };

function rels() {
  return (g.__demoRels ??= queryAdmin<{ t: string; r: string; cols: string[]; refcols: string[] }>(`
    select c.conrelid::regclass::text as t, c.confrelid::regclass::text as r,
      (select array_agg(a.attname order by k.ord) from unnest(c.conkey) with ordinality k(n, ord)
        join pg_attribute a on a.attrelid = c.conrelid and a.attnum = k.n) as cols,
      (select array_agg(a.attname order by k.ord) from unnest(c.confkey) with ordinality k(n, ord)
        join pg_attribute a on a.attrelid = c.confrelid and a.attnum = k.n) as refcols
    from pg_constraint c
    where c.contype = 'f' and c.connamespace = 'public'::regnamespace
  `).then((rows) =>
    rows.map((r) => ({
      table: r.t.replace("public.", ""),
      cols: r.cols,
      refTable: r.r.replace("public.", ""),
      refCols: r.refcols,
    }))
  ));
}

function fns() {
  return (g.__demoFns ??= queryAdmin<{ name: string; set: boolean; void: boolean }>(`
    select p.proname as name, p.proretset as set, p.prorettype = 'void'::regtype as void
    from pg_proc p where p.pronamespace = 'public'::regnamespace
  `).then((rows) => new Map(rows.map((r) => [r.name, r]))));
}

function splitTop(spec: string) {
  const out: string[] = [];
  let depth = 0;
  let cur = "";
  for (const ch of spec) {
    if (ch === "(") depth++;
    if (ch === ")") depth--;
    if (ch === "," && depth === 0) {
      out.push(cur.trim());
      cur = "";
    } else cur += ch;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

// "a, b, rel(c, sub(d))" → itens de select; relações viram subconsultas JSON.
function items(parent: string, alias: string, spec: string, all: Rel[], depth = 0, inner?: string[]): string[] {
  const base = BASE[parent] ?? parent;
  return splitTop(spec || "*").map((tok) => {
    const m = tok.match(/^(\w+)(?:!(\w+))?\(([\s\S]*)\)$/);
    if (!m) return tok === "*" ? `${alias}.*` : `${alias}.${q(tok)}`;
    const [, name, hint, sub] = m;
    const e = `e${depth}`;
    const toOne = all.find((r) => r.table === base && r.refTable === name);
    if (toOne) {
      const cond = toOne.cols.map((c, i) => `${e}.${q(toOne.refCols[i])} = ${alias}.${q(c)}`).join(" and ");
      // !inner: só vêm as linhas que têm a relação (join obrigatório)
      if (hint === "inner" && inner) inner.push(`exists (select 1 from public.${q(name)} ${e} where ${cond})`);
      return `(select to_json(x) from (select ${items(name, e, sub, all, depth + 1).join(", ")} from public.${q(name)} ${e} where ${cond} limit 1) x) as ${q(name)}`;
    }
    const toMany = all.find((r) => r.table === name && r.refTable === base);
    if (toMany) {
      const cond = toMany.cols.map((c, i) => `${e}.${q(c)} = ${alias}.${q(toMany.refCols[i])}`).join(" and ");
      return `coalesce((select json_agg(x) from (select ${items(name, e, sub, all, depth + 1).join(", ")} from public.${q(name)} ${e} where ${cond}) x), '[]'::json) as ${q(name)}`;
    }
    throw new Error(`Relação ${name} não encontrada a partir de ${parent}`);
  });
}

type Filter = { col: string; op: string; val: unknown };

class Query implements PromiseLike<Result> {
  private op: "select" | "insert" | "update" | "delete" | "upsert" = "select";
  private cols: string | null = "*";
  private returning = false;
  private filters: Filter[] = [];
  private orders: string[] = [];
  private lim: number | null = null;
  private payload: Record<string, unknown>[] = [];
  private conflict: string | null = null;
  private ignoreDup = false;
  private mode: "many" | "single" | "maybe" = "many";
  private count = false;
  private head = false;

  constructor(private table: string, private uid: string | null) {}

  select(cols = "*", o: { count?: string; head?: boolean } = {}) {
    this.count = !!o.count;
    this.head = o.head ?? false;
    if (this.op === "select") this.cols = cols;
    else {
      this.returning = true;
      this.cols = cols;
    }
    return this;
  }
  insert(v: object | object[]) {
    this.op = "insert";
    this.payload = [v].flat() as Record<string, unknown>[];
    return this;
  }
  upsert(v: object | object[], o: { onConflict?: string; ignoreDuplicates?: boolean } = {}) {
    this.op = "upsert";
    this.payload = [v].flat() as Record<string, unknown>[];
    this.conflict = o.onConflict ?? null;
    this.ignoreDup = o.ignoreDuplicates ?? false;
    return this;
  }
  update(v: object) {
    this.op = "update";
    this.payload = [v as Record<string, unknown>];
    return this;
  }
  delete() {
    this.op = "delete";
    return this;
  }
  private f(op: string) {
    return (col: string, val: unknown) => {
      this.filters.push({ col, op, val });
      return this;
    };
  }
  eq = this.f("=");
  neq = this.f("<>");
  gt = this.f(">");
  gte = this.f(">=");
  lt = this.f("<");
  lte = this.f("<=");
  ilike = this.f("ilike");
  is = this.f("is");
  in = this.f("in");
  order(col: string, o: { ascending?: boolean; nullsFirst?: boolean } = {}) {
    const dir = o.ascending === false ? "desc" : "asc";
    const nulls = o.nullsFirst === undefined ? "" : o.nullsFirst ? " nulls first" : " nulls last";
    this.orders.push(`${q(col)} ${dir}${nulls}`);
    return this;
  }
  limit(n: number) {
    this.lim = n;
    return this;
  }
  single() {
    this.mode = "single";
    return this;
  }
  maybeSingle() {
    this.mode = "maybe";
    return this;
  }

  private where(params: unknown[]) {
    if (!this.filters.length) return "";
    const parts = this.filters.map(({ col, op, val }) => {
      if (op === "is") return `${q(col)} is ${val === null ? "null" : val ? "true" : "false"}`;
      params.push(val);
      return op === "in" ? `${q(col)} = any($${params.length})` : `${q(col)} ${op} $${params.length}`;
    });
    return ` where ${parts.join(" and ")}`;
  }

  private async build() {
    const all = await rels();
    const params: unknown[] = [];
    const t = `public.${q(this.table)}`;
    const wrap = (src: string, tail = "") =>
      `select coalesce(json_agg(t), '[]'::json) as data from (select ${items(this.table, "r", this.cols ?? "*", all).join(", ")} from ${src} r${tail}) t`;

    if (this.op === "select" && this.count) {
      return { sql: `select count(*)::int as n from ${t} r${this.where(params)}`, params };
    }

    if (this.op === "select") {
      const innerConds: string[] = [];
      items(this.table, "r", this.cols ?? "*", all, 0, innerConds);
      let where = this.where(params);
      if (innerConds.length) where += (where ? " and " : " where ") + innerConds.join(" and ");
      const order = this.orders.length ? ` order by ${this.orders.join(", ")}` : "";
      const limit = this.lim !== null ? ` limit ${this.lim}` : "";
      return { sql: wrap(t, where + order + limit), params };
    }

    let stmt: string;
    if (this.op === "delete") {
      stmt = `delete from ${t}${this.where(params)}`;
    } else if (this.op === "update") {
      const entries = Object.entries(this.payload[0]);
      const set = entries.map(([c, v]) => (params.push(enc(v)), `${q(c)} = $${params.length}`)).join(", ");
      stmt = `update ${t} set ${set}${this.where(params)}`;
    } else {
      const colsSet = [...new Set(this.payload.flatMap((row) => Object.keys(row)))];
      const rows = this.payload.map(
        (row) =>
          `(${colsSet.map((c) => (c in row ? (params.push(enc(row[c])), `$${params.length}`) : "default")).join(", ")})`
      );
      stmt = `insert into ${t} (${colsSet.map(q).join(", ")}) values ${rows.join(", ")}`;
      if (this.op === "upsert") {
        const target = this.conflict
          ? this.conflict.split(",").map((c) => c.trim())
          : (
              await queryAdmin<{ a: string }>(
                `select a.attname as a from pg_index i join pg_attribute a on a.attrelid = i.indrelid and a.attnum = any(i.indkey)
                 where i.indrelid = $1::regclass and i.indisprimary`,
                [t]
              )
            ).map((r) => r.a);
        const upd = colsSet.filter((c) => !target.includes(c));
        stmt += ` on conflict (${target.map(q).join(", ")}) ${
          this.ignoreDup || !upd.length ? "do nothing" : `do update set ${upd.map((c) => `${q(c)} = excluded.${q(c)}`).join(", ")}`
        }`;
      }
    }

    if (!this.returning) return { sql: stmt, params };
    return { sql: `with m as (${stmt} returning *) ${wrap("m")}`, params };
  }

  async run(): Promise<Result> {
    try {
      const { sql, params } = await this.build();
      if (this.count) {
        const [row] = await queryAs<{ n: number }>(this.uid, sql, params);
        return { data: null, count: row.n, error: null } as Result;
      }
      const rows = await queryAs<{ data?: unknown }>(this.uid, sql, params);
      if (this.op !== "select" && !this.returning) return { data: null, error: null };
      const data = rows[0]?.data as unknown[];
      if (this.mode === "many") return { data, error: null };
      if (this.mode === "maybe" && data.length <= 1) return { data: data[0] ?? null, error: null };
      if (this.mode === "single" && data.length === 1) return { data: data[0], error: null };
      return { data: null, error: { message: "JSON object requested, multiple (or no) rows returned", code: "PGRST116" } };
    } catch (e) {
      const err = e as { message?: string; code?: string };
      return { data: null, error: { message: err.message ?? String(e), code: err.code } };
    }
  }

  then<A = Result, B = never>(ok?: ((v: Result) => A | PromiseLike<A>) | null, no?: ((r: unknown) => B | PromiseLike<B>) | null) {
    return this.run().then(ok, no);
  }
}

// Objetos/arrays viram JSON (colunas jsonb); o resto vai como está.
const enc = (v: unknown) => (v !== null && typeof v === "object" && !(v instanceof Date) ? JSON.stringify(v) : v);

async function rpc(uid: string | null, name: string, args: Record<string, unknown> = {}): Promise<Result> {
  try {
    const meta = (await fns()).get(name);
    if (!meta) throw new Error(`Função ${name} não encontrada`);
    const keys = Object.keys(args);
    const params = keys.map((k) => enc(args[k]));
    const call = `public.${q(name)}(${keys.map((k, i) => `${k} := $${i + 1}`).join(", ")})`;
    if (meta.void) {
      await queryAs(uid, `select ${call}`, params);
      return { data: null, error: null };
    }
    if (meta.set) {
      const rows = await queryAs<{ data: unknown }>(uid, `select coalesce(json_agg(t), '[]'::json) as data from ${call} t`, params);
      return { data: rows[0].data, error: null };
    }
    const rows = await queryAs<{ v: unknown }>(uid, `select ${call} as v`, params);
    return { data: rows[0]?.v ?? null, error: null };
  } catch (e) {
    const err = e as { message?: string; code?: string };
    return { data: null, error: { message: err.message ?? String(e), code: err.code } };
  }
}

export function createDemoClient(cookies: Cookies): SupabaseClient {
  const uid = cookies.get(DEMO_COOKIE)?.value ?? null;

  const client = {
    from: (table: string) => new Query(table, uid),
    rpc: (name: string, args?: Record<string, unknown>) => rpc(uid, name, args),
    auth: {
      async getUser() {
        if (!uid) return { data: { user: null }, error: null };
        const rows = await queryAdmin<{ id: string; email: string }>("select id, email from auth.users where id = $1", [uid]);
        return { data: { user: rows[0] ?? null }, error: null };
      },
      async signInWithPassword({ email, password }: { email: string; password: string }) {
        const rows = await queryAdmin<{ id: string }>("select id from auth.users where lower(email) = lower($1)", [email]);
        if (!rows[0] || !password) return { data: { user: null }, error: { message: "Invalid login credentials" } };
        cookies.set(DEMO_COOKIE, rows[0].id, { path: "/", httpOnly: true, sameSite: "lax" });
        return { data: { user: rows[0] }, error: null };
      },
      async signOut() {
        cookies.delete(DEMO_COOKIE);
        return { error: null };
      },
    },
    storage: {
      from: (bucket: string) => ({
        async upload(name: string, file: File, o: { contentType?: string } = {}) {
          try {
            await queryAs(uid, "insert into storage.objects (bucket_id, name, owner) values ($1, $2, $3)", [bucket, name, uid]);
            demoAssets.set(name, { bytes: new Uint8Array(await file.arrayBuffer()), type: o.contentType ?? file.type });
            return { data: { path: name }, error: null };
          } catch (e) {
            return { data: null, error: { message: (e as Error).message } };
          }
        },
        async remove(names: string[]) {
          try {
            await queryAs(uid, "delete from storage.objects where bucket_id = $1 and name = any($2)", [bucket, names]);
            names.forEach((n) => demoAssets.delete(n));
            return { data: [], error: null };
          } catch (e) {
            return { data: null, error: { message: (e as Error).message } };
          }
        },
      }),
    },
  };
  return client as unknown as SupabaseClient;
}
