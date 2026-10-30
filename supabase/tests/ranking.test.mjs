// Fase 4: ranking com histórico de pontos (append-only), posições e isolamento.
import { createDb } from "./harness.mjs";

const { db, check, as, user, finish } = await createDb();

const root = await user("root@platform.test");
const ownerA = await user("owner-a@a.test");
const ownerB = await user("owner-b@b.test");
const staffA = await user("staff-a@a.test");
const studentUserA = await user("student-a@a.test");
await db.query("insert into platform_admins (user_id) values ($1)", [root]);

const mk = async (name, slug, email, plan) =>
  (await as(root, "select create_tenant($1,$2,$3,$4) as id", [name, slug, email, plan])).rows[0].id;
const A = await mk("Arena A", "arena-a", "owner-a@a.test", "completo");
const B = await mk("Arena B", "arena-b", "owner-b@b.test", "gestao"); // sem módulo de ranking
for (const [email, role] of [["staff-a@a.test", "staff"], ["student-a@a.test", "student"]]) {
  await as(ownerA, "select add_member($1,$2,$3)", [A, email, role]);
}

const q = async (sql, params) => (await db.query(sql, params)).rows[0]?.id;
const sportA = await q("insert into sports (tenant_id,name) values ($1,'Beach') returning id", [A]);
const joao = await q("insert into students (tenant_id,name) values ($1,'João') returning id", [A]);
const alunoB = await q("insert into students (tenant_id,name) values ($1,'Aluno B') returning id", [B]);

const ins = (uid, sql, params) => as(uid, sql, params);
const id = (r) => r.rows[0]?.id;

// --- criação ---
let r = await ins(ownerA, "insert into rankings (tenant_id, sport_id, name, season) values ($1,$2,'Ranking Beach Tennis','2026') returning id", [A, sportA]);
check("owner A cria ranking", !r.error, r.error);
const rk = id(r);
r = await ins(ownerA, "insert into rankings (tenant_id, name, season) values ($1,'ranking beach tennis','2026')", [A]);
check("ranking duplicado (nome + temporada) é rejeitado", !!r.error);
r = await ins(ownerA, "insert into rankings (tenant_id, name, season) values ($1,'Ranking Beach Tennis','2027') returning id", [A]);
check("mesmo nome em outra temporada é permitido", !r.error, r.error);
r = await ins(ownerB, "insert into rankings (tenant_id, name, season) values ($1,'X','2026')", [B]);
check("tenant sem módulo ranking NÃO cria ranking", !!r.error);
r = await ins(ownerA, "insert into rankings (tenant_id, name, season) values ($1,'Invasão','2026')", [B]);
check("owner A NÃO cria ranking no tenant B", !!r.error);
r = await ins(staffA, "insert into rankings (tenant_id, name, season) values ($1,'Staff','2026')", [A]);
check("funcionário NÃO cria ranking (sem rankings.write)", !!r.error);

// --- categorias e participantes ---
r = await ins(ownerA, "insert into ranking_categories (tenant_id, ranking_id, name) values ($1,$2,'Adulto') returning id", [A, rk]);
const catAdulto = id(r);
r = await ins(ownerA, "insert into ranking_categories (tenant_id, ranking_id, name) values ($1,$2,'Master') returning id", [A, rk]);
const catMaster = id(r);
r = await ins(ownerA, "insert into ranking_categories (tenant_id, ranking_id, name) values ($1,$2,'Adulto')", [A, rk]);
check("categoria duplicada no ranking é rejeitada", !!r.error);

const entry = async (name, cat, student = null) =>
  id(await ins(ownerA, "insert into ranking_entries (tenant_id, ranking_id, category_id, student_id, name) values ($1,$2,$3,$4,$5) returning id", [A, rk, cat, student, name]));
const eJoao = await entry("João", catAdulto, joao);
const ePedro = await entry("Pedro (externo)", catAdulto);
const eCarlos = await entry("Carlos", catAdulto);
const eAna = await entry("Ana", catMaster);
check("participantes criados (aluno e externo)", [eJoao, ePedro, eCarlos, eAna].every(Boolean));

r = await ins(ownerA, "insert into ranking_entries (tenant_id, ranking_id, category_id, student_id, name) values ($1,$2,$3,$4,'João de novo')", [A, rk, catAdulto, joao]);
check("mesmo aluno não entra duas vezes na mesma categoria", !!r.error);
r = await ins(ownerA, "insert into ranking_entries (tenant_id, ranking_id, student_id, name) values ($1,$2,$3,'Aluno B')", [A, rk, alunoB]);
check("participante NÃO referencia aluno de outro tenant", !!r.error);

