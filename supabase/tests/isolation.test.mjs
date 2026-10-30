// Prova de isolamento multi-tenant executando as migrations em um Postgres embutido (PGlite).
// Rodar: npm run test:db
import { createDb } from "./harness.mjs";

const { db, check, as, user, finish } = await createDb();

const root = await user("root@platform.test");
const ownerA = await user("owner-a@arena-a.test");
const ownerB = await user("owner-b@arena-b.test");
const teacherA = await user("teacher-a@arena-a.test");
const stranger = await user("stranger@nowhere.test");
await db.query("insert into platform_admins (user_id) values ($1)", [root]);

// --- criação de tenants ---
let r = await as(ownerA, "select create_tenant('Arena A','arena-a','owner-a@arena-a.test','completo')");
check("usuário comum NÃO cria tenant", r.error?.includes("permission denied"), r.error);

r = await as(root, "select create_tenant('Arena A','arena-a','owner-a@arena-a.test','completo') as id");
check("Super Admin cria tenant A", !r.error, r.error);
const tenantA = r.rows[0]?.id;
r = await as(root, "select create_tenant('Arena B','arena-b','owner-b@arena-b.test','gestao') as id");
check("Super Admin cria tenant B", !r.error, r.error);
const tenantB = r.rows[0]?.id;

r = await as(root, "select create_tenant('X','Slug Inválido','owner-a@arena-a.test')");
check("slug inválido é rejeitado", !!r.error);

// --- leitura isolada ---
r = await as(ownerA, "select id from tenants");
check("owner A vê somente o tenant A", r.rows.length === 1 && r.rows[0].id === tenantA);
r = await as(ownerB, "select id from tenants");
check("owner B vê somente o tenant B", r.rows.length === 1 && r.rows[0].id === tenantB);
r = await as(stranger, "select id from tenants");
check("usuário sem membership não vê tenants", r.rows.length === 0);
r = await as(root, "select id from tenants");
check("Super Admin vê todos os tenants", r.rows.length === 2);

r = await as(ownerA, "select tenant_id from memberships");
check("owner A só vê memberships do tenant A", r.rows.length === 1 && r.rows[0].tenant_id === tenantA);
r = await as(ownerA, "select tenant_id from tenant_subscriptions");
check("owner A só vê assinatura do tenant A", r.rows.length === 1 && r.rows[0].tenant_id === tenantA);

// --- escrita cruzada ---
r = await as(ownerA, "update tenants set name = 'HACK' where id = $1 returning id", [tenantB]);
check("owner A NÃO altera tenant B", r.rows.length === 0 && !r.error);
r = await as(ownerA, "update tenants set name = 'Arena A Nova' where id = $1 returning id", [tenantA]);
check("owner A altera o próprio tenant", r.rows.length === 1);
r = await as(ownerA, "update tenants set status = 'suspended' where id = $1", [tenantA]);
check("owner NÃO altera status do tenant (coluna protegida)", !!r.error, "esperava erro de permissão");
r = await as(ownerA, "update tenants set slug = 'outro' where id = $1", [tenantA]);
check("owner NÃO altera slug", !!r.error);
r = await as(ownerA, "insert into memberships (user_id, tenant_id, role_id) select $1, $2, id from roles where code='owner' and tenant_id is null", [stranger, tenantA]);
check("INSERT direto em memberships é negado", !!r.error);
r = await as(ownerA, "insert into tenant_modules (tenant_id, module_code, enabled) values ($1,'ranking',true)", [tenantA]);
check("tenant NÃO ativa módulos sozinho", !!r.error);
r = await as(ownerA, "select * from platform_admins");
check("platform_admins inacessível pela API", !!r.error || r.rows.length === 0);
r = await as(ownerA, "insert into platform_admins (user_id) values ($1)", [ownerA]);
check("usuário NÃO vira Super Admin", !!r.error);

// --- membros e papéis ---
r = await as(ownerA, "select add_member($1,'teacher-a@arena-a.test','teacher')", [tenantA]);
check("owner A adiciona professor ao tenant A", !r.error, r.error);
r = await as(ownerA, "select add_member($1,'teacher-a@arena-a.test','teacher')", [tenantB]);
check("owner A NÃO adiciona membro ao tenant B", r.error?.includes("permission denied"), r.error);
r = await as(teacherA, "select add_member($1,'stranger@nowhere.test','teacher')", [tenantA]);
check("professor NÃO gerencia usuários", r.error?.includes("permission denied"), r.error);
r = await as(teacherA, "select tenant_id from memberships");
check("professor só vê a própria membership", r.rows.length === 1 && r.rows[0].tenant_id === tenantA);
r = await as(teacherA, "update tenants set name='x' where id=$1 returning id", [tenantA]);
check("professor NÃO altera o tenant", r.rows.length === 0);

// admin não pode promover a owner
await db.query("insert into memberships (user_id, tenant_id, role_id) select $1, $2, id from roles where code='admin' and tenant_id is null", [stranger, tenantA]);
r = await as(stranger, "select has_permission($1,'users.manage') as v", [tenantA]);
check("admin não tem users.manage", r.rows[0].v === false);

// --- funções de autorização ---
r = await as(teacherA, "select has_permission($1,'sports.read') as a, has_permission($1,'sports.write') as b, has_permission($2,'sports.read') as c", [tenantA, tenantB]);
check("has_permission respeita papel e tenant", r.rows[0].a === true && r.rows[0].b === false && r.rows[0].c === false);

r = await as(ownerA, "select module_enabled($1,'ranking') as a, module_enabled($2,'ranking') as b, module_enabled($2,'management') as c, plan_limit($2,'students') as lim", [tenantA, tenantB]);
check("módulos por plano (A completo tem ranking; B gestão não)", r.rows[0].a === true && r.rows[0].b === false && r.rows[0].c === true);
check("limite do plano disponível", r.rows[0].lim === 100, String(r.rows[0].lim));

await db.query("insert into tenant_modules (tenant_id, module_code, enabled) values ($1,'ranking',true)", [tenantB]);
r = await as(ownerB, "select module_enabled($1,'ranking') as v", [tenantB]);
check("override por tenant liga módulo", r.rows[0].v === true);

// --- suspensão bloqueia acesso ---
await db.query("update tenants set status='suspended' where id=$1", [tenantA]);
r = await as(ownerA, "select id from tenants");
check("tenant suspenso: membros perdem acesso", r.rows.length === 0);
r = await as(ownerA, "select has_permission($1,'tenant.manage') as v", [tenantA]);
check("tenant suspenso: permissões negadas", r.rows[0].v === false);

finish();
