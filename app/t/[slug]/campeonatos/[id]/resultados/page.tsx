import { notFound } from "next/navigation";

import { Button } from "@/app/_components/ui/button";
import { publishToRanking, saveResultsFromBrackets } from "@/app/_lib/actions/championships";
import { requireTenant } from "@/app/_lib/session";
import { createClient } from "@/app/_lib/supabase/server";
import { Card, ErrorBanner } from "../../../_components/ui";
import ChampionshipHeader from "../../_components/ChampionshipHeader";

const one = <T,>(v: T | T[] | null): T | null => (Array.isArray(v) ? (v[0] ?? null) : v);

export default async function ResultadosPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string; id: string }>;
  searchParams: Promise<{ erro?: string; publicou?: string }>;
}) {
  const { slug, id } = await params;
  const { erro, publicou } = await searchParams;
  const ctx = await requireTenant(slug, undefined, "championships");
  const canWrite = ctx.permissions.includes("championships.write");
  const canPublish = canWrite && ctx.permissions.includes("rankings.write") && ctx.modules.includes("ranking");

  const supabase = await createClient();
  const { data: champ } = await supabase
    .from("championships")
    .select("id, name, status, event_date, ranking_id, results_published_at, rankings(name, season)")
    .eq("tenant_id", ctx.tenant.id)
    .eq("id", id)
    .maybeSingle();
  if (!champ) notFound();

  const [{ data: results }, { data: categories }, { data: rules }] = await Promise.all([
    supabase
      .from("championship_results")
      .select("category_id, placement, championship_registrations(name, team)")
      .eq("championship_id", id)
      .order("placement"),
    supabase.from("championship_categories").select("id, name").eq("championship_id", id).order("name"),
    supabase.from("championship_points_rules").select("placement, points").eq("championship_id", id),
  ]);

  const pointsByPlacement = new Map((rules ?? []).map((r) => [r.placement, r.points]));
  const ranking = one(champ.rankings as { name: string; season: string } | { name: string; season: string }[] | null);

  return (
    <>
      <ChampionshipHeader
        slug={slug}
        id={id}
        name={champ.name}
        status={champ.status}
        eventDate={champ.event_date}
        active="/resultados"
        canSeeFinance={ctx.permissions.includes("payments.read")}
      />
      <ErrorBanner message={erro} />
      {publicou !== undefined && (
        <div className="mb-4 rounded-xl border border-emerald-900/50 bg-emerald-950/40 px-3 py-2 text-sm text-emerald-200">
          {publicou} lançamento(s) de pontos criado(s) no ranking.
        </div>
      )}

      {canWrite && (
        <div className="mb-6 flex flex-wrap items-center gap-3">
          <form action={saveResultsFromBrackets}>
            <input type="hidden" name="slug" value={slug} />
            <input type="hidden" name="championship_id" value={id} />
            <Button type="submit">Calcular resultados a partir das chaves</Button>
          </form>
          {canPublish && champ.ranking_id && (
            <form action={publishToRanking}>
              <input type="hidden" name="slug" value={slug} />
              <input type="hidden" name="championship_id" value={id} />
              <Button type="submit" variant="secondary">
                Enviar pontos ao ranking{ranking ? ` (${ranking.name} · ${ranking.season})` : ""}
              </Button>
            </form>
          )}
        </div>
      )}
      {champ.results_published_at && (
        <p className="mb-4 text-xs text-zinc-500">
          Último envio ao ranking: {new Date(champ.results_published_at).toLocaleString("pt-BR")}
        </p>
      )}

      <div className="space-y-4">
        {[...(categories ?? []), { id: null as string | null, name: "Sem categoria" }].map((cat) => {
          const list = (results ?? []).filter((r) => r.category_id === cat.id);
          if (!list.length) return null;
          return (
            <Card key={cat.id ?? "none"} title={cat.name}>
              <ol className="divide-y divide-zinc-800 text-sm">
                {list.map((r, i) => {
                  const person = one(
                    r.championship_registrations as
                      | { name: string; team: string | null }
                      | { name: string; team: string | null }[]
                      | null
                  );
                  const pts = pointsByPlacement.get(r.placement);
                  return (
                    <li key={i} className="flex items-center justify-between py-2">
                      <span>
                        <span className="mr-3 text-zinc-500">{r.placement}º</span>
                        {person?.name}
                        {person?.team ? <span className="ml-2 text-xs text-zinc-500">{person.team}</span> : null}
                      </span>
                      {champ.ranking_id && pts !== undefined && <span className="text-zinc-400">{pts} pts</span>}
                    </li>
                  );
                })}
              </ol>
            </Card>
          );
        })}
        {!results?.length && <p className="text-sm text-zinc-500">Nenhum resultado calculado ainda.</p>}
      </div>
    </>
  );
}
