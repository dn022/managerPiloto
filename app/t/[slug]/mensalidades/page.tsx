import Link from "next/link";

import { Button } from "@/app/_components/ui/button";
import {
  generateInvoices,
  markInvoicePaid,
  setInvoiceStatus,
} from "@/app/_lib/actions/finance";
import { requireTenant } from "@/app/_lib/session";
import { createClient } from "@/app/_lib/supabase/server";
import { brl } from "@/app/_lib/weekdays";
import { Card, ErrorBanner, Field, Input, PageHeader, selectClass } from "../_components/ui";

const one = <T,>(v: T | T[] | null): T | null => (Array.isArray(v) ? (v[0] ?? null) : v);

const STATUS_LABEL: Record<string, { label: string; className: string }> = {
  paid: { label: "Pago", className: "bg-emerald-950 text-emerald-300" },
  pending: { label: "Pendente", className: "bg-yellow-950 text-yellow-300" },
  overdue: { label: "Atrasado", className: "bg-red-950 text-red-300" },
  cancelled: { label: "Cancelado", className: "bg-zinc-800 text-zinc-400" },
  exempt: { label: "Isento", className: "bg-sky-950 text-sky-300" },
};

const currentMonth = () => new Date().toISOString().slice(0, 7);

export default async function MensalidadesPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ competencia?: string; status?: string; erro?: string; gerou?: string }>;
}) {
  const { slug } = await params;
  const sp = await searchParams;
  const ctx = await requireTenant(slug, "payments.read", "management");
  const canWrite = ctx.permissions.includes("payments.write");

  const month = /^\d{4}-\d{2}$/.test(sp.competencia ?? "") ? sp.competencia! : currentMonth();
  const competence = `${month}-01`;
  const filter = sp.status ?? "";

  const supabase = await createClient();
  let listQuery = supabase
    .from("invoices_with_status")
    .select("id, amount_cents, due_date, display_status, paid_amount_cents, students(name), enrollments(classes(name))")
    .eq("tenant_id", ctx.tenant.id)
    .eq("competence", competence)
    .order("due_date");
  if (filter) listQuery = listQuery.eq("display_status", filter);

  const [{ data: invoices }, { data: summaryRows }] = await Promise.all([
    listQuery,
    supabase.rpc("finance_summary", { p_tenant: ctx.tenant.id, p_competence: competence }),
  ]);
  const summary = (Array.isArray(summaryRows) ? summaryRows[0] : summaryRows) ?? {
    paid_cents: 0,
    pending_cents: 0,
    overdue_cents: 0,
    delinquent_students: 0,
  };

  const cards = [
    { label: "Recebido", value: brl(Number(summary.paid_cents)) },
    { label: "Pendente (a vencer)", value: brl(Number(summary.pending_cents)) },
    { label: "Em atraso", value: brl(Number(summary.overdue_cents)) },
    { label: "Alunos inadimplentes", value: String(summary.delinquent_students) },
  ];

  return (
    <>
      <PageHeader title="Mensalidades" subtitle="Controle manual de cobranças por competência." />
      <ErrorBanner message={sp.erro} />
      {sp.gerou !== undefined && (
        <div className="mb-4 rounded-xl border border-emerald-900/50 bg-emerald-950/40 px-3 py-2 text-sm text-emerald-200">
          {sp.gerou} mensalidade(s) gerada(s).
        </div>
      )}

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {cards.map((c) => (
          <Card key={c.label} className="arena-kpi">
            <div className="text-sm text-zinc-400">{c.label}</div>
            <div className="arena-kpi-value mt-1 whitespace-nowrap text-2xl font-semibold">{c.value}</div>
          </Card>
        ))}
      </div>

      <div className="mb-6 flex flex-wrap items-end gap-4">
        <form className="flex flex-wrap items-end gap-3">
          <Field label="Competência">
            <Input name="competencia" type="month" defaultValue={month} />
          </Field>
          <Field label="Situação">
            <select name="status" defaultValue={filter} className={selectClass}>
              <option value="">Todas</option>
              {Object.entries(STATUS_LABEL).map(([k, v]) => (
                <option key={k} value={k}>
                  {v.label}
                </option>
              ))}
            </select>
          </Field>
          <Button type="submit" variant="secondary">
            Filtrar
          </Button>
        </form>

        {canWrite && (
          <form action={generateInvoices} className="flex items-end gap-3">
            <input type="hidden" name="slug" value={slug} />
            <input type="hidden" name="competencia" value={month} />
            <Field label="Dia de vencimento">
              <Input name="due_day" type="number" min={1} max={28} defaultValue={10} className="w-24" />
            </Field>
            <Button type="submit">Gerar mensalidades do mês</Button>
          </form>
        )}

        <Link className="text-sm underline" href={`/t/${slug}/mensalidades/inadimplentes`}>
          Ver inadimplentes
        </Link>
      </div>

      <Card>
        <ul className="divide-y divide-zinc-800 text-sm">
          {(invoices ?? []).map((i) => {
            const st = STATUS_LABEL[i.display_status] ?? STATUS_LABEL.pending;
            const student = one(i.students as { name: string } | { name: string }[] | null);
            const enrollment = one(
              i.enrollments as
                | { classes: { name: string } | { name: string }[] | null }
                | { classes: { name: string } | { name: string }[] | null }[]
                | null
            );
            const className = one(enrollment?.classes ?? null)?.name;
            const open = i.display_status === "pending" || i.display_status === "overdue";
            return (
              <li key={i.id} className="arena-row flex flex-wrap items-center justify-between gap-3 py-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span>{student?.name}</span>
                    <span className={`rounded-full px-2 py-0.5 text-xs ${st.className}`}>{st.label}</span>
                  </div>
                  <div className="text-xs text-zinc-500">
                    {className} · vence em {i.due_date} · {brl(i.amount_cents)}
                    {i.paid_amount_cents !== null ? ` · pago ${brl(i.paid_amount_cents)}` : ""}
                  </div>
                </div>
                {canWrite && (
                  <div className="flex flex-wrap items-center gap-2">
                    {open && (
                      <form action={markInvoicePaid} className="flex items-center gap-2">
                        <input type="hidden" name="slug" value={slug} />
                        <input type="hidden" name="competence" value={competence} />
                        <input type="hidden" name="id" value={i.id} />
                        <Input
                          name="amount"
                          inputMode="decimal"
                          defaultValue={(i.amount_cents / 100).toFixed(2)}
                          className="h-8 w-24"
                        />
                        <Button type="submit" size="sm">
                          Registrar pagamento
                        </Button>
                      </form>
                    )}
                    {open && (
                      <>
                        <StatusButton slug={slug} competence={competence} id={i.id} status="exempt" label="Isentar" />
                        <StatusButton slug={slug} competence={competence} id={i.id} status="cancelled" label="Cancelar" />
                      </>
                    )}
                    {!open && (
                      <StatusButton slug={slug} competence={competence} id={i.id} status="pending" label="Reabrir" />
                    )}
                  </div>
                )}
              </li>
            );
          })}
          {!invoices?.length && (
            <li className="py-3 text-zinc-500">Nenhuma mensalidade nesta competência.</li>
          )}
        </ul>
      </Card>
    </>
  );
}

function StatusButton({
  slug,
  competence,
  id,
  status,
  label,
}: {
  slug: string;
  competence: string;
  id: string;
  status: string;
  label: string;
}) {
  return (
    <form action={setInvoiceStatus}>
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="competence" value={competence} />
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="status" value={status} />
      <Button type="submit" variant="ghost" size="sm" className="text-zinc-400">
        {label}
      </Button>
    </form>
  );
}
