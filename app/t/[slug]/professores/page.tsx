import { Button } from "@/app/_components/ui/button";
import { archiveTeacher, createTeacher } from "@/app/_lib/actions/management";
import { requireTenant } from "@/app/_lib/session";
import { createClient } from "@/app/_lib/supabase/server";
import { Card, ErrorBanner, Field, Input, PageHeader, FormToggle, Avatar, Badge } from "../_components/ui";

export default async function ProfessoresPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ erro?: string }>;
}) {
  const { slug } = await params;
  const { erro } = await searchParams;
  const ctx = await requireTenant(slug, "teachers.read", "management");
  const canWrite = ctx.permissions.includes("teachers.write");

  const supabase = await createClient();
  const { data: teachers } = await supabase
    .from("teachers")
    .select("id, name, phone, email, classes(id)")
    .eq("tenant_id", ctx.tenant.id)
    .is("deleted_at", null)
    .order("name");

  return (
    <>
      <PageHeader title="Professores" />
      <ErrorBanner message={erro} />

      {canWrite && (
        <FormToggle title="Novo professor">
          <form action={createTeacher} className="grid gap-3 sm:grid-cols-2">
            <input type="hidden" name="slug" value={slug} />
            <Field label="Nome">
              <Input name="name" required />
            </Field>
            <Field label="Telefone">
              <Input name="phone" />
            </Field>
            <Field label="E-mail">
              <Input name="email" type="email" />
            </Field>
            <Field label="Observações">
              <Input name="notes" />
            </Field>
            <div className="sm:col-span-2">
              <Button type="submit">Adicionar</Button>
            </div>
          </form>
        </FormToggle>
      )}

      <Card>
        <ul className="divide-y divide-zinc-800 text-sm">
          {(teachers ?? []).map((t) => (
            <li key={t.id} className="arena-row flex items-center justify-between gap-3 py-3">
              <div className="flex min-w-0 items-center gap-3">
                <Avatar name={t.name} />
                <div className="min-w-0">
                  <div className="truncate font-medium">{t.name}</div>
                  <div className="truncate text-xs text-zinc-500">
                    {[t.phone, t.email].filter(Boolean).join(" · ") || "sem contato"}
                  </div>
                  <div className="mt-1">
                    <Badge tone={Array.isArray(t.classes) && t.classes.length ? "info" : "muted"}>
                      {Array.isArray(t.classes) ? t.classes.length : 0} turma(s)
                    </Badge>
                  </div>
                </div>
              </div>
              {canWrite && (
                <form action={archiveTeacher}>
                  <input type="hidden" name="slug" value={slug} />
                  <input type="hidden" name="id" value={t.id} />
                  <Button type="submit" variant="ghost" size="sm" className="text-zinc-400">
                    Arquivar
                  </Button>
                </form>
              )}
            </li>
          ))}
          {!teachers?.length && <li className="py-2 text-zinc-500">Nenhum professor cadastrado.</li>}
        </ul>
      </Card>
    </>
  );
}
