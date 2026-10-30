// Fase 5: campeonatos por tenant, categorias configuráveis, resultados e integração com ranking.
import { createDb } from "./harness.mjs";

const { db, check, as, user, finish } = await createDb();

const root = await user("root@platform.test");
const ownerA = await user("owner-a@a.test");
const ownerB = await user("owner-b@b.test");
const ownerC = await user("owner-c@c.test");
const staffA = await user("staff-a@a.test");
const studentUserA = await user("student-a@a.test");
await db.query("insert into platform_admins (user_id) values ($1)", [root]);

const mk = async (name, slug, email, plan) =>
  (await as(root, "select create_tenant($1,$2,$3,$4) as id", [name, slug, email, plan])).rows[0].id;
const A = await mk("Arena A", "arena-a", "owner-a@a.test", "completo");
const B = await mk("Arena B", "arena-b", "owner-b@b.test", "completo");
const C = await mk("Arena C", "arena-c", "owner-c@c.test", "gestao"); // sem campeonatos
for (const [email, role] of [["staff-a@a.test", "staff"], ["student-a@a.test", "student"]]) {
  await as(ownerA, "select add_member($1,$2,$3)", [A, email, role]);
}

const q = async (sql, params) => (await db.query(sql, params)).rows[0]?.id;
const sportA = await q("insert into sports (tenant_id,name) values ($1,'Beach Tennis') returning id", [A]);
const sportB = await q("insert into sports (tenant_id,name) values ($1,'Futevôlei') returning id", [B]);
const joao = await q("insert into students (tenant_id,name,user_id) values ($1,'João',$2) returning id", [A, studentUserA]);
const alunoB = await q("insert into students (tenant_id,name) values ($1,'Aluno B') returning id", [B]);
const rankingA = await q("insert into rankings (tenant_id,name,season) values ($1,'Ranking Beach 2026','2026') returning id", [A]);
const rankingB = await q("insert into rankings (tenant_id,name,season) values ($1,'Ranking B','2026') returning id", [B]);

const id = (r) => r.rows[0]?.id;

// --- campeonatos ---
let r = await as(ownerA, "insert into championships (tenant_id, sport_id, name, event_date) values ($1,$2,'Open Beach Tennis 2026','2026-11-20') returning id", [A, sportA]);
check("owner A cria campeonato", !r.error, r.error);
const champA = id(r);
r = await as(ownerB, "insert into championships (tenant_id, sport_id, name) values ($1,$2,'Copa de Futevôlei 2026') returning id", [B, sportB]);
const champB = id(r);
r = await as(ownerA, "insert into championships (tenant_id, sport_id, name) values ($1,$2,'X')", [A, sportB]);
check("campeonato NÃO usa modalidade de outro tenant", !!r.error);
r = await as(ownerA, "insert into championships (tenant_id, name) values ($1,'Invasão')", [B]);
check("owner A NÃO cria campeonato no tenant B", !!r.error);
r = await as(ownerC, "insert into championships (tenant_id, name) values ($1,'Sem módulo')", [C]);
check("tenant sem módulo de campeonatos NÃO cria", !!r.error);
r = await as(staffA, "insert into championships (tenant_id, name) values ($1,'Staff')", [A]);
check("funcionário NÃO cria campeonato", !!r.error);
r = await as(ownerA, "update championships set ranking_id=$1 where id=$2", [rankingB, champA]);
check("campeonato NÃO vincula ranking de outro tenant", !!r.error);

r = await as(ownerA, "select id from championships");
check("owner A só vê campeonatos do tenant A", r.rows.length === 1 && r.rows[0].id === champA);
r = await as(ownerB, "select id from championships");
check("owner B só vê campeonatos do tenant B", r.rows.length === 1 && r.rows[0].id === champB);
r = await as(studentUserA, "select id from championships");
check("aluno (membro) vê campeonatos", r.rows.length === 1);
r = await as(studentUserA, "update championships set name='Hack' returning id");
check("aluno NÃO altera campeonato", r.rows.length === 0);

