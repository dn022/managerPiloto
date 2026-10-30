// Fase 3: mensalidades, status derivado, resumo, inadimplência e isolamento.
import { createDb } from "./harness.mjs";

const { db, check, as, user, finish } = await createDb();

const root = await user("root@platform.test");
const ownerA = await user("owner-a@a.test");
const ownerB = await user("owner-b@b.test");
const ownerC = await user("owner-c@c.test");
const staffA = await user("staff-a@a.test");
const teacherUserA = await user("teacher-a@a.test");
const studentUserA = await user("student-a@a.test");
await db.query("insert into platform_admins (user_id) values ($1)", [root]);

const mk = async (name, slug, email, plan) =>
  (await as(root, "select create_tenant($1,$2,$3,$4) as id", [name, slug, email, plan])).rows[0].id;
const A = await mk("Arena A", "arena-a", "owner-a@a.test", "completo");
const B = await mk("Arena B", "arena-b", "owner-b@b.test", "completo");
const C = await mk("Arena C", "arena-c", "owner-c@c.test", "campeonatos");
for (const [email, role] of [
  ["staff-a@a.test", "staff"],
  ["teacher-a@a.test", "teacher"],
  ["student-a@a.test", "student"],
]) {
  await as(ownerA, "select add_member($1,$2,$3)", [A, email, role]);
}

// Cadastros via superuser (as regras de gestão já são testadas em management.test.mjs).
const q = async (sql, params) => (await db.query(sql, params)).rows[0]?.id;
const sportA = await q("insert into sports (tenant_id,name) values ($1,'Beach') returning id", [A]);
const sportB = await q("insert into sports (tenant_id,name) values ($1,'Futevôlei') returning id", [B]);
const teacherA = await q("insert into teachers (tenant_id,name,user_id) values ($1,'Carlos',$2) returning id", [A, teacherUserA]);
const classA = await q("insert into classes (tenant_id,sport_id,teacher_id,name,capacity,monthly_fee_cents) values ($1,$2,$3,'Beach Int',10,15000) returning id", [A, sportA, teacherA]);
const classB = await q("insert into classes (tenant_id,sport_id,name,capacity,monthly_fee_cents) values ($1,$2,'Fut',10,20000) returning id", [B, sportB]);
const joao = await q("insert into students (tenant_id,name,user_id) values ($1,'João',$2) returning id", [A, studentUserA]);
const maria = await q("insert into students (tenant_id,name) values ($1,'Maria') returning id", [A]);
const isento = await q("insert into students (tenant_id,name) values ($1,'Bolsista') returning id", [A]);
const antigo = await q("insert into students (tenant_id,name) values ($1,'Já saiu') returning id", [A]);
const alunoB = await q("insert into students (tenant_id,name) values ($1,'Aluno B') returning id", [B]);
const enr = (t, s, c, fee, status = "active", started = "2026-01-01", ended = null) =>
  q("insert into enrollments (tenant_id,student_id,class_id,fee_cents,status,started_at,ended_at) values ($1,$2,$3,$4,$5,$6,$7) returning id", [t, s, c, fee, status, started, ended]);
const eJoao = await enr(A, joao, classA, 15000);
const eMaria = await enr(A, maria, classA, 15000);
await enr(A, isento, classA, 0);
await enr(A, antigo, classA, 15000, "ended", "2026-01-01", "2026-03-31");
await enr(B, alunoB, classB, 20000);

const COMP = "2026-05-01";

// --- geração ---
let r = await as(ownerA, "select generate_monthly_invoices($1,$2,10) as n", [A, COMP]);
check("owner gera mensalidades (2 matrículas ativas com valor; isento e encerrada ficam de fora)", r.rows[0]?.n === 2, JSON.stringify(r));
r = await as(ownerA, "select generate_monthly_invoices($1,$2,10) as n", [A, COMP]);
check("geração é idempotente (não duplica)", r.rows[0]?.n === 0, JSON.stringify(r));
r = await as(ownerA, "select generate_monthly_invoices($1,$2,10)", [B, COMP]);
check("owner A NÃO gera mensalidades no tenant B", r.error?.includes("permission denied"), r.error);
r = await as(teacherUserA, "select generate_monthly_invoices($1,$2,10)", [A, COMP]);
check("professor NÃO gera mensalidades", r.error?.includes("permission denied"), r.error);
r = await as(ownerC, "select generate_monthly_invoices($1,$2,10)", [C, COMP]);
check("tenant sem módulo de gestão NÃO gera", r.error?.includes("permission denied"), r.error);
r = await as(staffA, "select generate_monthly_invoices($1,'2026-06-15',31)", [A]);
check("dia de vencimento inválido é rejeitado", !!r.error);
r = await as(staffA, "select generate_monthly_invoices($1,'2026-06-15',5) as n", [A]);
check("funcionário gera (competência normalizada p/ o 1º dia)", r.rows[0]?.n === 2, JSON.stringify(r));
r = await as(ownerA, "select competence::text, due_date::text from invoices where competence='2026-06-01' limit 1");
check("vencimento = dia escolhido do mês", r.rows[0]?.due_date === "2026-06-05" && r.rows[0]?.competence === "2026-06-01", JSON.stringify(r.rows));
await as(ownerB, "select generate_monthly_invoices($1,$2,10)", [B, COMP]);

