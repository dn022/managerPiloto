import {
  AUTOMATIC_BRACKET_RULES,
  FESTIVAL_BRACKET_RULE,
  genderLabel,
  type AutomaticBracketRule,
} from "@/app/_lib/chaveamento-rules";
import { getCategoryLabel } from "@/app/_lib/types";

export type Athlete = {
  id: string;
  nome: string;
  academy?: string | null;
  idade: number;
  peso: number | null;
  faixa: string;
  categoria: string | null;
  sexo: "M" | "F" | null;
  festival: boolean;
  status: string;
};

export type MatchSide = "top" | "bottom";

export type BracketSlot = {
  athlete: Athlete | null;
  label: string;
};

export type BracketMatch = {
  id: string;
  number: number;
  roundIndex: number;
  top: BracketSlot;
  bottom: BracketSlot;
  winnerSide: MatchSide | null;
  resolvedWinner: Athlete | null;
};

export type BracketRound = {
  title: string;
  matches: BracketMatch[];
};

export type BracketMetadata = {
  categoryLabel: string;
  autoManaged: boolean;
  groupKey: string | null;
  ruleId: string | null;
  ageLabel: string | null;
  gender: "M" | "F" | null;
  manualAthleteIds: string[];
  manualExcludedAthleteIds: string[];
};

export type StoredBracket = {
  id: string;
  name: string;
  athleteIds: string[];
  description: string;
  slotAthleteIds: Array<string | null>;
  winnerSelections: Array<Array<MatchSide | null>>;
  metadata: BracketMetadata;
};

export type Bracket = StoredBracket & {
  rounds: BracketRound[];
};

type RoundEntrant = {
  athlete: Athlete | null;
  label: string;
};

type AutoGroup = {
  key: string;
  name: string;
  description: string;
  athleteIds: string[];
  metadata: BracketMetadata;
};

type RuleMatch = {
  rule: AutomaticBracketRule;
  groupKey: string;
  name: string;
  description: string;
  metadata: BracketMetadata;
};

function getRoundTitle(matchCount: number) {
  if (matchCount <= 1) return "Final";
  if (matchCount === 2) return "Semifinal";
  if (matchCount === 4) return "Quartas";
  if (matchCount === 8) return "Oitavas";
  return `Round ${matchCount}`;
}

export function createDefaultBracketMetadata(
  overrides: Partial<BracketMetadata> = {}
): BracketMetadata {
  return {
    categoryLabel: "Sem categoria",
    autoManaged: false,
    groupKey: null,
    ruleId: null,
    ageLabel: null,
    gender: null,
    manualAthleteIds: [],
    manualExcludedAthleteIds: [],
    ...overrides,
  };
}

function uniqueIds(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value))));
}

function sortAthletes(athletes: Athlete[]) {
  return [...athletes].sort((left, right) => left.nome.localeCompare(right.nome, "pt-BR"));
}

function formatRange(label: string, min?: number, max?: number, unit = "") {
  if (min === undefined && max === undefined) return `${label}: livre`;
  if (min !== undefined && max !== undefined) return `${label}: ${min}${unit} a ${max}${unit}`;
  if (min !== undefined) return `${label}: a partir de ${min}${unit}`;
  return `${label}: ate ${max}${unit}`;
}

function matchesAutomaticRule(athlete: Athlete, rule: AutomaticBracketRule) {
  if (athlete.festival) return false;
  if (athlete.categoria !== rule.category) return false;
  if (athlete.idade < rule.minAge || athlete.idade > rule.maxAge) return false;
  if (rule.gender && athlete.sexo !== rule.gender) return false;
  if (rule.minWeight !== undefined && (athlete.peso === null || athlete.peso < rule.minWeight)) return false;
  if (rule.maxWeight !== undefined && (athlete.peso === null || athlete.peso > rule.maxWeight)) return false;
  if (rule.separateByGender && !athlete.sexo) return false;
  return true;
}