// --- categorias configuráveis ---
const cat = (name, extra = {}) =>
  as(ownerA, "insert into championship_categories (tenant_id, championship_id, name, gender, min_age, max_age, min_weight_kg, max_weight_kg, level) values ($1,$2,$3,$4,$5,$6,$7,$8,$9) returning id",
    [A, champA, name, extra.gender ?? null, extra.minAge ?? null, extra.maxAge ?? null, extra.minW ?? null, extra.maxW ?? null, extra.level ?? null]);
r = await cat("Adulto Masculino Iniciante", { gender: "M", minAge: 18, maxAge: 39, level: "Iniciante" });
check("categoria configurável (sexo, idade, nível)", !r.error, r.error);
const catM = id(r);
r = await cat("Adulto Feminino", { gender: "F", minAge: 18 });
const catF = id(r);
r = await cat("Adulto Masculino Iniciante");
check("categoria duplicada no evento é rejeitada", !!r.error);
r = await cat("Inválida", { minAge: 30, maxAge: 20 });
check("faixa de idade inválida é rejeitada", !!r.error);
r = await cat("Inválida peso", { minW: 90, maxW: 70 });
check("faixa de peso inválida é rejeitada", !!r.error);
r = await as(ownerB, "select id from championship_categories");
check("owner B não vê categorias do tenant A", r.rows.length === 0);

// --- inscrições ---
const reg = (uid, tenant, champ, name, extra = {}) =>
  as(uid, "insert into championship_registrations (tenant_id, championship_id, category_id, student_id, name, status) values ($1,$2,$3,$4,$5,$6) returning id",
    [tenant, champ, extra.cat ?? null, extra.student ?? null, name, extra.status ?? "confirmed"]);
const rJoao = id(await reg(ownerA, A, champA, "João", { cat: catM, student: joao }));
const rPedro = id(await reg(ownerA, A, champA, "Pedro (externo)", { cat: catM }));
const rCarlos = id(await reg(ownerA, A, champA, "Carlos", { cat: catM }));
const rAna = id(await reg(ownerA, A, champA, "Ana", { cat: catF }));
check("inscrições criadas (aluno e externos)", [rJoao, rPedro, rCarlos, rAna].every(Boolean));

r = await reg(ownerA, A, champA, "João de novo", { cat: catM, student: joao });
check("aluno não se inscreve duas vezes na mesma categoria", !!r.error);
r = await reg(ownerA, A, champA, "Aluno B", { student: alunoB });
check("inscrição NÃO referencia aluno de outro tenant", !!r.error);
r = await reg(ownerA, A, champB, "Cross");
check("inscrição NÃO entra em campeonato de outro tenant", !!r.error);
const champA2 = id(await as(ownerA, "insert into championships (tenant_id, name) values ($1,'Outro evento') returning id", [A]));
r = await reg(ownerA, A, champA2, "Cat errada", { cat: catM });
check("categoria deve pertencer ao mesmo campeonato", !!r.error);
r = await as(ownerB, "update championship_registrations set name='HACK' where id=$1 returning id", [rJoao]);
check("owner B NÃO altera inscrição do tenant A", r.rows.length === 0);
r = await as(ownerA, "update championship_registrations set tenant_id=$1 where id=$2", [B, rJoao]);
check("tenant_id de inscrição é imutável", !!r.error);

// --- chaves ---
r = await as(ownerA, "insert into championship_brackets (tenant_id, championship_id, category_id, name, slots, winners) values ($1,$2,$3,'Chave M',$4::jsonb,'[[null,null],[null]]'::jsonb) returning id",
  [A, champA, catM, JSON.stringify([rJoao, rPedro, rCarlos, null])]);
check("owner A cria chave", !r.error, r.error);
r = await as(ownerA, "insert into championship_brackets (tenant_id, championship_id, category_id, name) values ($1,$2,$3,'Duplicada')", [A, champA, catM]);
check("uma chave por categoria", !!r.error);
r = await as(ownerA, "insert into championship_brackets (tenant_id, championship_id, name, slots) values ($1,$2,'Ruim','{}'::jsonb)", [A, champA]);
check("slots precisam ser um array JSON", !!r.error);
r = await as(ownerB, "select id from championship_brackets");
check("owner B não vê chaves do tenant A", r.rows.length === 0);

