// Regras e isolamento da Fase 2 (gestão). Rodar: node supabase/tests/management.test.mjs
import { createDb } from "./harness.mjs";

const { db, check, as, user, finish } = await createDb();

const root = await user("root@platform.test");
const ownerA = await user("owner-a@a.test");
const ownerB = await user("owner-b@b.test");
const ownerC = await user("owner-c@c.test");
const adminA = await user("admin-a@a.test");
const staffA = await user("staff-a@a.test");
const teacherUserA = await user("teacher-a@a.test");
const teacherUserA2 = await user("teacher-a2@a.test");
const studentUserA = await user("student-a@a.test");
await db.query("insert into platform_admins (user_id) values ($1)", [root]);

const mk = async (name, slug, email, plan) =>
  (await as(root, "select create_tenant($1,$2,$3,$4) as id", [name, slug, email, plan])).rows[0].id;
const A = await mk("Arena A", "arena-a", "owner-a@a.test", "completo");
const B = await mk("Arena B", "arena-b", "owner-b@b.test", "completo");
const C = await mk("Arena C", "arena-c", "owner-c@c.test", "campeonatos"); // sem módulo de gestão

for (const [email, role] of [
  ["admin-a@a.test", "admin"],
  ["staff-a@a.test", "staff"],
  ["teacher-a@a.test", "teacher"],
  ["teacher-a2@a.test", "teacher"],
  ["student-a@a.test", "student"],
]) {
  await as(ownerA, "select add_member($1,$2,$3)", [A, email, role]);
}

const ins = async (uid, sql, params) => as(uid, sql, params);
const one = (r) => r.rows[0]?.id;

// --- cadastros base em A e B ---
let r = await ins(ownerA, "insert into sports (tenant_id, name) values ($1,'Beach Tennis') returning id", [A]);
check("owner A cria modalidade", !r.error, r.error);
const sportA = one(r);
r = await ins(ownerB, "insert into sports (tenant_id, name) values ($1,'Futevôlei') returning id", [B]);
const sportB = one(r);

r = await ins(ownerA, "insert into sports (tenant_id, name) values ($1,'beach tennis')", [A]);
check("modalidade duplicada (case-insensitive) é rejeitada", !!r.error);

r = await ins(ownerA, "insert into sports (tenant_id, name) values ($1,'Invasão')", [B]);
check("owner A NÃO cria modalidade no tenant B", !!r.error);

r = await ins(ownerA, "insert into teachers (tenant_id, name, user_id) values ($1,'Carlos',$2) returning id", [A, teacherUserA]);
const teacherA = one(r);
r = await ins(ownerA, "insert into teachers (tenant_id, name, user_id) values ($1,'Dani',$2) returning id", [A, teacherUserA2]);
const teacherA2 = one(r);

// --- turmas ---
r = await ins(ownerA, "insert into classes (tenant_id, sport_id, teacher_id, name, capacity, monthly_fee_cents) values ($1,$2,$3,'Beach Intermediário',2,15000) returning id", [A, sportA, teacherA]);
check("owner A cria turma", !r.error, r.error);
const classA = one(r);
r = await ins(ownerA, "insert into classes (tenant_id, sport_id, teacher_id, name, capacity) values ($1,$2,$3,'Beach Avançado',5) returning id", [A, sportA, teacherA2]);
const classA2 = one(r);

r = await ins(ownerA, "insert into classes (tenant_id, sport_id, name, capacity) values ($1,$2,'X',5)", [A, sportB]);
check("turma NÃO referencia modalidade de outro tenant (FK composta)", !!r.error);
r = await ins(ownerA, "insert into classes (tenant_id, sport_id, name, capacity) values ($1,$2,'X',0)", [A, sportA]);
check("capacidade deve ser > 0", !!r.error);
r = await ins(ownerA, "insert into class_schedules (tenant_id, class_id, weekday, start_time, end_time) values ($1,$2,1,'19:00','18:00')", [A, classA]);
check("horário final deve ser maior que o inicial", !!r.error);
r = await ins(ownerA, "insert into class_schedules (tenant_id, class_id, weekday, start_time, end_time) values ($1,$2,2,'19:00','20:00')", [A, classA]);
check("owner A cria horário", !r.error, r.error);

// --- alunos ---
const mkStudent = async (uid, tenant, name, userId = null) =>
  one(await ins(uid, "insert into students (tenant_id, name, user_id) values ($1,$2,$3) returning id", [tenant, name, userId]));
const joao = await mkStudent(ownerA, A, "João Silva", studentUserA);
const maria = await mkStudent(ownerA, A, "Maria");
const pedro = await mkStudent(ownerA, A, "Pedro");
const outroB = await mkStudent(ownerB, B, "Aluno de B");

r = await as(ownerA, "select id from students");
check("owner A só vê alunos do tenant A", r.rows.length === 3 && !r.rows.some((x) => x.id === outroB));
r = await as(ownerB, "select id from students");
check("owner B só vê alunos do tenant B", r.rows.length === 1 && r.rows[0].id === outroB);
r = await as(ownerA, "update students set name='HACK' where id=$1 returning id", [outroB]);
check("owner A NÃO altera aluno do tenant B", r.rows.length === 0);
r = await as(ownerA, "update students set tenant_id=$1 where id=$2", [B, joao]);
check("tenant_id de aluno é imutável", !!r.error);

