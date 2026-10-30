import Link from "next/link";

import { requireTenant } from "@/app/_lib/session";
import { createClient } from "@/app/_lib/supabase/server";
import { brl } from "@/app/_lib/weekdays";
import { Card, PageHeader } from "./_components/ui";

export default async function TenantDashboardPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const ctx = await requireTenant(slug);
  const supabase = await createClient();
  const tenantId = ctx.tenant.id;

  const hasManagement = ctx.modules.includes("management");
  const canSeeStudents = ctx.permissions.includes("students.read");

  const count = async (table: "students" | "teachers" | "classes", status?: string) => {
    let q = supabase
      .from(table)
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .is("deleted_at", null);
    if (status) q = q.eq("status", status);
    const { count: total } = await q;
    return total ?? 0;
  };

  const [students, teachers, classes, occupancy] = hasManagement
    ? await Promise.all([
        canSeeStudents ? count("students", "active") : Promise.resolve(null),
        count("teachers"),
        count("classes", "active"),
        supabase.from("class_occupancy").select("capacity, enrolled").eq("tenant_id", tenantId),
      ])
    : [null, null, null, { data: [] as { capacity: number; enrolled: number }[] }];

  const canSeeFinance = hasManagement && ctx.permissions.includes("payments.read");
  const finance = canSeeFinance
    ? await supabase.rpc("finance_summary", {
        p_tenant: tenantId,
        p_competence: `${new Date().toISOString().slice(0, 7)}-01`,
      })
    : null;
  const fin = finance ? (Array.isArray(finance.data) ? finance.data[0] : finance.data) : null;

  const full = (occupancy.data ?? []).filter((o) => o.enrolled >= o.capacity).length;

  const stats = [
    { label: "Alunos ativos", value: students },
    { label: "Turmas", value: classes },
    { label: "Professores", value: teachers },
    { label: "Turmas lotadas", value: hasManagement ? full : null },
    { label: "Mensalidades pagas (mês)", value: fin ? brl(Number(fin.paid_cents)) : null },
    { label: "Mensalidades pendentes (mês)", value: fin ? brl(Number(fin.pending_cents) + Number(fin.overdue_cents)) : null },
    { label: "Alunos inadimplentes", value: fin ? fin.delinquent_students : null },
  ].filter((s) => s.value !== null);

  return (
    <>
      <PageHeader title="Dashboard" subtitle={`Seu papel: ${ctx.roleCode}`} />

      {stats.length > 0 && (
        <div className="mb-6 grid grid-cols-2 gap-3 xl:grid-cols-4">
          {stats.map((s) => (
            <Card key={s.label} className="arena-kpi">
              <div className="text-sm text-zinc-400">{s.label}</div>
              <div className="arena-kpi-value mt-1 whitespace-nowrap text-2xl font-semibold xl:text-3xl">{s.value}</div>
            </Card>
          ))}
        </div>
      )}

      {hasManagement && (
        <Card title="Atalhos">
          <div className="flex flex-wrap gap-2 text-sm">
            {[
              { href: "agenda", label: "Agenda" },
              canSeeStudents && { href: "alunos", label: "Alunos" },
              ctx.permissions.includes("teachers.read") && { href: "professores", label: "Professores" },
              { href: "turmas", label: "Turmas" },
              canSeeFinance && { href: "mensalidades", label: "Mensalidades" },
              canSeeFinance && { href: "mensalidades/inadimplentes", label: "Inadimplentes" },
            ]
              .filter((l): l is { href: string; label: string } => Boolean(l))
              .map((l) => (
                <Link key={l.href} className="arena-chip" href={`/t/${slug}/${l.href}`}>
                  {l.label}
                </Link>
              ))}
          </div>
        </Card>
      )}
    </>
  );
}