// --- resultados e integração com ranking ---
const res = (reg, cat, placement) =>
  as(ownerA, "insert into championship_results (tenant_id, championship_id, category_id, registration_id, placement) values ($1,$2,$3,$4,$5)", [A, champA, cat, reg, placement]);
check("resultado: 1º João", !(await res(rJoao, catM, 1)).error);
check("resultado: 2º Pedro", !(await res(rPedro, catM, 2)).error);
check("resultado: 3º Carlos", !(await res(rCarlos, catM, 3)).error);
check("resultado: 1ª Ana", !(await res(rAna, catF, 1)).error);
r = await res(rJoao, catM, 2);
check("inscrição não tem dois resultados", !!r.error);

for (const [placement, points] of [[1, 500], [2, 300], [3, 150]]) {
  await as(ownerA, "insert into championship_points_rules (tenant_id, championship_id, placement, points) values ($1,$2,$3,$4)", [A, champA, placement, points]);
}

r = await as(ownerA, "select publish_results_to_ranking($1)", [champA]);
check("publicar sem ranking vinculado é rejeitado", r.error?.includes("não está vinculado"), r.error);

r = await as(ownerA, "update championships set ranking_id=$1 where id=$2 returning id", [rankingA, champA]);
check("campeonato vincula ranking do mesmo tenant (integração opcional)", r.rows.length === 1, r.error);

r = await as(staffA, "select publish_results_to_ranking($1)", [champA]);
check("funcionário NÃO publica pontos", r.error?.includes("permission denied"), r.error);
r = await as(ownerB, "select publish_results_to_ranking($1)", [champA]);
check("owner B NÃO publica pontos do tenant A", r.error?.includes("permission denied"), r.error);

r = await as(ownerA, "select publish_results_to_ranking($1) as n", [champA]);
check("owner A publica pontos (4 eventos)", r.rows[0]?.n === 4, JSON.stringify(r));
r = await as(ownerA, "select publish_results_to_ranking($1) as n", [champA]);
check("publicar de novo é idempotente (0 novos eventos)", r.rows[0]?.n === 0, JSON.stringify(r));

r = await as(ownerA, "select name, total_points from ranking_standings where ranking_id=$1 order by total_points desc, name", [rankingA]);
const table = r.rows.map((x) => `${x.name}:${x.total_points}`);
check("ranking recebeu os pontos do campeonato",
  table.length === 4 && ["João:500", "Ana:500", "Pedro (externo):300", "Carlos:150"].every((x) => table.includes(x)),
  JSON.stringify(table));
r = await as(ownerA, "select e.student_id from ranking_entries e where e.ranking_id=$1 and e.name='João'", [rankingA]);
check("aluno da arena é vinculado ao participante do ranking", r.rows[0]?.student_id === joao);
r = await as(ownerA, "select source_type from ranking_point_events where source_id=$1 limit 1", [champA]);
check("evento marcado com a origem 'championship'", r.rows[0]?.source_type === "championship");

// --- despesas (financeiro) ---
r = await as(ownerA, "insert into championship_expenses (tenant_id, championship_id, description, amount_cents) values ($1,$2,'Troféus',50000)", [A, champA]);
check("owner A registra despesa", !r.error, r.error);
r = await as(studentUserA, "select id from championship_expenses");
check("aluno NÃO vê despesas", r.rows.length === 0);
r = await as(ownerB, "select id from championship_expenses");
check("owner B NÃO vê despesas do tenant A", r.rows.length === 0);
r = await as(staffA, "insert into championship_expenses (tenant_id, championship_id, description, amount_cents) values ($1,$2,'Staff',100)", [A, champA]);
check("funcionário lança despesa (payments.write)", !r.error, r.error);

finish();