// --- matrículas: mesmo aluno em várias turmas, capacidade ---
r = await ins(ownerA, "insert into enrollments (tenant_id, student_id, class_id, fee_cents) values ($1,$2,$3,15000)", [A, joao, classA]);
check("matrícula do João na turma 1", !r.error, r.error);
r = await ins(ownerA, "insert into enrollments (tenant_id, student_id, class_id) values ($1,$2,$3)", [A, joao, classA2]);
check("mesmo aluno em outra turma (sem duplicar cadastro)", !r.error, r.error);
r = await ins(ownerA, "insert into enrollments (tenant_id, student_id, class_id) values ($1,$2,$3)", [A, joao, classA]);
check("matrícula duplicada ativa é rejeitada", !!r.error);
r = await ins(ownerA, "insert into enrollments (tenant_id, student_id, class_id) values ($1,$2,$3)", [A, maria, classA]);
check("2ª vaga ocupada (capacidade 2)", !r.error, r.error);
r = await ins(ownerA, "insert into enrollments (tenant_id, student_id, class_id) values ($1,$2,$3)", [A, pedro, classA]);
check("turma lotada bloqueia nova matrícula", r.error?.includes("turma lotada"), r.error);
r = await ins(staffA, "insert into enrollments (tenant_id, student_id, class_id, capacity_override) values ($1,$2,$3,true)", [A, pedro, classA]);
check("funcionário NÃO excede capacidade", !!r.error);
r = await ins(adminA, "insert into enrollments (tenant_id, student_id, class_id, capacity_override) values ($1,$2,$3,true) returning id", [A, pedro, classA]);
check("admin PODE autorizar exceção de capacidade", !r.error, r.error);
r = await ins(ownerA, "insert into enrollments (tenant_id, student_id, class_id) values ($1,$2,$3)", [A, outroB, classA]);
check("matrícula NÃO referencia aluno de outro tenant", !!r.error);

r = await as(ownerA, "select enrolled, capacity from class_occupancy where class_id=$1", [classA]);
check("ocupação da turma (3 matriculados, 2 de capacidade c/ exceção)", r.rows[0]?.enrolled === 3 && r.rows[0]?.capacity === 2, JSON.stringify(r.rows));

// encerrar matrícula libera vaga
await as(ownerA, "update enrollments set status='ended', ended_at=current_date where student_id=$1 and class_id=$2", [maria, classA]);
r = await as(ownerA, "select enrolled from class_occupancy where class_id=$1", [classA]);
check("encerrar matrícula libera vaga", r.rows[0]?.enrolled === 2);

// --- papéis: professor, aluno, funcionário ---
r = await as(teacherUserA, "select id from classes order by name");
check("professor vê a agenda (todas as turmas do tenant)", r.rows.length === 2);
r = await as(teacherUserA, "select id from students");
check("professor vê só alunos das próprias turmas", r.rows.length === 2 && r.rows.some((x) => x.id === joao) && r.rows.some((x) => x.id === pedro), JSON.stringify(r.rows));
r = await as(teacherUserA2, "select id from students");
check("outro professor vê só os alunos das turmas dele (João)", r.rows.length === 1 && r.rows[0].id === joao);
r = await as(teacherUserA, "select class_id from enrollments");
check("professor vê só matrículas das próprias turmas (inclui histórico)", r.rows.length === 3 && r.rows.every((x) => x.class_id === classA), JSON.stringify(r.rows));
r = await as(teacherUserA, "insert into students (tenant_id, name) values ($1,'X')", [A]);
check("professor NÃO cadastra aluno", !!r.error);
r = await as(teacherUserA, "update classes set capacity=99 where id=$1 returning id", [classA]);
check("professor NÃO altera turma", r.rows.length === 0);

r = await as(studentUserA, "select id from students");
check("aluno vê somente o próprio cadastro", r.rows.length === 1 && r.rows[0].id === joao);
r = await as(studentUserA, "select class_id from enrollments");
check("aluno vê somente as próprias matrículas", r.rows.length === 2);
r = await as(studentUserA, "select id from classes");
check("aluno vê a agenda de turmas", r.rows.length === 2);
r = await as(studentUserA, "update students set name='X' where id=$1 returning id", [joao]);
check("aluno NÃO edita cadastro", r.rows.length === 0);

r = await as(staffA, "insert into students (tenant_id, name) values ($1,'Novo') returning id", [A]);
check("funcionário cadastra aluno", !r.error, r.error);
r = await as(staffA, "insert into classes (tenant_id, sport_id, name, capacity) values ($1,$2,'Y',5)", [A, sportA]);
check("funcionário NÃO cria turma", !!r.error);

// --- soft delete ---
r = await as(ownerA, "update students set deleted_at=now() where id=$1 returning id", [pedro]);
check("exclusão lógica de aluno", r.rows.length === 1);
r = await as(ownerA, "delete from students where id=$1", [maria]);
check("DELETE físico de aluno é negado", !!r.error);

// --- módulo desativado (plano sem gestão) ---
r = await as(ownerC, "insert into sports (tenant_id, name) values ($1,'Vôlei')", [C]);
check("tenant sem módulo de gestão NÃO escreve", !!r.error);

// --- limite do plano ---
await db.query("insert into plan_limits (plan_code, key, value) values ('completo','classes',3) on conflict (plan_code, key) do update set value=3");
r = await as(ownerA, "insert into classes (tenant_id, sport_id, name, capacity) values ($1,$2,'Terceira',5) returning id", [A, sportA]);
check("limite do plano permite até o teto", !r.error, r.error);
r = await as(ownerA, "insert into classes (tenant_id, sport_id, name, capacity) values ($1,$2,'Quarta',5)", [A, sportA]);
check("limite do plano bloqueia acima do teto", r.error?.includes("limite do plano"), r.error);
r = await as(ownerB, "insert into classes (tenant_id, sport_id, name, capacity) values ($1,$2,'B1',5) returning id", [B, sportB]);
check("limite é por tenant (B não é afetado por A)", !r.error, r.error);

finish();
