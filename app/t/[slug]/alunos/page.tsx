import { Button } from "@/app/_components/ui/button";
import { archiveStudent, createStudent } from "@/app/_lib/actions/management";
import { requireTenant } from "@/app/_lib/session";
import { createClient } from "@/app/_lib/supabase/server";
import { Card, ErrorBanner, Field, Input, PageHeader, FormToggle, Avatar, Badge } from "../_components/ui";

export default async function AlunosPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ erro?: string; q?: string }>;
}) {
  const { slug } = await params;
  const { erro, q } = await searchParams;
  const ctx = await requireTenant(slug, "students.read", "management");
  const canWrite = ctx.permissions.includes("students.write");

  const supabase = await createClient();
  let query = supabase
    .from("students")
    .select("id, name, phone, email, status, enrollments(status, classes(name))")
    .eq("tenant_id", ctx.tenant.id)
    .is("deleted_at", null)
    .order("name")
    .limit(200);
  if (q) query = query.ilike("name", `%${q.replace(/[%_]/g, "")}%`);
  const { data: students } = await query;

  return (
    <>
      <PageHeader title="Alunos" />
      <ErrorBanner message={erro} />

      {canWrite && (
        <FormToggle title="Novo aluno">
          <form action={createStudent} className="grid gap-3 sm:grid-cols-2">
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
            <Field label="Data de nascimento">
              <Input name="birth_date" type="date" />
            </Field>
            <Field label="Documento">
              <Input name="document" />
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

      <form className="mb-4 flex gap-3">
        <Input name="q" defaultValue={q} placeholder="Buscar por nome" />
        <Button type="submit" variant="secondary">
          Buscar
        </Button>
      </form>

      <Card>
        <ul className="divide-y divide-zinc-800 text-sm">
          {(students ?? []).map((s) => {
            const active = (Array.isArray(s.enrollments) ? s.enrollments : []).filter(
              (e: { status: string }) => e.status === "active"
            );
            const names = active
              .map((e: { classes: { name: string } | { name: string }[] | null }) =>
                Array.isArray(e.classes) ? e.classes[0]?.name : e.classes?.name
              )
              .filter(Boolean)
              .join(", ");
            return (
              <li key={s.id} className="arena-row flex items-center justify-between gap-3 py-3">
                <div className="flex min-w-0 items-center gap-3">
                  <Avatar name={s.name} />
                  <div className="min-w-0">
                    <div className="truncate font-medium">{s.name}</div>
                    <div className="truncate text-xs text-zinc-500">
                      {[s.phone, s.email].filter(Boolean).join(" · ") || "sem contato"}
                    </div>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {names ? (
                        names.split(", ").map((n) => (
                          <Badge key={n}>{n}</Badge>
                        ))
                      ) : (
                        <Badge tone="muted">sem turma</Badge>
                      )}
                    </div>
                  </div>
                </div>
                {canWrite && (
                  <form action={archiveStudent}>
                    <input type="hidden" name="slug" value={slug} />
                    <input type="hidden" name="id" value={s.id} />
                    <Button type="submit" variant="ghost" size="sm" className="text-zinc-400">
                      Arquivar
                    </Button>
                  </form>
                )}
              </li>
            );
          })}
          {!students?.length && <li className="py-2 text-zinc-500">Nenhum aluno encontrado.</li>}
        </ul>
      </Card>
    </>
  );
}