const otherRk = id(await ins(ownerA, "insert into rankings (tenant_id, name, season) values ($1,'Outro','2026') returning id", [A]));
r = await ins(ownerA, "insert into ranking_entries (tenant_id, ranking_id, category_id, name) values ($1,$2,$3,'X')", [A, otherRk, catAdulto]);
check("categoria deve pertencer ao mesmo ranking", !!r.error);

// --- pontuação (eventos) ---
const pts = (uid, entryId, points, reason, sourceType = "manual", sourceId = null) =>
  ins(uid, "insert into ranking_point_events (tenant_id, entry_id, points, reason, source_type, source_id) values ($1,$2,$3,$4,$5,$6)", [A, entryId, points, reason, sourceType, sourceId]);

check("evento: +100 campeão do torneio X", !(await pts(ownerA, eJoao, 100, "Campeão do torneio X")).error);
check("evento: +50 semifinal do torneio Y", !(await pts(ownerA, eJoao, 50, "Semifinal do torneio Y")).error);
check("evento: -20 penalidade (pontos negativos)", !(await pts(ownerA, eJoao, -20, "Ausência")).error);
await pts(ownerA, ePedro, 130, "Campeão do torneio Z");
await pts(ownerA, eCarlos, 130, "Campeão do torneio W");
await pts(ownerA, eAna, 10, "Participação");

r = await pts(ownerA, eJoao, 0, "Zero");
check("evento com 0 ponto é rejeitado", !!r.error);
r = await pts(ownerA, eJoao, 10, "   ");
check("evento sem motivo é rejeitado", !!r.error);
r = await pts(staffA, eJoao, 10, "Staff");
check("funcionário NÃO lança pontos", !!r.error);
r = await ins(ownerA, "insert into ranking_point_events (tenant_id, entry_id, points, reason) values ($1,$2,5,'x')", [B, eJoao]);
check("evento NÃO referencia participante de outro tenant", !!r.error);
r = await ins(ownerA, "update ranking_point_events set points = 9999 where entry_id=$1 returning id", [eJoao]);
check("histórico é imutável: UPDATE negado", !!r.error);
r = await ins(ownerA, "delete from ranking_point_events where entry_id=$1", [eJoao]);
check("histórico é imutável: DELETE negado", !!r.error);

// --- integração idempotente ---
const champ = "11111111-1111-1111-1111-111111111111";
check("evento de campeonato é aceito", !(await pts(ownerA, eCarlos, 500, "Open 2026: campeão", "championship", champ)).error);
r = await pts(ownerA, eCarlos, 500, "Open 2026: campeão (repetido)", "championship", champ);
check("mesmo evento de campeonato NÃO pontua duas vezes", !!r.error);
r = await pts(ownerA, eCarlos, 5, "manual com origem", "manual", champ);
check("evento manual não pode ter source_id", !!r.error);

// --- classificação ---
r = await as(ownerA, "select name, total_points, events_count, position from ranking_standings where ranking_id=$1 and category_id=$2 order by position, name", [rk, catAdulto]);
const names = r.rows.map((x) => `${x.position}:${x.name}:${x.total_points}`);
check("classificação: Carlos 630 (1º), João 130 e Pedro 130 empatam (2º)",
  JSON.stringify(names) === JSON.stringify(["1:Carlos:630", "2:João:130", "2:Pedro (externo):130"]), JSON.stringify(names));
r = await as(ownerA, "select position, total_points from ranking_standings where entry_id=$1", [eAna]);
check("posições são independentes por categoria (Ana é 1ª no Master)", r.rows[0]?.position === 1 && r.rows[0]?.total_points === 10);
r = await as(ownerA, "select events_count from ranking_standings where entry_id=$1", [eJoao]);
check("histórico de eventos contabilizado (3)", r.rows[0]?.events_count === 3);

await as(ownerA, "update ranking_entries set active=false where id=$1", [ePedro]);
r = await as(ownerA, "select name from ranking_standings where ranking_id=$1 and category_id=$2", [rk, catAdulto]);
check("participante inativo sai da classificação", r.rows.length === 2);

// --- leitura / isolamento ---
r = await as(studentUserA, "select id from rankings");
check("aluno (membro) vê os rankings", r.rows.length === 3);
r = await as(studentUserA, "select total_points from ranking_standings where entry_id=$1", [eJoao]);
check("aluno vê a classificação", r.rows[0]?.total_points === 130);
r = await as(studentUserA, "update rankings set name='Hack' returning id");
check("aluno NÃO altera ranking", r.rows.length === 0);
r = await as(ownerB, "select id from rankings");
check("owner B (sem módulo, outro tenant) não vê rankings", r.rows.length === 0);
r = await as(ownerB, "select * from ranking_standings");
check("owner B não vê classificação do tenant A", r.rows.length === 0);
r = await as(ownerA, "update ranking_entries set tenant_id=$1 where id=$2", [B, eJoao]);
check("tenant_id de participante é imutável", !!r.error);

finish();