function buildRuleMatch(athlete: Athlete): RuleMatch | null {
  if (athlete.festival) {
    return {
      rule: {
        id: FESTIVAL_BRACKET_RULE.id,
        ageLabel: FESTIVAL_BRACKET_RULE.label,
        category: null,
        categoryLabel: FESTIVAL_BRACKET_RULE.label,
        minAge: 0,
        maxAge: 99,
        gender: null,
        separateByGender: false,
      },
      groupKey: FESTIVAL_BRACKET_RULE.id,
      name: FESTIVAL_BRACKET_RULE.label,
      description: "Chave unica do festival infantil.",
      metadata: createDefaultBracketMetadata({
        categoryLabel: FESTIVAL_BRACKET_RULE.label,
        autoManaged: true,
        groupKey: FESTIVAL_BRACKET_RULE.id,
        ruleId: FESTIVAL_BRACKET_RULE.id,
        ageLabel: FESTIVAL_BRACKET_RULE.label,
        gender: null,
      }),
    };
  }

  for (const rule of AUTOMATIC_BRACKET_RULES) {
    if (!matchesAutomaticRule(athlete, rule)) continue;

    const gender = rule.separateByGender ? athlete.sexo : null;
    const key = `${rule.id}:${gender ?? "all"}`;
    const sexLabel = gender ? genderLabel(gender) : null;
    const nameParts = [rule.categoryLabel, rule.ageLabel, sexLabel].filter(Boolean);
    const descriptionParts = [
      `Categoria: ${rule.categoryLabel}`,
      `Idade: ${rule.ageLabel} (${rule.minAge} a ${rule.maxAge})`,
      formatRange("Peso", rule.minWeight, rule.maxWeight, "kg"),
      sexLabel ? `Sexo: ${sexLabel}` : null,
    ].filter(Boolean);

    return {
      rule,
      groupKey: key,
      name: nameParts.join(" - "),
      description: descriptionParts.join(" • "),
      metadata: createDefaultBracketMetadata({
        categoryLabel: rule.categoryLabel,
        autoManaged: true,
        groupKey: key,
        ruleId: rule.id,
        ageLabel: rule.ageLabel,
        gender,
      }),
    };
  }

  return null;
}

export function hasMixedGenderConflict(athletes: Athlete[]) {
  const sexos = new Set(
    athletes.filter((athlete) => !athlete.festival).map((athlete) => athlete.sexo)
  );
  return sexos.size > 1;
}

export function buildAutomaticBracketGroups(athletes: Athlete[]) {
  const paidAthletes = athletes.filter((a) => a.status === "paid");
  const grouped = new Map<string, AutoGroup>();

  for (const athlete of sortAthletes(paidAthletes)) {
    const match = buildRuleMatch(athlete);
    if (!match) continue;

    const current = grouped.get(match.groupKey);
    if (current) {
      current.athleteIds.push(athlete.id);
      continue;
    }

    grouped.set(match.groupKey, {
      key: match.groupKey,
      name: match.name,
      description: match.description,
      athleteIds: [athlete.id],
      metadata: match.metadata,
    });
  }

  return Array.from(grouped.values())
    .map((group) => ({ ...group, athleteIds: uniqueIds(group.athleteIds) }))
    .filter((group) => group.athleteIds.length >= 1)
    .sort((left, right) => left.name.localeCompare(right.name, "pt-BR"));
}

export function buildBracketName(athletes: Athlete[]) {
  const categories = Array.from(new Set(athletes.map((athlete) => athlete.categoria ?? "Sem categoria")));
  const categoryLabel =
    categories.length === 1
      ? getCategoryLabel((categories[0] as Athlete["categoria"]) ?? null)
      : "Multicategoria";
  return `${categoryLabel} - Manual`;
}

export function createEmptyWinnerSelections(athleteCount: number) {
  const rounds: Array<Array<MatchSide | null>> = [];
  let entrantsCount = athleteCount;

  while (entrantsCount > 1) {
    const matchCount = Math.floor(entrantsCount / 2);
    rounds.push(Array.from({ length: matchCount }, () => null));
    entrantsCount = matchCount + (entrantsCount % 2);
  }

  return rounds;
}

function resolveWinner(
  topAthlete: Athlete | null,
  bottomAthlete: Athlete | null,
  winnerSide: MatchSide | null
) {
  if (winnerSide === "top" && topAthlete) return { winnerSide: "top" as const, resolvedWinner: topAthlete };
  if (winnerSide === "bottom" && bottomAthlete) return { winnerSide: "bottom" as const, resolvedWinner: bottomAthlete };
  return { winnerSide: null, resolvedWinner: null };
}

