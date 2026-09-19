import { type Bracket } from "@/app/_lib/chaveamento";

type BracketMatch = Bracket["rounds"][number]["matches"][number];

function MatchNode({ match, isFinalRound }: { match: BracketMatch; isFinalRound: boolean }) {
  return (
    <div className="relative min-w-[240px]">
      <div className="relative space-y-3">
        {([match.top, match.bottom] as const).map((slot, index) => {
          const isWinner = match.winnerSide === (index === 0 ? "top" : "bottom");
          const isEmpty = slot.athlete === null;

          return (
            <div key={`${match.id}-${index}`} className="relative">
              <div
                className={`rounded-2xl border px-4 py-3 shadow-[0_10px_35px_rgba(0,0,0,0.35)] ${
                  isWinner
                    ? "border-emerald-500 bg-emerald-950/40"
                    : isEmpty
                      ? "border-dashed border-zinc-800 bg-zinc-950/40"
                      : "border-zinc-700 bg-zinc-950/90"
                }`}
              >
                <div
                  className={`truncate text-sm font-medium ${
                    isEmpty ? "italic text-zinc-600" : "text-zinc-100"
                  }`}
                >
                  {slot.label}
                </div>
              </div>

              {!isFinalRound ? (
                <div className="absolute -right-4 top-1/2 h-px w-4 -translate-y-1/2 bg-zinc-700" />
              ) : null}
            </div>
          );
        })}

        {!isFinalRound ? (
          <>
            <div className="absolute -right-4 top-[25%] h-[50%] w-px bg-zinc-700" />
            <div className="absolute -right-12 top-1/2 h-px w-8 -translate-y-1/2 bg-zinc-700" />
          </>
        ) : null}
      </div>

      <div className="mt-2 text-center text-[11px] uppercase tracking-[0.24em] text-zinc-500">
        Luta {match.number}
      </div>
    </div>
  );
}

export default function BracketVisualization({
  bracket,
  athletesCount,
}: {
  bracket: Bracket;
  athletesCount: number;
}) {
  const champion = bracket.rounds.at(-1)?.matches[0]?.resolvedWinner ?? null;

  return (
    <div className="rounded-[28px] border border-zinc-800 bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.08),_transparent_45%),linear-gradient(180deg,_rgba(24,24,27,0.94),_rgba(9,9,11,0.98))] p-5">
      <div className="mb-6 flex flex-col gap-3 border-b border-zinc-800 pb-4 text-center">
        <div className="text-[11px] uppercase tracking-[0.35em] text-zinc-500">Carvalho BJJ</div>
        <div className="text-2xl font-semibold text-zinc-50">{bracket.name}</div>
        <div className="text-sm text-zinc-400">{bracket.description}</div>
        <div className="text-xs uppercase tracking-[0.24em] text-zinc-500">
          {athletesCount} atletas selecionados
        </div>
        {champion ? (
          <div className="mx-auto rounded-full border border-emerald-500/60 bg-emerald-950/40 px-4 py-1 text-sm text-emerald-300">
            Campeão: {champion.nome}
          </div>
        ) : null}
      </div>

      <div className="overflow-x-auto pb-2">
        <div className="flex min-w-max items-start gap-12 px-2">
          {bracket.rounds.map((round, roundIndex) => {
            const gap = roundIndex === 0 ? 16 : Math.pow(2, roundIndex) * 28;
            const paddingTop = roundIndex === 0 ? 0 : Math.pow(2, roundIndex - 1) * 28;

            return (
              <div
                key={`${bracket.id}-${round.title}-${roundIndex}`}
                className="flex min-w-[240px] flex-col"
                style={{ paddingTop }}
              >
                <div className="mb-4 text-center text-xs uppercase tracking-[0.28em] text-zinc-500">
                  {round.title}
                </div>

                <div className="flex flex-col" style={{ rowGap: gap }}>
                  {round.matches.map((match) => (
                    <MatchNode
                      key={match.id}
                      match={match}
                      isFinalRound={roundIndex === bracket.rounds.length - 1}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
