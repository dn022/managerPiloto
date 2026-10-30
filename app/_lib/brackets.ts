// Chaves de eliminação simples, independentes de modalidade.
// Estado persistido: `slots` (ids de inscrição por posição) + `winners` (lado vencedor por rodada/luta).
// As rodadas são sempre recalculadas a partir desse estado.

export type Participant = {
  id: string;
  name: string;
  team: string | null;
};

export type MatchSide = "top" | "bottom";
export type WinnerSelections = Array<Array<MatchSide | null>>;

export type Entrant = { participant: Participant | null; label: string };

export type Match = {
  id: string;
  number: number;
  roundIndex: number;
  matchIndex: number;
  top: Entrant;
  bottom: Entrant;
  winnerSide: MatchSide | null;
  winner: Participant | null;
  loser: Participant | null;
};

export type Round = { title: string; matches: Match[] };

function roundTitle(matchCount: number) {
  if (matchCount <= 1) return "Final";
  if (matchCount === 2) return "Semifinal";
  if (matchCount === 4) return "Quartas";
  if (matchCount === 8) return "Oitavas";
  return `Rodada de ${matchCount * 2}`;
}

export function emptyWinners(slotCount: number): WinnerSelections {
  const rounds: WinnerSelections = [];
  let entrants = slotCount;
  while (entrants > 1) {
    const matches = Math.floor(entrants / 2);
    rounds.push(Array.from({ length: matches }, () => null));
    entrants = matches + (entrants % 2);
  }
  return rounds;
}

// Distribui os inscritos para que colegas de equipe não se enfrentem na 1ª rodada, quando possível.
export function seedSlots(participants: Participant[]): string[] {
  const byTeam = new Map<string, Participant[]>();
  for (const p of participants) {
    const key = p.team?.trim().toLowerCase() || `__solo_${p.id}`;
    byTeam.set(key, [...(byTeam.get(key) ?? []), p]);
  }
  const queues = [...byTeam.values()].sort((a, b) => b.length - a.length);
  const interleaved: Participant[] = [];
  while (queues.some((queue) => queue.length > 0)) {
    for (const queue of queues) {
      const next = queue.shift();
      if (next) interleaved.push(next);
    }
  }
  return interleaved.map((p) => p.id);
}

export function buildRounds(
  slots: Array<string | null>,
  participants: Map<string, Participant>,
  winners: WinnerSelections
): Round[] {
  if (slots.length < 2) return [];

  let current: Entrant[] = slots.map((id, index) => {
    const participant = id ? (participants.get(id) ?? null) : null;
    const carry = slots.length % 2 === 1 && index === slots.length - 1;
    return {
      participant,
      label: participant?.name ?? (carry ? "Classificado direto" : "Aguardando atleta"),
    };
  });

  const rounds: Round[] = [];
  let number = 1;
  let roundIndex = 0;

  while (current.length > 1) {
    const matchCount = Math.floor(current.length / 2);
    const hasCarry = current.length % 2 === 1;
    const matches: Match[] = [];
    const next: Entrant[] = [];

    for (let matchIndex = 0; matchIndex < matchCount; matchIndex += 1) {
      const top = current[matchIndex * 2];
      const bottom = current[matchIndex * 2 + 1];
      const picked = winners[roundIndex]?.[matchIndex] ?? null;
      const winnerSide =
        picked === "top" && top.participant
          ? "top"
          : picked === "bottom" && bottom.participant
            ? "bottom"
            : null;
      const winner = winnerSide === "top" ? top.participant : winnerSide === "bottom" ? bottom.participant : null;
      const loser = winnerSide === "top" ? bottom.participant : winnerSide === "bottom" ? top.participant : null;

      const match: Match = {
        id: `r${roundIndex}-m${matchIndex}`,
        number: number++,
        roundIndex,
        matchIndex,
        top,
        bottom,
        winnerSide,
        winner,
        loser,
      };
      matches.push(match);
      next.push({ participant: winner, label: winner?.name ?? `Vencedor da luta ${match.number}` });
    }

    if (hasCarry) next.push(current[current.length - 1]);

    rounds.push({ title: roundTitle(matchCount), matches });
    current = next;
    roundIndex += 1;
  }

  return rounds;
}

export function championOf(rounds: Round[]): Participant | null {
  return rounds.at(-1)?.matches[0]?.winner ?? null;
}

// 1º = campeão, 2º = perdedor da final, 3º = perdedores das semifinais (empate no 3º).
export function placementsOf(rounds: Round[]): Array<{ participantId: string; placement: number }> {
  const final = rounds.at(-1)?.matches[0];
  if (!final?.winner || !final.loser) return [];

  const result = [
    { participantId: final.winner.id, placement: 1 },
    { participantId: final.loser.id, placement: 2 },
  ];

  if (rounds.length >= 2) {
    for (const match of rounds[rounds.length - 2].matches) {
      if (match.loser) result.push({ participantId: match.loser.id, placement: 3 });
    }
  }
  return result;
}

// Ao trocar os inscritos da chave, vencedores antigos deixam de valer.
export function sanitizeWinners(slotCount: number, winners: unknown): WinnerSelections {
  const shape = emptyWinners(slotCount);
  if (!Array.isArray(winners)) return shape;
  return shape.map((round, r) =>
    round.map((_, m) => {
      const value = (winners as unknown[][])[r]?.[m];
      return value === "top" || value === "bottom" ? value : null;
    })
  );
}
