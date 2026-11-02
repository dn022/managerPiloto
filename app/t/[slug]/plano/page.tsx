import { requireTenant } from "@/app/_lib/session";
import { createClient } from "@/app/_lib/supabase/server";
import { Badge, Card, PageHeader } from "../_components/ui";

const STATUS_LABEL: Record<string, string> = {
  trial: "Período de teste",
  active: "Ativa",
  past_due: "Em atraso (período de carência)",
  expired: "Teste encerrado",
  cancelled: "Cancelada",
};
const STATUS_TONE: Record<string, "ok" | "info" | "warn" | "danger"> = {
  trial: "info",
  active: "ok",
  past_due: "warn",
  expired: "danger",
  cancelled: "danger",
};
const LIMIT_LABEL: Record<string, string> = { students: "Alunos", classes: "Turmas" };

export default async function PlanoPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const ctx = await requireTenant(slug, "tenant.manage");

  const supabase = await createClient();
  const [{ data: sub }, { data: status }, { data: usage }, { data: modules }] = await Promise.all([
    supabase
      .from("tenant_subscriptions")
      .select("current_period_end, plans(name)")
      .eq("tenant_id", ctx.tenant.id)
      .maybeSingle(),
    supabase.rpc("subscription_status", { p_tenant: ctx.tenant.id }),
    supabase.rpc("plan_usage", { p_tenant: ctx.tenant.id }),
    supabase.from("modules").select("code, name").order("code"),
  ]);

  const plan = Array.isArray(sub?.plans) ? sub?.plans[0] : sub?.plans;

  return (
    <>
      <PageHeader title="Plano" subtitle="Assinatura, módulos e limites da organização." />
      <div className="space-y-6">
        <Card title="Assinatura">
          <dl className="grid gap-2 text-sm sm:grid-cols-3">
            <div>
              <dt className="text-zinc-400">Plano</dt>
              <dd>{plan?.name ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-zinc-400">Situação</dt>
              <dd>
                <Badge tone={STATUS_TONE[status as string] ?? "muted"}>{STATUS_LABEL[status as string] ?? "—"}</Badge>
              </dd>
            </div>
            <div>
              <dt className="text-zinc-400">Válida até</dt>
              <dd>
                {sub?.current_period_end ? new Date(sub.current_period_end).toLocaleDateString("pt-BR") : "Sem data"}
              </dd>
            </div>
          </dl>
          <p className="mt-4 text-xs text-zinc-500">Para alterar o plano, fale com o suporte da plataforma.</p>
        </Card>

        <Card title="Módulos">
          <ul className="divide-y divide-zinc-800 text-sm">
            {(modules ?? []).map((m) => (
              <li key={m.code} className="flex justify-between py-2">
                <span>{m.name}</span>
                <Badge tone={ctx.modules.includes(m.code) ? "ok" : "muted"}>
                  {ctx.modules.includes(m.code) ? "Incluído" : "Não incluído"}
                </Badge>
              </li>
            ))}
          </ul>
        </Card>

        <Card title="Limites">
          <ul className="divide-y divide-zinc-800 text-sm">
            {(usage ?? []).map((u: { key: string; used: number; limit: number | null }) => (
              <li key={u.key} className="py-3">
                <div className="flex justify-between">
                  <span>{LIMIT_LABEL[u.key] ?? u.key}</span>
                  <span className="text-zinc-300">
                    {u.used} {u.limit === null ? "(sem limite)" : `de ${u.limit}`}
                  </span>
                </div>
                {u.limit !== null && (
                  <div className="arena-meter mt-2" aria-hidden>
                    <span style={{ width: `${Math.min(100, Math.round((u.used / Math.max(u.limit, 1)) * 100))}%` }} />
                  </div>
                )}
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </>
  );
}
