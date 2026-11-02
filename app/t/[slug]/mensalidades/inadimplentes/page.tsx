import Link from "next/link";

import { requireTenant } from "@/app/_lib/session";
import { createClient } from "@/app/_lib/supabase/server";
import { brl } from "@/app/_lib/weekdays";
import { Card, PageHeader } from "../../_components/ui";

export default async function InadimplentesPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const ctx = await requireTenant(slug, "payments.read", "management");

  const supabase = await createClient();
  const { data } = await supabase.rpc("delinquent_students", { p_tenant: ctx.tenant.id });
  const rows = (data ?? []) as {
    student_id: string;
    student_name: string;
    overdue_count: number;
    overdue_cents: number;
    oldest_due: string;
  }[];

  const total = rows.reduce((sum, r) => sum + Number(r.overdue_cents), 0);

  return (
    <>
      <Link href={`/t/${slug}/mensalidades`} className="mb-4 inline-block text-sm text-zinc-400 hover:text-zinc-100">
        ← Mensalidades
      </Link>
      <PageHeader
        title="Inadimplência"
        subtitle={`${rows.length} aluno(s) com mensalidades em atraso · ${brl(total)} em aberto`}
      />
      <Card>
        <ul className="divide-y divide-zinc-800 text-sm">
          {rows.map((r) => (
            <li key={r.student_id} className="flex items-center justify-between py-3">
              <div>
                <div>{r.student_name}</div>
                <div className="text-xs text-zinc-500">
                  {r.overdue_count} mensalidade(s) · mais antiga venceu em {r.oldest_due}
                </div>
              </div>
              <div className="font-medium text-red-300">{brl(Number(r.overdue_cents))}</div>
            </li>
          ))}
          {!rows.length && <li className="py-3 text-zinc-500">Nenhum aluno inadimplente.</li>}
        </ul>
      </Card>
    </>
  );
}
