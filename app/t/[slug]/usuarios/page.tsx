import { Button } from "@/app/_components/ui/button";
import { addUser, setUserStatus } from "@/app/_lib/actions/settings";
import { requireTenant } from "@/app/_lib/session";
import { createClient } from "@/app/_lib/supabase/server";
import { Card, ErrorBanner, Field, Input, PageHeader, selectClass, FormToggle, Avatar, Badge } from "../_components/ui";

const one = <T,>(v: T | T[] | null): T | null => (Array.isArray(v) ? (v[0] ?? null) : v);

export default async function UsuariosPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ erro?: string; ok?: string }>;
}) {
  const { slug } = await params;
  const { erro, ok } = await searchParams;
  const ctx = await requireTenant(slug, "users.read");
  const canManage = ctx.permissions.includes("users.manage");

  const supabase = await createClient();
  const [{ data: members }, { data: roles }] = await Promise.all([
    supabase
      .from("memberships")
      .select("user_id, status, roles(code, name)")
      .eq("tenant_id", ctx.tenant.id)
      .order("created_at"),
    supabase.from("roles").select("code, name").is("tenant_id", null).order("name"),
  ]);

  const ids = (members ?? []).map((m) => m.user_id);
  const { data: profiles } = ids.length
    ? await supabase.from("profiles").select("user_id, name").in("user_id", ids)
    : { data: [] };
  const names = new Map((profiles ?? []).map((p) => [p.user_id, p.name]));

  return (
    <>
      <PageHeader title="Usuários" subtitle="Quem tem acesso a esta organização." />
      <ErrorBanner message={erro} />
      {ok !== undefined && (
        <div className="mb-4 rounded-xl border border-emerald-900/50 bg-emerald-950/40 px-3 py-2 text-sm text-emerald-200">
          Alterações salvas.
        </div>
      )}

      {canManage && (
        <FormToggle title="Adicionar usuário">
          <p className="mb-3 text-sm text-zinc-400">A pessoa precisa já ter criado uma conta com este e-mail.</p>
          <form action={addUser} className="grid gap-3 sm:grid-cols-3">
            <input type="hidden" name="slug" value={slug} />
            <Field label="E-mail">
              <Input name="email" type="email" required />
            </Field>
            <Field label="Papel">
              <select name="role" className={selectClass} required defaultValue="staff">
                {(roles ?? []).map((r) => (
                  <option key={r.code} value={r.code}>
                    {r.name}
                  </option>
                ))}
              </select>
            </Field>
            <div className="flex items-end">
              <Button type="submit">Adicionar</Button>
            </div>
          </form>
        </FormToggle>
      )}

      <Card>
        <ul className="divide-y divide-zinc-800 text-sm">
          {(members ?? []).map((m) => {
            const role = one(m.roles as { code: string; name: string } | { code: string; name: string }[] | null);
            const active = m.status === "active";
            return (
              <li key={m.user_id} className="arena-row flex items-center justify-between gap-3 py-3">
                <div className="flex min-w-0 items-center gap-3">
                  <Avatar name={names.get(m.user_id) ?? "?"} />
                  <div className="min-w-0">
                    <div className="truncate font-medium">{names.get(m.user_id) ?? "Sem nome"}</div>
                    <div className="mt-1 flex gap-1">
                      <Badge>{role?.name ?? "—"}</Badge>
                      {!active && <Badge tone="muted">desativado</Badge>}
                    </div>
                  </div>
                </div>
                {canManage && (
                  <form action={setUserStatus}>
                    <input type="hidden" name="slug" value={slug} />
                    <input type="hidden" name="user_id" value={m.user_id} />
                    <input type="hidden" name="status" value={active ? "disabled" : "active"} />
                    <Button type="submit" variant="ghost" size="sm" className="text-zinc-400">
                      {active ? "Desativar" : "Reativar"}
                    </Button>
                  </form>
                )}
              </li>
            );
          })}
        </ul>
      </Card>
    </>
  );
}
