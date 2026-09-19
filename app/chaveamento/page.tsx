import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import PublicBracketAccordion from "@/app/_components/chaveamento/PublicBracketAccordion";
import { syncStoredBracketsWithParticipants } from "@/app/_lib/chaveamento-server";
import { hydrateBrackets, type Bracket } from "@/app/_lib/chaveamento";

export const dynamic = "force-dynamic";

export default async function PublicChaveamentoPage() {
  const { athletes, brackets: storedBrackets } = await syncStoredBracketsWithParticipants();
  const athletesById = new Map(athletes.map((athlete) => [athlete.id, athlete]));
  const brackets = hydrateBrackets(storedBrackets, athletesById);

  const groups = Array.from(
    brackets.reduce((acc, bracket) => {
      const categoryLabel = bracket.metadata.categoryLabel || "Outras chaves";
      const current = acc.get(categoryLabel) ?? [];
      current.push(bracket);
      acc.set(categoryLabel, current);
      return acc;
    }, new Map<string, Bracket[]>())
  )
    .sort(([left], [right]) => left.localeCompare(right, "pt-BR"))
    .map(([categoryLabel, categoryBrackets]) => ({
      categoryLabel,
      brackets: categoryBrackets,
      athletesCountByBracketId: Object.fromEntries(
        categoryBrackets.map((bracket) => [
          bracket.id,
          bracket.athleteIds.filter((id) => athletesById.has(id)).length,
        ])
      ),
    }));

  return (
    <div className="min-h-screen bg-black text-zinc-100">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(220,38,38,0.18),_transparent_30%),linear-gradient(180deg,_rgba(9,9,11,0.9),_rgba(0,0,0,1))]" />

      <main className="relative container mx-auto px-4 py-10">
        <Link
          href="/"
          className="mb-6 inline-flex h-11 w-11 items-center justify-center rounded-full border border-zinc-800 bg-zinc-950/70 text-zinc-100 transition hover:border-zinc-700 hover:bg-zinc-900"
          aria-label="Voltar para home"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>

        <div className="mb-8 rounded-3xl border border-zinc-800 bg-zinc-950/70 p-6 backdrop-blur">
          <div className="text-xs uppercase tracking-[0.35em] text-zinc-500">Consulta pública</div>
          <h1 className="mt-2 text-3xl font-semibold text-zinc-50">Chaveamento</h1>
          <p className="mt-2 max-w-2xl text-sm text-zinc-400">
            Visualização somente leitura das chaves, separadas por categoria, com expansão individual de cada grupo.
          </p>
        </div>

        {brackets.length === 0 ? (
          <section className="rounded-3xl border border-zinc-800 bg-zinc-950/70 p-10 text-center text-zinc-400">
            Nenhum chaveamento publicado até o momento.
          </section>
        ) : (
          <PublicBracketAccordion groups={groups} />
        )}
      </main>
    </div>
  );
}
