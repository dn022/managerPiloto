import Link from "next/link";
import { ArrowLeft, Medal, Trophy } from "lucide-react";

import { hydrateBrackets, type Athlete, type Bracket } from "@/app/_lib/chaveamento";
import { syncStoredBracketsWithParticipants } from "@/app/_lib/chaveamento-server";

export const dynamic = "force-dynamic";

type CompletedFight = {
  id: string;
  number: number;
  bracketName: string;
  categoryLabel: string;
  roundTitle: string;
  winner: Athlete;
  opponent: Athlete;
};

type TeamScore = {
  name: string;
  victories: number;
  champions: number;
  finalists: number;
};

function normalizeTeamName(value: string | null | undefined) {
  const team = value?.trim();
  return team || "Sem equipe";
}

function getCompletedFights(brackets: Bracket[]) {
  return brackets.flatMap((bracket) =>
    bracket.rounds.flatMap((round) =>
      round.matches
        .filter((match) => match.top.athlete && match.bottom.athlete && match.resolvedWinner)
        .map((match) => {
          const opponent =
            match.resolvedWinner?.id === match.top.athlete?.id
              ? match.bottom.athlete
              : match.top.athlete;

          return {
            id: `${bracket.id}-${round.title}-${match.number}`,
            number: match.number,
            bracketName: bracket.name,
            categoryLabel: bracket.metadata.categoryLabel,
            roundTitle: round.title,
            winner: match.resolvedWinner as Athlete,
            opponent: opponent as Athlete,
          };
        })
    )
  );
}

function addTeamScore(scores: Map<string, TeamScore>, teamName: string, field: keyof Omit<TeamScore, "name">) {
  const score = scores.get(teamName) ?? {
    name: teamName,
    victories: 0,
    champions: 0,
    finalists: 0,
  };

  score[field] += 1;
  scores.set(teamName, score);
}

function getTeamScores(brackets: Bracket[], fights: CompletedFight[]) {
  const scores = new Map<string, TeamScore>();

  for (const fight of fights) {
    addTeamScore(scores, normalizeTeamName(fight.winner.academy), "victories");
  }

  for (const bracket of brackets) {
    const finalMatch = bracket.rounds.at(-1)?.matches[0];
    if (!finalMatch?.top.athlete || !finalMatch.bottom.athlete) continue;

    addTeamScore(scores, normalizeTeamName(finalMatch.top.athlete.academy), "finalists");
    addTeamScore(scores, normalizeTeamName(finalMatch.bottom.athlete.academy), "finalists");

    if (finalMatch.resolvedWinner) {
      addTeamScore(scores, normalizeTeamName(finalMatch.resolvedWinner.academy), "champions");
    }
  }

  return Array.from(scores.values()).sort((left, right) => {
    if (right.victories !== left.victories) return right.victories - left.victories;
    if (right.champions !== left.champions) return right.champions - left.champions;
    if (right.finalists !== left.finalists) return right.finalists - left.finalists;
    return left.name.localeCompare(right.name, "pt-BR");
  });
}

export default async function PontuacoesPage() {
  const { athletes, brackets: storedBrackets } = await syncStoredBracketsWithParticipants();
  const athletesById = new Map(athletes.map((athlete) => [athlete.id, athlete]));
  const brackets = hydrateBrackets(storedBrackets, athletesById);
  const fights = getCompletedFights(brackets).sort((left, right) => left.number - right.number);
  const teamScores = getTeamScores(brackets, fights);

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

        <section className="mb-8 rounded-3xl border border-zinc-800 bg-zinc-950/70 p-6 backdrop-blur">
          <div className="text-xs uppercase tracking-[0.35em] text-yellow-300">Carvalho BJJ</div>
          <h1 className="mt-2 text-3xl font-semibold text-zinc-50">Pontuações</h1>
          <p className="mt-2 max-w-3xl text-sm text-zinc-400">
            Lutas finalizadas com vencedores definidos no chaveamento e classificação das equipes por vitórias.
          </p>
        </section>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(360px,0.65fr)]">
          <section className="overflow-hidden rounded-3xl border border-zinc-800 bg-zinc-950/60">
            <div className="grid grid-cols-2 border-b border-zinc-800 text-center text-sm font-semibold uppercase tracking-[0.24em]">
              <div className="border-b-2 border-yellow-300 py-4 text-yellow-300">Lutas</div>
              <div className="py-4 text-zinc-400">Vencedores</div>
            </div>

            <div className="space-y-3 p-3">
              {fights.length === 0 ? (
                <div className="rounded-2xl border border-zinc-800 bg-black/40 p-8 text-center text-zinc-400">
                  Nenhuma luta finalizada até o momento.
                </div>
              ) : (
                fights.map((fight) => (
                  <article
                    key={fight.id}
                    className="rounded-2xl border-l-4 border-emerald-500 bg-zinc-900/70 p-4"
                  >
                    <div className="flex flex-col gap-2 border-b border-zinc-800 pb-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="text-sm font-bold text-yellow-300">#{fight.number}</div>
                      <div className="text-xs text-zinc-400">{fight.categoryLabel} • {fight.roundTitle}</div>
                      <div className="rounded-md bg-emerald-600 px-2 py-1 text-[10px] font-bold uppercase text-white">
                        Finalizada
                      </div>
                    </div>

                    <div className="mt-4 grid gap-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
                      <div>
                        <div className="text-lg font-bold text-emerald-400">{fight.winner.nome}</div>
                        <div className="mt-1 text-xs italic text-zinc-300">
                          {normalizeTeamName(fight.winner.academy)}
                        </div>
                        <div className="mt-3 text-sm font-semibold text-zinc-100">{fight.opponent.nome}</div>
                        <div className="mt-1 text-xs italic text-zinc-400">
                          {normalizeTeamName(fight.opponent.academy)}
                        </div>
                      </div>

                      <div className="text-right">
                        <div className="text-[11px] uppercase tracking-[0.2em] text-zinc-500">Vitória</div>
                        <div className="text-3xl font-bold text-white">1</div>
                      </div>
                    </div>
                  </article>
                ))
              )}
            </div>
          </section>

          <aside className="overflow-hidden rounded-3xl border border-zinc-800 bg-zinc-950/60">
            <div className="border-b border-zinc-800 py-4 text-center text-sm font-semibold uppercase tracking-[0.24em] text-yellow-300">
              Equipes
            </div>

            <div className="space-y-3 p-3">
              {teamScores.length === 0 ? (
                <div className="rounded-2xl border border-zinc-800 bg-black/40 p-8 text-center text-zinc-400">
                  Nenhuma equipe pontuou ainda.
                </div>
              ) : (
                teamScores.map((team, index) => (
                  <article key={team.name} className="rounded-2xl bg-zinc-900/70 p-4">
                    <div className="flex items-start gap-3">
                      <div className="pt-1 text-lg font-bold text-yellow-300">{index + 1}º</div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          {index === 0 ? <Trophy className="h-4 w-4 text-yellow-300" /> : <Medal className="h-4 w-4 text-zinc-500" />}
                          <h2 className="truncate font-bold text-zinc-50">{team.name}</h2>
                        </div>
                        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
                          <span className="text-zinc-300">
                            Vitórias: <strong className="text-emerald-400">{team.victories}</strong>
                          </span>
                          <span className="text-zinc-300">
                            Campeões: <strong className="text-yellow-300">{team.champions}</strong>
                          </span>
                          <span className="text-zinc-300">
                            Finalistas: <strong className="text-orange-400">{team.finalists}</strong>
                          </span>
                        </div>
                      </div>
                    </div>
                  </article>
                ))
              )}
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}
