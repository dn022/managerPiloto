import ArenaBackground from "@/app/_components/ArenaBackground";
import { Button } from "@/app/_components/ui/button";
import { updateSubscription } from "@/app/_lib/actions/platform";
import { requirePlatformAdmin } from "@/app/_lib/session";
import { createClient } from "@/app/_lib/supabase/server";
import CreateTenantForm from "./CreateTenantForm";

const STATUSES = [
  ["trial", "Teste"],
  ["active", "Ativa"],
  ["past_due", "Em atraso (carência)"],
  ["cancelled", "Cancelada"],
];
const selectClass = "h-9 rounded-md border border-zinc-800 bg-black/40 px-2 text-sm text-zinc-100";

export default async function PlatformPage({ searchParams }: { searchParams: Promise<{ erro?: string }> }) {
  const { erro } = await searchParams;
  await requirePlatformAdmin();
  const supabase = await createClient();

  const [{ data: tenants }, { data: plans }, { data: modules }, { data: overrides }] = await Promise.all([
    supabase
      .from("tenants")
      .select("id, name, slug, status, created_at, tenant_subscriptions(plan_code, status, current_period_end)")
      .order("created_at", { ascending: false }),
    supabase.from("plans").select("code, name").eq("active", true),
    supabase.from("modules").select("code, name").order("code"),
    supabase.from("tenant_modules").select("tenant_id, module_code, enabled"),
  ]);

  return (
    <div className="arena-shell">
      <ArenaBackground />
      <div className="arena-content mx-auto max-w-4xl space-y-8 px-4 py-10">
      <h1 className="text-2xl font-semibold">Plataforma</h1>
      {erro && <div className="rounded-xl border border-red-900/50 bg-red-950/40 px-3 py-2 text-sm text-red-200">{erro}</div>}

      <section className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-5">
        <h2 className="mb-4 text-lg font-medium">Nova arena</h2>
        <CreateTenantForm plans={plans ?? []} />
      </section>

      <section className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-5">
        <h2 className="mb-4 text-lg font-medium">Arenas ({tenants?.length ?? 0})</h2>
        <ul className="divide-y divide-zinc-800 text-sm">
          {(tenants ?? []).map((t) => {
            const sub = Array.isArray(t.tenant_subscriptions)
              ? t.tenant_subscriptions[0]
              : t.tenant_subscriptions;
            return (
              <li key={t.id} className="py-3">
                <div className="flex justify-between">
                  <span>
                    {t.name} <span className="text-zinc-500">/{t.slug}</span>
                  </span>
                  <span className="text-zinc-400">
                    {sub?.plan_code ?? "-"} · {sub?.status ?? "-"}
                  </span>
                </div>
                <details className="mt-2">
                  <summary className="cursor-pointer text-xs text-zinc-500">Assinatura e módulos</summary>
                  <form action={updateSubscription} className="mt-3 flex flex-wrap items-end gap-3">
                    <input type="hidden" name="tenant_id" value={t.id} />
                    <label className="space-y-1 text-xs text-zinc-400">
                      Plano
                      <select name="plan" defaultValue={sub?.plan_code} className={`${selectClass} block`}>
                        {(plans ?? []).map((p) => (
                          <option key={p.code} value={p.code}>{p.name}</option>
                        ))}
                      </select>
                    </label>
                    <label className="space-y-1 text-xs text-zinc-400">
                      Status
                      <select name="status" defaultValue={sub?.status} className={`${selectClass} block`}>
                        {STATUSES.map(([v, l]) => (
                          <option key={v} value={v}>{l}</option>
                        ))}
                      </select>
                    </label>
                    <label className="space-y-1 text-xs text-zinc-400">
                      Válida até
                      <input
                        type="date"
                        name="period_end"
                        defaultValue={sub?.current_period_end?.slice(0, 10) ?? ""}
                        className={`${selectClass} block`}
                      />
                    </label>
                    {(modules ?? []).map((m) => {
                      const o = (overrides ?? []).find((x) => x.tenant_id === t.id && x.module_code === m.code);
                      return (
                        <label key={m.code} className="space-y-1 text-xs text-zinc-400">
                          {m.name}
                          <select
                            name={`module:${m.code}`}
                            defaultValue={o ? (o.enabled ? "on" : "off") : ""}
                            className={`${selectClass} block`}
                          >
                            <option value="">Conforme o plano</option>
                            <option value="on">Ligado</option>
                            <option value="off">Desligado</option>
                          </select>
                        </label>
                      );
                    })}
                    <Button type="submit" size="sm">Salvar</Button>
                  </form>
                </details>
              </li>
            );
          })}
        </ul>
      </section>
      </div>
    </div>
  );
}
