import { notFound } from "next/navigation";

import { Button } from "@/app/_components/ui/button";
import { addExpense, removeExpense } from "@/app/_lib/actions/championships";
import { requireTenant } from "@/app/_lib/session";
import { createClient } from "@/app/_lib/supabase/server";
import { brl } from "@/app/_lib/weekdays";
import { Card, ErrorBanner, Field, Input, FormToggle } from "../../../_components/ui";
import ChampionshipHeader from "../../_components/ChampionshipHeader";

export default async function DespesasPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string; id: string }>;
  searchParams: Promise<{ erro?: string }>;
}) {
  const { slug, id } = await params;
  const { erro } = await searchParams;
  const ctx = await requireTenant(slug, "payments.read", "championships");
  const canWrite = ctx.permissions.includes("payments.write");

  const supabase = await createClient();
  const { data: champ } = await supabase
    .from("championships")
    .select("id, name, status, event_date")
    .eq("tenant_id", ctx.tenant.id)
    .eq("id", id)
    .maybeSingle();
  if (!champ) notFound();

  const [{ data: expenses }, { data: regs }] = await Promise.all([
    supabase
      .from("championship_expenses")
      .select("id, description, category, amount_cents, spent_on")
      .eq("championship_id", id)
      .order("spent_on", { ascending: false }),
    supabase.from("championship_registrations").select("fee_cents, status").eq("championship_id", id),
  ]);

  const totalExpenses = (expenses ?? []).reduce((sum, e) => sum + e.amount_cents, 0);
  const expectedRevenue = (regs ?? [])
    .filter((r) => r.status === "confirmed")
    .reduce((sum, r) => sum + r.fee_cents, 0);

  return (
    <>
      <ChampionshipHeader
        slug={slug}
        id={id}
        name={champ.name}
        status={champ.status}
        eventDate={champ.event_date}
        active="/despesas"
        canSeeFinance
      />
      <ErrorBanner message={erro} />

      <div className="mb-6 grid grid-cols-3 gap-3">
        <Card>
          <div className="text-sm text-zinc-400">Inscrições confirmadas</div>
          <div className="mt-1 text-2xl font-semibold">{brl(expectedRevenue)}</div>
        </Card>
        <Card>
          <div className="text-sm text-zinc-400">Despesas</div>
          <div className="mt-1 text-2xl font-semibold">{brl(totalExpenses)}</div>
        </Card>
        <Card>
          <div className="text-sm text-zinc-400">Saldo previsto</div>
          <div className="mt-1 text-2xl font-semibold">{brl(expectedRevenue - totalExpenses)}</div>
        </Card>
      </div>

      {canWrite && (
        <FormToggle title="Nova despesa">
          <form action={addExpense} className="grid gap-3 sm:grid-cols-4">
            <input type="hidden" name="slug" value={slug} />
            <input type="hidden" name="championship_id" value={id} />
            <Field label="Descrição">
              <Input name="description" required />
            </Field>
            <Field label="Categoria">
              <Input name="category" />
            </Field>
            <Field label="Valor (R$)">
              <Input name="amount" inputMode="decimal" required />
            </Field>
            <Field label="Data">
              <Input name="spent_on" type="date" />
            </Field>
            <div className="sm:col-span-4">
              <Button type="submit">Adicionar</Button>
            </div>
          </form>
        </FormToggle>
      )}

      <Card>
        <ul className="divide-y divide-zinc-800 text-sm">
          {(expenses ?? []).map((e) => (
            <li key={e.id} className="flex items-center justify-between py-2">
              <div>
                <div>{e.description}</div>
                <div className="text-xs text-zinc-500">
                  {e.spent_on}
                  {e.category ? ` · ${e.category}` : ""}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span>{brl(e.amount_cents)}</span>
                {canWrite && (
                  <form action={removeExpense}>
                    <input type="hidden" name="slug" value={slug} />
                    <input type="hidden" name="championship_id" value={id} />
                    <input type="hidden" name="id" value={e.id} />
                    <Button type="submit" variant="ghost" size="sm" className="text-zinc-400">
                      Remover
                    </Button>
                  </form>
                )}
              </div>
            </li>
          ))}
          {!expenses?.length && <li className="py-2 text-zinc-500">Nenhuma despesa.</li>}
        </ul>
      </Card>
    </>
  );
}