export function buildBracketRounds(
  slotAthleteIds: Array<string | null>,
  athletesById: Map<string, Athlete>,
  winnerSelections: Array<Array<MatchSide | null>>
) {
  if (slotAthleteIds.length === 0) return [];

  const rounds: BracketRound[] = [];
  let fightNumber = 1;

  let currentEntrants: RoundEntrant[] = slotAthleteIds.map((athleteId, index) => {
    const athlete = athleteId ? athletesById.get(athleteId) ?? null : null;
    const isDirectAdvanceSlot = slotAthleteIds.length % 2 === 1 && index === slotAthleteIds.length - 1;

    return {
      athlete,
      label: athlete?.nome ?? (isDirectAdvanceSlot ? "Classificado direto" : "Aguardando atleta"),
    };
  });

  if (currentEntrants.length === 1) {
    rounds.push({
      title: "Final",
      matches: [
        {
          id: crypto.randomUUID(),
          number: fightNumber,
          roundIndex: 0,
          top: currentEntrants[0],
          bottom: { athlete: null, label: "Aguardando atleta" },
          winnerSide: null,
          resolvedWinner: null,
        },
      ],
    });
    return rounds;
  }

  let roundIndex = 0;

  while (currentEntrants.length > 1) {
    const matches: BracketMatch[] = [];
    const nextEntrants: RoundEntrant[] = [];
    const hasCarry = currentEntrants.length % 2 === 1;
    const matchCount = Math.floor(currentEntrants.length / 2);

    for (let matchIndex = 0; matchIndex < matchCount; matchIndex += 1) {
      const topEntry = currentEntrants[matchIndex * 2];
      const bottomEntry = currentEntrants[matchIndex * 2 + 1];
      const resolved = resolveWinner(
        topEntry.athlete,
        bottomEntry.athlete,
        winnerSelections[roundIndex]?.[matchIndex] ?? null
      );

      const match: BracketMatch = {
        id: crypto.randomUUID(),
        number: fightNumber++,
        roundIndex,
        top: topEntry,
        bottom: bottomEntry,
        winnerSide: resolved.winnerSide,
        resolvedWinner: resolved.resolvedWinner,
      };

      matches.push(match);
      nextEntrants.push({
        athlete: match.resolvedWinner,
        label: match.resolvedWinner?.nome ?? `Vencedor L${match.number}`,
      });
    }

    if (hasCarry) {
      nextEntrants.push(currentEntrants[currentEntrants.length - 1]);
    }

    rounds.push({ title: getRoundTitle(matches.length), matches });
    currentEntrants = nextEntrants;
    roundIndex += 1;
  }

  return rounds;
}

function rebalanceSlots(existingSlots: Array<string | null>, athleteIds: string[]) {
  const athleteSet = new Set(athleteIds);
  const preservedSlots = existingSlots
    .map((athleteId) => (athleteId && athleteSet.has(athleteId) ? athleteId : null))
    .slice(0, athleteIds.length);

  const assignedIds = new Set(preservedSlots.filter((athleteId): athleteId is string => Boolean(athleteId)));
  const missingIds = athleteIds.filter((athleteId) => !assignedIds.has(athleteId));

  for (let index = 0; index < preservedSlots.length; index += 1) {
    if (preservedSlots[index] !== null) continue;
    preservedSlots[index] = missingIds.shift() ?? null;
  }

  while (preservedSlots.length < athleteIds.length) {
    preservedSlots.push(missingIds.shift() ?? null);
  }

  return preservedSlots;
}

function mergeAutomaticBracket(
  existingBracket: StoredBracket | undefined,
  group: AutoGroup
): StoredBracket {
  const currentMetadata = createDefaultBracketMetadata(existingBracket?.metadata);
  const manualIncludedIds = uniqueIds(currentMetadata.manualAthleteIds);
  const manualExcludedIds = new Set(uniqueIds(currentMetadata.manualExcludedAthleteIds));
  const autoIds = group.athleteIds.filter((athleteId) => !manualExcludedIds.has(athleteId));
  const finalAthleteIds = uniqueIds([...autoIds, ...manualIncludedIds]);
  const slotAthleteIds = rebalanceSlots(existingBracket?.slotAthleteIds ?? [], finalAthleteIds);
  const needsWinnerReset = slotAthleteIds.length !== (existingBracket?.slotAthleteIds.length ?? 0);
  const winnerSelections = needsWinnerReset
    ? createEmptyWinnerSelections(finalAthleteIds.length)
    : existingBracket?.winnerSelections ?? createEmptyWinnerSelections(finalAthleteIds.length);

  return {
    id: existingBracket?.id ?? crypto.randomUUID(),
    name: existingBracket?.name?.trim() || group.name,
    athleteIds: finalAthleteIds,
    description: group.description,
    slotAthleteIds,
    winnerSelections,
    metadata: createDefaultBracketMetadata({
      ...group.metadata,
      manualAthleteIds: manualIncludedIds,
      manualExcludedAthleteIds: Array.from(manualExcludedIds),
    }),
  };
}

