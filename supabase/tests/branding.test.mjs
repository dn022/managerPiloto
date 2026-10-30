// Fase 6: configurações do tenant, logo (storage) e gestão de usuários.
import { createDb } from "./harness.mjs";

const { db, check, as, user, finish } = await createDb();

const root = await user("root@platform.test");
const ownerA = await user("owner-a@a.test");
const ownerB = await user("owner-b@b.test");
const adminA = await user("admin-a@a.test");
const staffA = await user("staff-a@a.test");
await db.query("insert into platform_admins (user_id) values ($1)", [root]);

const mk = async (name, slug, email) =>
  (await as(root, "select create_tenant($1,$2,$3,'completo') as id", [name, slug, email])).rows[0].id;
const A = await mk("Arena A", "arena-a", "owner-a@a.test");
const B = await mk("Arena B", "arena-b", "owner-b@b.test");
await as(ownerA, "select add_member($1,'admin-a@a.test','admin')", [A]);
await as(ownerA, "select add_member($1,'staff-a@a.test','staff')", [A]);

const update = (uid, tenant, set, params = []) =>
  as(uid, `update tenants set ${set} where id = $1 returning id`, [tenant, ...params]);

// --- settings
let r = await update(ownerA, A, `settings = '{"phone":"(11) 99999-0000","primary_color":"#1a2B3c"}'::jsonb`);
check("owner salva configurações válidas", !r.error && r.rows.length === 1, r.error);

r = await update(ownerA, A, `settings = '{"hack":"x"}'::jsonb`);
check("chave desconhecida é rejeitada", !!r.error);
r = await update(ownerA, A, `settings = '{"primary_color":"red"}'::jsonb`);
check("cor inválida é rejeitada", !!r.error);
r = await update(ownerA, A, `settings = '{"phone":1}'::jsonb`);
check("valor não-texto é rejeitado", !!r.error);
r = await update(ownerA, A, `settings = jsonb_build_object('address', repeat('x', 201))`);
check("valor longo demais é rejeitado", !!r.error);

r = await update(staffA, A, `name = 'Hackeada'`);
check("staff não altera o tenant", !r.error && r.rows.length === 0, r.error);
r = await update(ownerB, A, `name = 'Hackeada'`);
check("owner de outro tenant não altera o tenant", !r.error && r.rows.length === 0, r.error);

// --- logo_path
r = await update(ownerA, A, `logo_path = id::text || '/logo.png'`);
check("logo na pasta do próprio tenant é aceito", !r.error && r.rows.length === 1, r.error);
r = await update(ownerA, A, `logo_path = $2`, [`${B}/logo.png`]);
check("logo na pasta de outro tenant é rejeitado", !!r.error);

// --- storage
const ins = (uid, name, bucket = "tenant-assets") =>
  as(uid, "insert into storage.objects (bucket_id, name, owner) values ($1,$2,$3) returning id", [bucket, name, uid]);

r = await ins(ownerA, `${A}/logo.png`);
check("owner grava na pasta do próprio tenant", !r.error, r.error);
r = await ins(ownerA, `${B}/logo.png`);
check("owner de A não grava na pasta de B", !!r.error);
r = await ins(ownerA, "logo.png");
check("caminho sem pasta é rejeitado", !!r.error);
r = await ins(ownerA, "not-a-uuid/logo.png");
check("pasta que não é uuid é rejeitada", !!r.error);
r = await ins(staffA, `${A}/staff.png`);
check("staff sem tenant.manage não grava", !!r.error);
r = await ins(ownerA, `${A}/x.png`, "outro-bucket");
check("policy não vale para outro bucket", !!r.error);

await db.query("insert into storage.objects (bucket_id, name) values ('tenant-assets', $1)", [`${B}/logo.png`]);
r = await as(ownerA, "select name from storage.objects where bucket_id = 'tenant-assets'");
check("membro de A só lê objetos de A", r.rows.length === 1 && r.rows[0].name.startsWith(A), JSON.stringify(r.rows));
r = await as(staffA, "select name from storage.objects where bucket_id = 'tenant-assets'");
check("staff de A lê o logo de A", r.rows.length === 1, JSON.stringify(r.rows));

r = await as(ownerB, "delete from storage.objects where name = $1 returning id", [`${A}/logo.png`]);
check("owner de B não apaga objeto de A", r.rows.length === 0, r.error);
r = await as(ownerA, "delete from storage.objects where name = $1 returning id", [`${A}/logo.png`]);
check("owner de A apaga objeto de A", r.rows.length === 1, r.error);

// --- usuários
r = await as(ownerA, "select set_member_status($1,$2,'disabled')", [A, staffA]);
check("owner desativa membro", !r.error, r.error);
r = await as(staffA, "select id from tenants where id = $1", [A]);
check("membro desativado perde acesso", r.rows.length === 0);
r = await as(ownerA, "select set_member_status($1,$2,'active')", [A, staffA]);
check("owner reativa membro", !r.error, r.error);
r = await as(staffA, "select set_member_status($1,$2,'disabled')", [A, adminA]);
check("staff não gerencia usuários (nem admin)", !!r.error);
r = await as(ownerB, "select set_member_status($1,$2,'disabled')", [A, staffA]);
check("owner de outro tenant não gerencia usuários", !!r.error);
r = await as(ownerA, "select set_member_status($1,$2,'banido')", [A, staffA]);
check("status inválido é rejeitado", !!r.error);

r = await as(ownerA, "select set_member_status($1,$2,'disabled')", [A, ownerA]);
check("não desativa o último owner", !!r.error);
r = await as(ownerA, "select add_member($1,'owner-a@a.test','admin')", [A]);
check("não rebaixa o último owner", !!r.error);
r = await db.query("select 1").then(() => db.query("delete from memberships where tenant_id = $1 and user_id = $2", [A, ownerA])).catch((e) => ({ error: e.message }));
check("não apaga a membership do último owner", !!r.error);

await as(ownerA, "select add_member($1,'admin-a@a.test','owner')", [A]);
r = await as(ownerA, "select set_member_status($1,$2,'disabled')", [A, ownerA]);
check("com outro owner ativo, pode desativar", !r.error, r.error);

finish();
