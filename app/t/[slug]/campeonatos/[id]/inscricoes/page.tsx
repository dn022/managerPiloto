import { notFound } from "next/navigation";

import { Button } from "@/app/_components/ui/button";
import { addRegistration, setRegistrationStatus } from "@/app/_lib/actions/championships";
import { requireTenant } from "@/app/_lib/session";
import { createClient } from "@/app/_lib/supabase/server";
import { brl } from "@/app/_lib/weekdays";
import { Card, ErrorBanner, Field, Input, selectClass, FormToggle } from "../../../_components/ui";
import ChampionshipHeader from "../../_components/ChampionshipHeader";

const STATUS: Record<string, { label: string; className: string }> = {
  pending: { label: "Pendente", className: "bg-yellow-950 text-yellow-300" },
  confirmed: { label: "Confirmada", className: "bg-emerald-950 text-emerald-300" },
  cancelled: { label: "Cancelada", className: "bg-zinc-800 text-zinc-400" },
};

const one = <T,>(v: T | T[] | null): T | null => (Array.isArray(v) ? (v[0] ?? null) : v);

export default async function InscricoesPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string; id: string }>;
  searchParams: Promise<{ erro?: string; categoria?: string }>;
}) {
  const { slug, id } = await params;
  const { erro, categoria } = await searchParams;
  const ctx = await requireTenant(slug, undefined, "championships");
  const canWrite = ctx.permissions.includes("championships.write");

  const supabase = await createClient();
  const { data: champ } = await supabase
    .from("championships")
    .select("id, name, status, event_date")
    .eq("tenant_id", ctx.tenant.id)
    .eq("id", id)
    .maybeSingle();
  if (!champ) notFound();

  let regsQuery = supabase
    .from("championship_registrations")
    .select("id, name, team, gender, weight_kg, status, fee_cents, championship_categories(name)")
    .eq("championship_id", id)
    .order("name");
  if (categoria) regsQuery = regsQuery.eq("category_id", categoria);

  const [{ data: regs }, { data: categories }, { data: students }] = await Promise.all([
    regsQuery,
    supabase.from("championship_categories").select("id, name").eq("championship_id", id).order("name"),
    canWrite
      ? supabase
          .from("students")
          .select("id, name")
          .eq("tenant_id", ctx.tenant.id)
          .eq("status", "active")
          .is("deleted_at", null)
          .order("name")
          .limit(500)
      : Promise.resolve({ data: [] as { id: string; name: string }[] }),
  ]);

  return (
    <>
      <ChampionshipHeader
        slug={slug}
        id={id}
        name={champ.name}
        status={champ.status}
        eventDate={champ.event_date}
        active="/inscricoes"
        canSeeFinance={ctx.permissions.includes("payments.read")}
      />
      <ErrorBanner message={erro} />

      {canWrite && (
        <FormToggle title="Nova inscrição">
          <form action={addRegistration} className="grid gap-3 sm:grid-cols-3">
            <input type="hidden" name="slug" value={slug} />
            <input type="hidden" name="championship_id" value={id} />
            <Field label="Aluno da arena">
              <select name="student_id" className={selectClass} defaultValue="">
                <option value="">Atleta externo (digitar nome)</option>
                {(students ?? []).map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Nome (atleta externo)">
              <Input name="name" />
            </Field>
            <Field label="Equipe / academia">
              <Input name="team" />
            </Field>
            <Field label="Categoria">
              <select name="category_id" className={selectClass} defaultValue="">
                <option value="">Sem categoria</option>
                {(categories ?? []).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Sexo">
              <select name="gender" className={selectClass} defaultValue="">
                <option value="">Não informar</option>
                <option value="M">Masculino</option>
                <option value="F">Feminino</option>
              </select>
            </Field>
            <Field label="Nascimento">
              <Input name="birth_date" type="date" />
            </Field>
            <Field label="Peso (kg)">
              <Input name="weight_kg" inputMode="decimal" />
            </Field>
            <Field label="Telefone">
              <Input name="phone" />
            </Field>
            <Field label="Taxa (R$)">
              <Input name="fee" inputMode="decimal" defaultValue="0" />
            </Field>
            <Field label="Situação">
              <select name="status" className={selectClass} defaultValue="confirmed">
                <option value="confirmed">Confirmada</option>
                <option value="pending">Pendente</option>
              </select>
            </Field>
            <div className="sm:col-span-3">
              <Button type="submit">Inscrever</Button>
            </div>
          </form>
        </FormToggle>
      )}

      <form className="mb-4 flex items-end gap-3">
        <Field label="Filtrar por categoria">
          <select name="categoria" defaultValue={categoria ?? ""} className={selectClass}>
            <option value="">Todas</option>
            {(categories ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>
        <Button type="submit" variant="secondary">
          Filtrar
        </Button>
      </form>

      <Card title={`Inscrições (${regs?.length ?? 0})`}>
        <ul className="divide-y divide-zinc-800 text-sm">
          {(regs ?? []).map((r) => {
            const st = STATUS[r.status];
            const cat = one(r.championship_categories as { name: string } | { name: string }[] | null);
            return (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span>{r.name}</span>
                    <span className={`rounded-full px-2 py-0.5 text-xs ${st.className}`}>{st.label}</span>
                  </div>
                  <div className="text-xs text-zinc-500">
                    {[r.team, cat?.name ?? "sem categoria", r.weight_kg ? `${r.weight_kg} kg` : null, brl(r.fee_cents)]
                      .filter(Boolean)
                      .join(" · ")}
                  </div>
                </div>
                {canWrite && (
                  <div className="flex gap-1">
                    {(["confirmed", "pending", "cancelled"] as const)
                      .filter((s) => s !== r.status)
                      .map((s) => (
                        <form key={s} action={setRegistrationStatus}>
                          <input type="hidden" name="slug" value={slug} />
                          <input type="hidden" name="championship_id" value={id} />
                          <input type="hidden" name="id" value={r.id} />
                          <input type="hidden" name="status" value={s} />
                          <Button type="submit" variant="ghost" size="sm" className="text-zinc-400">
                            {s === "confirmed" ? "Confirmar" : s === "pending" ? "Pendente" : "Cancelar"}
                          </Button>
                        </form>
                      ))}
                  </div>
                )}
              </li>
            );
          })}
          {!regs?.length && <li className="py-3 text-zinc-500">Nenhuma inscrição.</li>}
        </ul>
      </Card>
    </>
  );
}