export function syncAutomaticBrackets(
  existingBrackets: StoredBracket[],
  athletes: Athlete[]
) {
  const automaticGroups = buildAutomaticBracketGroups(athletes);
  const autoByGroupKey = new Map(
    existingBrackets
      .filter((bracket) => createDefaultBracketMetadata(bracket.metadata).autoManaged)
      .map((bracket) => [createDefaultBracketMetadata(bracket.metadata).groupKey, bracket] as const)
      .filter((entry): entry is [string, StoredBracket] => Boolean(entry[0]))
  );

  const nextAutomaticBrackets = automaticGroups.map((group) =>
    mergeAutomaticBracket(autoByGroupKey.get(group.key), group)
  );

  const manualBrackets = existingBrackets.filter(
    (bracket) => !createDefaultBracketMetadata(bracket.metadata).autoManaged
  );

  return [...manualBrackets, ...nextAutomaticBrackets];
}

export function hydrateBracket(storedBracket: StoredBracket, athletesById: Map<string, Athlete>): Bracket {
  return {
    ...storedBracket,
    metadata: createDefaultBracketMetadata(storedBracket.metadata),
    rounds: buildBracketRounds(storedBracket.slotAthleteIds, athletesById, storedBracket.winnerSelections),
  };
}

export function hydrateBrackets(storedBrackets: StoredBracket[], athletesById: Map<string, Athlete>) {
  return storedBrackets.map((storedBracket) => hydrateBracket(storedBracket, athletesById));
}

export function serializeBrackets(brackets: Bracket[]): StoredBracket[] {
  return brackets.map((bracket) => ({
    id: bracket.id,
    name: bracket.name,
    athleteIds: bracket.athleteIds,
    description: bracket.description,
    slotAthleteIds: bracket.slotAthleteIds,
    winnerSelections: bracket.winnerSelections,
    metadata: createDefaultBracketMetadata(bracket.metadata),
  }));
}

function isBracketMetadata(value: unknown): value is Partial<BracketMetadata> {
  return Boolean(value) && typeof value === "object";
}

export function normalizeStoredBracket(value: unknown): StoredBracket | null {
  if (!value || typeof value !== "object") return null;

  const candidate = value as Partial<StoredBracket>;
  if (typeof candidate.id !== "string" || typeof candidate.name !== "string" || typeof candidate.description !== "string") {
    return null;
  }

  if (!Array.isArray(candidate.athleteIds) || !Array.isArray(candidate.slotAthleteIds) || !Array.isArray(candidate.winnerSelections)) {
    return null;
  }

  const athleteIds = candidate.athleteIds.every((item) => typeof item === "string");
  const slotAthleteIds = candidate.slotAthleteIds.every((item) => item === null || typeof item === "string");
  const winnerSelections = candidate.winnerSelections.every(
    (round) =>
      Array.isArray(round) &&
      round.every((item) => item === null || item === "top" || item === "bottom")
  );

  if (!athleteIds || !slotAthleteIds || !winnerSelections) return null;

  const metadata = isBracketMetadata(candidate.metadata)
    ? createDefaultBracketMetadata({
        categoryLabel:
          typeof candidate.metadata.categoryLabel === "string"
            ? candidate.metadata.categoryLabel
            : undefined,
        autoManaged:
          typeof candidate.metadata.autoManaged === "boolean"
            ? candidate.metadata.autoManaged
            : undefined,
        groupKey:
          typeof candidate.metadata.groupKey === "string" || candidate.metadata.groupKey === null
            ? candidate.metadata.groupKey
            : undefined,
        ruleId:
          typeof candidate.metadata.ruleId === "string" || candidate.metadata.ruleId === null
            ? candidate.metadata.ruleId
            : undefined,
        ageLabel:
          typeof candidate.metadata.ageLabel === "string" || candidate.metadata.ageLabel === null
            ? candidate.metadata.ageLabel
            : undefined,
        gender:
          candidate.metadata.gender === "M" ||
          candidate.metadata.gender === "F" ||
          candidate.metadata.gender === null
            ? candidate.metadata.gender
            : undefined,
        manualAthleteIds: Array.isArray(candidate.metadata.manualAthleteIds)
          ? candidate.metadata.manualAthleteIds.filter((item): item is string => typeof item === "string")
          : undefined,
        manualExcludedAthleteIds: Array.isArray(candidate.metadata.manualExcludedAthleteIds)
          ? candidate.metadata.manualExcludedAthleteIds.filter((item): item is string => typeof item === "string")
          : undefined,
      })
    : createDefaultBracketMetadata();

  return {
    id: candidate.id,
    name: candidate.name,
    athleteIds: candidate.athleteIds,
    description: candidate.description,
    slotAthleteIds: candidate.slotAthleteIds,
    winnerSelections: candidate.winnerSelections as Array<Array<MatchSide | null>>,
    metadata,
  };
}