// --- isolamento ---
r = await as(ownerA, "select tenant_id from invoices");
check("owner A só vê mensalidades do tenant A", r.rows.length === 4 && r.rows.every((x) => x.tenant_id === A), String(r.rows.length));
r = await as(ownerB, "select tenant_id from invoices");
check("owner B só vê as do tenant B", r.rows.length === 1 && r.rows[0].tenant_id === B);
r = await as(ownerA, "insert into invoices (tenant_id,student_id,enrollment_id,competence,amount_cents,due_date) values ($1,$2,$3,'2026-07-01',100,'2026-07-10')", [A, alunoB, eJoao]);
check("mensalidade NÃO referencia aluno de outro tenant", !!r.error);
r = await as(ownerA, "update invoices set amount_cents=1 where tenant_id=$1 returning id", [B]);
check("owner A NÃO altera mensalidades do tenant B", r.rows.length === 0);
r = await as(teacherUserA, "select id from invoices");
check("professor NÃO vê mensalidades", r.rows.length === 0);
r = await as(studentUserA, "select student_id from invoices");
check("aluno vê só as próprias mensalidades", r.rows.length === 2 && r.rows.every((x) => x.student_id === joao), String(r.rows.length));
r = await as(studentUserA, "update invoices set status='paid', paid_at=now(), paid_amount_cents=1 where student_id=$1 returning id", [joao]);
check("aluno NÃO marca como paga", r.rows.length === 0);

// --- pagamento e constraints ---
r = await as(ownerA, "update invoices set status='paid' where enrollment_id=$1 and competence=$2", [eJoao, COMP]);
check("status 'paid' exige data e valor pagos (constraint)", !!r.error);
r = await as(ownerA, "update invoices set status='paid', paid_at=now(), paid_amount_cents=15000 where enrollment_id=$1 and competence=$2 returning id", [eJoao, COMP]);
check("registrar pagamento", r.rows.length === 1, r.error);
r = await as(ownerA, "update invoices set competence='2026-08-01' where enrollment_id=$1 and competence=$2", [eJoao, COMP]);
check("competência é imutável", !!r.error);
r = await as(ownerA, "update invoices set tenant_id=$1 where enrollment_id=$2 and competence=$3", [B, eJoao, COMP]);
check("tenant_id da mensalidade é imutável", !!r.error);
r = await as(ownerA, "delete from invoices where enrollment_id=$1", [eJoao]);
check("DELETE de mensalidade é negado (use cancelar)", !!r.error);

// --- status derivado (atrasado) ---
r = await as(ownerA, "select display_status from invoices_with_status where enrollment_id=$1 and competence=$2", [eMaria, COMP]);
check("pendente com vencimento passado aparece como 'overdue'", r.rows[0]?.display_status === "overdue", JSON.stringify(r.rows));
r = await as(ownerA, "select display_status from invoices_with_status where enrollment_id=$1 and competence=$2", [eJoao, COMP]);
check("paga continua 'paid'", r.rows[0]?.display_status === "paid");
await db.query("insert into invoices (tenant_id,student_id,enrollment_id,competence,amount_cents,due_date) values ($1,$2,$3,'2099-01-01',100,'2099-01-10')", [A, joao, eJoao]);
r = await as(ownerA, "select display_status from invoices_with_status where competence='2099-01-01'");
check("pendente com vencimento futuro continua 'pending'", r.rows[0]?.display_status === "pending");

// --- resumo e inadimplência ---
r = await as(ownerA, "select * from finance_summary($1,$2)", [A, COMP]);
const s = r.rows[0];
check("resumo: recebido 15000, atrasado 15000, 1 inadimplente", Number(s.paid_cents) === 15000 && Number(s.overdue_cents) === 15000 && s.overdue_count === 1 && s.paid_count === 1 && s.delinquent_students === 1, JSON.stringify(s));
r = await as(ownerA, "select * from finance_summary($1,$2)", [B, COMP]);
check("resumo do tenant B é negado ao owner A", r.error?.includes("permission denied"), r.error);
r = await as(teacherUserA, "select * from finance_summary($1,$2)", [A, COMP]);
check("professor NÃO vê resumo financeiro", r.error?.includes("permission denied"), r.error);

r = await as(staffA, "select student_name, overdue_count from delinquent_students($1) order by overdue_count desc", [A]);
check("inadimplentes: Maria (maio+junho) e João (só junho)", r.rows.length === 2 && r.rows[0].student_name === "Maria" && r.rows[0].overdue_count === 2 && r.rows[1].student_name === "João" && r.rows[1].overdue_count === 1, JSON.stringify(r.rows));

// --- cancelar e regerar ---
await as(ownerA, "update invoices set status='cancelled' where enrollment_id=$1 and competence=$2", [eMaria, COMP]);
r = await as(ownerA, "select generate_monthly_invoices($1,$2,10) as n", [A, COMP]);
check("mensalidade cancelada pode ser regerada", r.rows[0]?.n === 1, JSON.stringify(r));
r = await as(ownerA, "select * from finance_summary($1,$2)", [A, COMP]);
check("cancelada não entra no atrasado (só a regerada)", Number(r.rows[0].overdue_cents) === 15000, JSON.stringify(r.rows[0]));

finish();
