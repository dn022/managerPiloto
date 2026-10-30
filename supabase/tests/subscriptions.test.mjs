// Fase 7: assinatura, overrides de módulo e uso dos limites.
import { createDb } from "./harness.mjs";

const { db, check, as, user, finish } = await createDb();

const root = await user("root@platform.test");
const ownerA = await user("owner-a@a.test");
const ownerB = await user("owner-b@b.test");
await db.query("insert into platform_admins (user_id) values ($1)", [root]);
const mk = async (name, slug, email, plan) =>
  (await as(root, "select create_tenant($1,$2,$3,$4) as id", [name, slug, email, plan])).rows[0].id;
const A = await mk("Arena A", "arena-a", "owner-a@a.test", "gestao");
const B = await mk("Arena B", "arena-b", "owner-b@b.test", "completo");

const mod = async (uid, t, m) => (await as(uid, "select module_enabled($1,$2) as v", [t, m])).rows[0].v;
const sub = (plan, status, end = "null") =>
  as(root, `select set_tenant_subscription($1,'${plan}','${status}',${end})`, [A]);

check("plano gestão: ranking desligado", (await mod(ownerA, A, "ranking")) === false);
let r = await as(ownerA, "select set_tenant_module($1,'ranking',true)", [A]);
check("owner não liga módulo", !!r.error);
r = await as(root, "select set_tenant_module($1,'ranking',true)", [A]);
check("Super Admin liga módulo", !r.error, r.error);
check("override liga o módulo", (await mod(ownerA, A, "ranking")) === true);
await as(root, "select set_tenant_module($1,'ranking',null)", [A]);
check("remover override volta ao plano", (await mod(ownerA, A, "ranking")) === false);

r = await as(ownerA, "select set_tenant_subscription($1,'completo','active',null)", [A]);
check("owner não troca o plano", !!r.error);
r = await sub("inexistente", "active");
check("plano inexistente é rejeitado", !!r.error);
r = await sub("completo", "banido");
check("status inválido é rejeitado", !!r.error);
r = await sub("completo", "active");
check("Super Admin troca o plano", !r.error, r.error);
check("novo plano habilita ranking", (await mod(ownerA, A, "ranking")) === true);

await sub("completo", "past_due");
check("past_due mantém acesso (carência)", (await mod(ownerA, A, "management")) === true);
await sub("completo", "cancelled");
check("cancelada desliga os módulos", (await mod(ownerA, A, "management")) === false);
r = await as(ownerA, "insert into sports (tenant_id,name) values ($1,'X') returning id", [A]);
check("assinatura cancelada bloqueia escrita", !!r.error || r.rows.length === 0);
r = await as(ownerA, "select subscription_status($1) as s", [A]);
check("status visível ao membro", r.rows[0].s === "cancelled");

await sub("completo", "trial", "now() - interval '1 day'");
check("trial vencido desliga os módulos", (await mod(ownerA, A, "management")) === false);
r = await as(ownerA, "select subscription_status($1) as s", [A]);
check("trial vencido aparece como expired", r.rows[0].s === "expired");
await sub("completo", "trial", "now() + interval '7 days'");
check("trial vigente mantém acesso", (await mod(ownerA, A, "management")) === true);

// isolamento
r = await as(ownerA, "select subscription_status($1) as s", [B]);
check("membro de A não vê status de B", r.rows.length === 0 || r.rows[0].s === null);
r = await as(ownerA, "select * from plan_usage($1)", [B]);
check("membro de A não vê uso de B", r.rows.length === 0);

// uso x limite (B: plano completo, students 1000, classes sem limite)
await db.query("insert into students (tenant_id,name) values ($1,'a'),($1,'b')", [B]);
r = await as(ownerB, "select * from plan_usage($1) order by key", [B]);
const st = r.rows.find((x) => x.key === "students");
check("uso reporta alunos e limite", st?.used === 2 && st?.limit === 1000, JSON.stringify(r.rows));
check("recurso sem limite vem nulo", r.rows.find((x) => x.key === "classes")?.limit === null, JSON.stringify(r.rows));

finish();
