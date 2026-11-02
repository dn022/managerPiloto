import { notFound } from "next/navigation";

import { Button } from "@/app/_components/ui/button";
import { generateBracket, setWinner } from "@/app/_lib/actions/championships";
import {
  buildRounds,
  championOf,
  sanitizeWinners,
  type Participant,
} from "@/app/_lib/brackets";
import { requireTenant } from "@/app/_lib/session";
import { createClient } from "@/app/_lib/supabase/server";
import BracketView from "../../../_components/BracketView";
import { Card, ErrorBanner } from "../../../_components/ui";
import ChampionshipHeader from "../../_components/ChampionshipHeader";

export default async function ChavesPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string; id: string }>;
  searchParams: Promise<{ erro?: string }>;
}) {
  const { slug, id } = await params;
  const { erro } = await searchParams;
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

  const [{ data: categories }, { data: brackets }, { data: regs }, { data: confirmed }] = await Promise.all([
    supabase.from("championship_categories").select("id, name").eq("championship_id", id).order("name"),
    supabase.from("championship_brackets").select("id, category_id, name, slots, winners").eq("championship_id", id).order("name"),
    supabase.from("championship_registrations").select("id, name, team").eq("championship_id", id),
    supabase
      .from("championship_registrations")
      .select("category_id")
      .eq("championship_id", id)
      .eq("status", "confirmed"),
  ]);

  const participants = new Map((regs ?? []).map((r) => [r.id as string, r as Participant]));
  const confirmedByCategory = new Map<string, number>();
  for (const r of confirmed ?? []) {
    if (r.category_id) confirmedByCategory.set(r.category_id, (confirmedByCategory.get(r.category_id) ?? 0) + 1);
  }
  const bracketByCategory = new Map((brackets ?? []).map((b) => [b.category_id, b]));

  return (
    <>
      <ChampionshipHeader
        slug={slug}
        id={id}
        name={champ.name}
        status={champ.status}
        eventDate={champ.event_date}
        active="/chaves"
        canSeeFinance={ctx.permissions.includes("payments.read")}
      />
      <ErrorBanner message={erro} />

      <Card title="Categorias" className="mb-6">
        <ul className="divide-y divide-zinc-800 text-sm">
          {(categories ?? []).map((c) => {
            const count = confirmedByCategory.get(c.id) ?? 0;
            const existing = bracketByCategory.get(c.id);
            return (
              <li key={c.id} className="flex items-center justify-between py-2">
                <div>
                  <div>{c.name}</div>
                  <div className="text-xs text-zinc-500">
                    {count} inscrição(ões) confirmada(s) · {existing ? "chave criada" : "sem chave"}
                  </div>
                </div>
                {canWrite && (
                  <form action={generateBracket}>
                    <input type="hidden" name="slug" value={slug} />
                    <input type="hidden" name="championship_id" value={id} />
                    <input type="hidden" name="category_id" value={c.id} />
                    <Button type="submit" variant="secondary" size="sm" disabled={count < 2}>
                      {existing ? "Refazer chave" : "Gerar chave"}
                    </Button>
                  </form>
                )}
              </li>
            );
          })}
          {!categories?.length && <li className="py-2 text-zinc-500">Configure categorias na visão geral.</li>}
        </ul>
      </Card>

      <div className="space-y-8">
        {(brackets ?? []).map((b) => {
          const slots = b.slots as Array<string | null>;
          const winners = sanitizeWinners(slots.length, b.winners);
          const rounds = buildRounds(slots, participants, winners);
          return (
            <BracketView
              key={b.id}
              name={b.name}
              rounds={rounds}
              champion={championOf(rounds)}
              renderActions={
                canWrite
                  ? (match) =>
                      match.top.participant && match.bottom.participant
                        ? (["top", "bottom"] as const).map((side) => (
                            <form key={side} action={setWinner}>
                              <input type="hidden" name="slug" value={slug} />
                              <input type="hidden" name="championship_id" value={id} />
                              <input type="hidden" name="id" value={b.id} />
                              <input type="hidden" name="round" value={match.roundIndex} />
                              <input type="hidden" name="match" value={match.matchIndex} />
                              <input type="hidden" name="side" value={match.winnerSide === side ? "" : side} />
                              <Button
                                type="submit"
                                size="sm"
                                variant={match.winnerSide === side ? "default" : "outline"}
                                className="h-7 text-xs"
                              >
                                {side === "top" ? "Venceu ↑" : "Venceu ↓"}
                              </Button>
                            </form>
                          ))
                        : null
                  : undefined
              }
            />
          );
        })}
        {!brackets?.length && <p className="text-sm text-zinc-500">Nenhuma chave gerada.</p>}
      </div>
    </>
  );
}
