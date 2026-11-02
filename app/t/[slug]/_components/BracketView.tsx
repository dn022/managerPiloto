import type { Match, Participant, Round } from "@/app/_lib/brackets";

function MatchNode({
  match,
  isFinalRound,
  actions,
}: {
  match: Match;
  isFinalRound: boolean;
  actions?: React.ReactNode;
}) {
  return (
    <div className="relative min-w-[240px]">
      <div className="relative space-y-3">
        {([match.top, match.bottom] as const).map((slot, index) => {
          const isWinner = match.winnerSide === (index === 0 ? "top" : "bottom");
          const isEmpty = slot.participant === null;
          return (
            <div key={`${match.id}-${index}`} className="relative">
              <div
                className={`rounded-2xl border px-4 py-3 ${
                  isWinner
                    ? "border-emerald-500 bg-emerald-950/40"
                    : isEmpty
                      ? "border-dashed border-zinc-800 bg-zinc-950/40"
                      : "border-zinc-700 bg-zinc-950/90"
                }`}
              >
                <div className={`truncate text-sm font-medium ${isEmpty ? "italic text-zinc-600" : "text-zinc-100"}`}>
                  {slot.label}
                </div>
                {slot.participant?.team && (
                  <div className="truncate text-xs text-zinc-500">{slot.participant.team}</div>
                )}
              </div>
              {!isFinalRound && <div className="absolute -right-4 top-1/2 h-px w-4 -translate-y-1/2 bg-zinc-700" />}
            </div>
          );
        })}
        {!isFinalRound && (
          <>
            <div className="absolute -right-4 top-[25%] h-[50%] w-px bg-zinc-700" />
            <div className="absolute -right-12 top-1/2 h-px w-8 -translate-y-1/2 bg-zinc-700" />
          </>
        )}
      </div>
      <div className="mt-2 text-center text-[11px] uppercase tracking-[0.24em] text-zinc-500">
        Luta {match.number}
      </div>
      {actions && <div className="mt-2 flex justify-center gap-2">{actions}</div>}
    </div>
  );
}

export default function BracketView({
  name,
  rounds,
  champion,
  renderActions,
}: {
  name: string;
  rounds: Round[];
  champion: Participant | null;
  renderActions?: (match: Match) => React.ReactNode;
}) {
  return (
    <div className="rounded-[28px] border border-zinc-800 bg-zinc-950/70 p-5">
      <div className="mb-6 flex flex-col gap-2 border-b border-zinc-800 pb-4 text-center">
        <div className="text-xl font-semibold text-zinc-50">{name}</div>
        {champion && (
          <div className="mx-auto rounded-full border border-emerald-500/60 bg-emerald-950/40 px-4 py-1 text-sm text-emerald-300">
            Campeão: {champion.name}
          </div>
        )}
      </div>

      <div className="overflow-x-auto pb-2">
        <div className="flex min-w-max items-start gap-12 px-2">
          {rounds.map((round, roundIndex) => {
            const gap = roundIndex === 0 ? 16 : Math.pow(2, roundIndex) * 28;
            const paddingTop = roundIndex === 0 ? 0 : Math.pow(2, roundIndex - 1) * 28;
            return (
              <div key={`${round.title}-${roundIndex}`} className="flex min-w-[240px] flex-col" style={{ paddingTop }}>
                <div className="mb-4 text-center text-xs uppercase tracking-[0.28em] text-zinc-500">
                  {round.title}
                </div>
                <div className="flex flex-col" style={{ rowGap: gap }}>
                  {round.matches.map((match) => (
                    <MatchNode
                      key={match.id}
                      match={match}
                      isFinalRound={roundIndex === rounds.length - 1}
                      actions={renderActions?.(match)}
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
