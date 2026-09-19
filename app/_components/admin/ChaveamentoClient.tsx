"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, Menu, Pencil, Trash2 } from "lucide-react";

import { logout } from "@/app/_lib/auth";
import { Button } from "@/app/_components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/app/_components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/app/_components/ui/dropdown-menu";
import { Input } from "@/app/_components/ui/input";
import BracketVisualization from "@/app/_components/chaveamento/BracketVisualization";
import {
  buildAutomaticBracketGroups,
  buildBracketRounds,
  buildBracketName,
  createDefaultBracketMetadata,
  createEmptyWinnerSelections,
  hasMixedGenderConflict,
  hydrateBrackets,
  serializeBrackets,
  type Athlete,
  type Bracket,
  type MatchSide,
} from "@/app/_lib/chaveamento";
import { getCategoryLabel } from "@/app/_lib/types";

function parseOptionalNumber(value: string): number | undefined {
  const normalized = value.trim().replace(",", ".");
  if (!normalized) return undefined;
  const parsed = Number(normalized);
  return Number.isNaN(parsed) ? undefined : parsed;
}

function formatAthleteLabel(athlete: Athlete) {
  return `${athlete.nome} - ${athlete.sexo ?? "-"} - ${athlete.idade} anos - ${
    athlete.peso !== null ? `${athlete.peso}kg` : "-"
  } - ${getCategoryLabel((athlete.categoria as Athlete["categoria"]) ?? null)}`;
}

function getSlotIndicesForMatch(matchIndex: number) {
  return { top: matchIndex * 2, bottom: matchIndex * 2 + 1 };
}

function getDirectAdvanceSlotIndex(slotCount: number) {
  return slotCount % 2 === 1 ? slotCount - 1 : null;
}

export default function ChaveamentoClient() {
  const router = useRouter();

  const [athletes, setAthletes] = React.useState<Athlete[]>([]);
  const [brackets, setBrackets] = React.useState<Bracket[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [fetchError, setFetchError] = React.useState<string | null>(null);
  const [createOpen, setCreateOpen] = React.useState(false);
  const [filterMinAge, setFilterMinAge] = React.useState("");
  const [filterMaxAge, setFilterMaxAge] = React.useState("");
  const [filterMinWeight, setFilterMinWeight] = React.useState("");
  const [filterMaxWeight, setFilterMaxWeight] = React.useState("");
  const [selectedAthleteIds, setSelectedAthleteIds] = React.useState<string[]>([]);
  const [newBracketName, setNewBracketName] = React.useState("");
  const [newCategoryLabel, setNewCategoryLabel] = React.useState("Manual");
  const [activeBracketId, setActiveBracketId] = React.useState<string | null>(null);
  const [editOpen, setEditOpen] = React.useState(false);
  const [editingBracketId, setEditingBracketId] = React.useState<string | null>(null);
  const [editingBracketName, setEditingBracketName] = React.useState("");
  const [editingCategoryLabel, setEditingCategoryLabel] = React.useState("");
  const [editingAthleteIds, setEditingAthleteIds] = React.useState<string[]>([]);
  const [saveState, setSaveState] = React.useState<"idle" | "saving" | "saved" | "error">("idle");
  const [saveError, setSaveError] = React.useState<string | null>(null);
  const readyToPersistRef = React.useRef(false);
  const lastSavedPayloadRef = React.useRef("[]");

  React.useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/chaveamento", { cache: "no-store" });
        if (!res.ok) throw new Error(`Erro ${res.status}`);

        const json = await res.json();
        const nextAthletes = Array.isArray(json?.athletes) ? (json.athletes as Athlete[]) : [];
        const athletesMap = new Map(nextAthletes.map((athlete) => [athlete.id, athlete]));
        const nextBrackets = Array.isArray(json?.brackets)
          ? hydrateBrackets(json.brackets, athletesMap)
          : [];

        setAthletes(nextAthletes);
        setBrackets(nextBrackets);
        lastSavedPayloadRef.current = JSON.stringify(serializeBrackets(nextBrackets));
        setFetchError(null);
      } catch (error) {
        setFetchError(
          error instanceof Error ? error.message : "Não foi possível carregar os atletas."
        );
      } finally {
        readyToPersistRef.current = true;
        setLoading(false);
      }
    })();
  }, []);

  const athletesById = React.useMemo(
    () => new Map(athletes.map((athlete) => [athlete.id, athlete])),
    [athletes]
  );

  const automaticGroupsByKey = React.useMemo(
    () => new Map(buildAutomaticBracketGroups(athletes).map((group) => [group.key, group])),
    [athletes]
  );

  const activeBracket = React.useMemo(
    () => brackets.find((bracket) => bracket.id === activeBracketId) ?? null,
    [brackets, activeBracketId]
  );

  const activeBracketAthletes = React.useMemo(() => {
    if (!activeBracket) return [];
    return activeBracket.athleteIds
      .map((id) => athletesById.get(id))
      .filter((athlete): athlete is Athlete => Boolean(athlete));
  }, [activeBracket, athletesById]);

  const editingBracket = React.useMemo(
    () => brackets.find((bracket) => bracket.id === editingBracketId) ?? null,
    [brackets, editingBracketId]
  );

  const editingAthleteIdsSet = React.useMemo(
    () => new Set(editingAthleteIds),
    [editingAthleteIds]
  );

  const minAge = parseOptionalNumber(filterMinAge);
  const maxAge = parseOptionalNumber(filterMaxAge);
  const minWeight = parseOptionalNumber(filterMinWeight);
  const maxWeight = parseOptionalNumber(filterMaxWeight);

  const filteredAthletesForCreation = React.useMemo(() => {
    return athletes.filter((athlete) => {
      if (minAge !== undefined && athlete.idade < minAge) return false;
      if (maxAge !== undefined && athlete.idade > maxAge) return false;
      if (minWeight !== undefined && (athlete.peso === null || athlete.peso < minWeight)) return false;
      if (maxWeight !== undefined && (athlete.peso === null || athlete.peso > maxWeight)) return false;
      return true;
    });
  }, [athletes, minAge, maxAge, minWeight, maxWeight]);

  React.useEffect(() => {
    const allowedIds = new Set(filteredAthletesForCreation.map((athlete) => athlete.id));
    setSelectedAthleteIds((current) => current.filter((id) => allowedIds.has(id)));
  }, [filteredAthletesForCreation]);

  React.useEffect(() => {
    setBrackets((current) =>
      current.map((bracket) => ({
        ...bracket,
        rounds: buildBracketRounds(bracket.slotAthleteIds, athletesById, bracket.winnerSelections),
      }))
    );
  }, [athletesById]);

  React.useEffect(() => {
    if (!readyToPersistRef.current || loading) return;

    const payload = JSON.stringify(serializeBrackets(brackets));
    if (payload === lastSavedPayloadRef.current) return;

    let cancelled = false;
    setSaveState("saving");
    setSaveError(null);

    (async () => {
      try {
        const res = await fetch("/api/chaveamento", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ brackets: JSON.parse(payload) }),
        });

        const json = await res.json().catch(() => null);
        if (!res.ok) {
          throw new Error(
            typeof json?.error === "string" ? json.error : `Erro ${res.status} ao salvar chaveamento.`
          );
        }

        if (cancelled) return;
        if (Array.isArray(json?.athletes)) {
          setAthletes(json.athletes as Athlete[]);
        }
        lastSavedPayloadRef.current = payload;
        setSaveState("saved");
      } catch (error) {
        if (cancelled) return;
        setSaveState("error");
        setSaveError(
          error instanceof Error ? error.message : "Não foi possível salvar o chaveamento."
        );
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [brackets, loading]);

  const selectedAthleteIdsSet = React.useMemo(() => new Set(selectedAthleteIds), [selectedAthleteIds]);

  const selectedAthletesForCreation = React.useMemo(
    () =>
      selectedAthleteIds
        .map((id) => athletesById.get(id))
        .filter((athlete): athlete is Athlete => Boolean(athlete)),
    [selectedAthleteIds, athletesById]
  );
  const createGenderConflict = React.useMemo(
    () => hasMixedGenderConflict(selectedAthletesForCreation),
    [selectedAthletesForCreation]
  );

  const editingAthletesResolved = React.useMemo(
    () =>
      editingAthleteIds
        .map((id) => athletesById.get(id))
        .filter((athlete): athlete is Athlete => Boolean(athlete)),
    [editingAthleteIds, athletesById]
  );
  const editGenderConflict = React.useMemo(
    () => hasMixedGenderConflict(editingAthletesResolved),
    [editingAthletesResolved]
  );

  const totalFights = React.useMemo(
    () => brackets.reduce((sum, bracket) => sum + bracket.rounds.reduce((roundSum, round) => roundSum + round.matches.length, 0), 0),
    [brackets]
  );

  function handleLogout() {
    logout();
    router.push("/");
  }

  function resetCreateModal() {
    setFilterMinAge("");
    setFilterMaxAge("");
    setFilterMinWeight("");
    setFilterMaxWeight("");
    setSelectedAthleteIds([]);
    setNewBracketName("");
    setNewCategoryLabel("Manual");
  }

  function openCreateModal() {
    resetCreateModal();
    setCreateOpen(true);
  }

  function closeCreateModal(open: boolean) {
    setCreateOpen(open);
    if (!open) resetCreateModal();
  }

  function openEditModal(bracketId: string) {
    const bracket = brackets.find((item) => item.id === bracketId);
    if (!bracket) return;

    setEditingBracketId(bracket.id);
    setEditingBracketName(bracket.name);
    setEditingCategoryLabel(bracket.metadata.categoryLabel);
    setEditingAthleteIds(bracket.athleteIds);
    setEditOpen(true);
  }

  function closeEditModal(open: boolean) {
    setEditOpen(open);
    if (!open) {
      setEditingBracketId(null);
      setEditingBracketName("");
      setEditingCategoryLabel("");
      setEditingAthleteIds([]);
    }
  }

  function toggleAthleteSelection(athleteId: string) {
    setSelectedAthleteIds((current) =>
      current.includes(athleteId) ? current.filter((id) => id !== athleteId) : [...current, athleteId]
    );
  }

  function toggleEditingAthleteSelection(athleteId: string) {
    setEditingAthleteIds((current) =>
      current.includes(athleteId) ? current.filter((id) => id !== athleteId) : [...current, athleteId]
    );
  }

  function createBracketFromSelection() {
    if (selectedAthleteIds.length === 0) return;
    if (hasMixedGenderConflict(selectedAthletesForCreation)) return;

    const selectedAthletes = selectedAthletesForCreation;
    const slotAthleteIds = selectedAthletes.map((athlete) => athlete.id);
    const winnerSelections = createEmptyWinnerSelections(selectedAthletes.length);
    const description = "Chave criada manualmente pelo painel administrativo.";

    const nextBracket: Bracket = {
      id: crypto.randomUUID(),
      name: newBracketName.trim() || buildBracketName(selectedAthletes),
      athleteIds: [...selectedAthleteIds],
      description,
      slotAthleteIds,
      winnerSelections,
      metadata: createDefaultBracketMetadata({
        categoryLabel: newCategoryLabel.trim() || "Manual",
        autoManaged: false,
      }),
      rounds: buildBracketRounds(slotAthleteIds, athletesById, winnerSelections),
    };

    setBrackets((current) => [...current, nextBracket]);
    closeCreateModal(false);
    setActiveBracketId(nextBracket.id);
  }

  function updateBracketName(bracketId: string, name: string) {
    setBrackets((current) =>
      current.map((bracket) => (bracket.id === bracketId ? { ...bracket, name } : bracket))
    );
  }

  function updateBracketSlot(bracketId: string, slotIndex: number, athleteId: string | null) {
    setBrackets((current) =>
      current.map((bracket) => {
        if (bracket.id !== bracketId) return bracket;

        const nextSlotAthleteIds = bracket.slotAthleteIds.map((currentId, index) => {
          if (index === slotIndex) return athleteId;
          if (athleteId && currentId === athleteId) return null;
          return currentId;
        });

        const nextWinnerSelections = bracket.winnerSelections.map((roundSelections) =>
          roundSelections.map(() => null)
        );

        return {
          ...bracket,
          slotAthleteIds: nextSlotAthleteIds,
          winnerSelections: nextWinnerSelections,
          rounds: buildBracketRounds(nextSlotAthleteIds, athletesById, nextWinnerSelections),
        };
      })
    );
  }

  function updateMatchWinner(
    bracketId: string,
    roundIndex: number,
    matchIndex: number,
    winnerSide: MatchSide | null
  ) {
    setBrackets((current) =>
      current.map((bracket) => {
        if (bracket.id !== bracketId) return bracket;

        const nextWinnerSelections = bracket.winnerSelections.map((roundSelections, currentRoundIndex) =>
          currentRoundIndex < roundIndex
            ? roundSelections
            : currentRoundIndex === roundIndex
              ? roundSelections.map((currentWinner, currentMatchIndex) =>
                  currentMatchIndex === matchIndex ? winnerSide : currentWinner
                )
              : roundSelections.map(() => null)
        );

        return {
          ...bracket,
          winnerSelections: nextWinnerSelections,
          rounds: buildBracketRounds(bracket.slotAthleteIds, athletesById, nextWinnerSelections),
        };
      })
    );
  }

  function removeBracket(bracketId: string) {
    setBrackets((current) => current.filter((bracket) => bracket.id !== bracketId));
    if (activeBracketId === bracketId) setActiveBracketId(null);
  }

  function saveBracketEdit() {
    if (!editingBracketId || editingAthleteIds.length === 0) return;
    if (hasMixedGenderConflict(editingAthletesResolved)) return;

    setBrackets((current) =>
      current.map((bracket) => {
        if (bracket.id !== editingBracketId) return bracket;

        const allowedAthleteIds = new Set(editingAthleteIds);
        const nextSlotAthleteIds = bracket.slotAthleteIds
          .filter((_, index) => index < editingAthleteIds.length)
          .map((athleteId) => (athleteId && allowedAthleteIds.has(athleteId) ? athleteId : null));

        while (nextSlotAthleteIds.length < editingAthleteIds.length) {
          nextSlotAthleteIds.push(null);
        }

        const nextWinnerSelections = createEmptyWinnerSelections(editingAthleteIds.length);
        const metadata = createDefaultBracketMetadata(bracket.metadata);
        const selectedSet = new Set(editingAthleteIds);

        const groupKey = metadata.groupKey;
        const nextMetadata = metadata.autoManaged && groupKey
          ? createDefaultBracketMetadata({
              ...metadata,
              manualAthleteIds: editingAthleteIds.filter(
                (athleteId) => !new Set(automaticGroupsByKey.get(groupKey)?.athleteIds ?? []).has(athleteId)
              ),
              manualExcludedAthleteIds: (automaticGroupsByKey.get(groupKey)?.athleteIds ?? []).filter(
                (athleteId) => !selectedSet.has(athleteId)
              ),
            })
          : createDefaultBracketMetadata({
              ...metadata,
              categoryLabel: editingCategoryLabel.trim() || metadata.categoryLabel,
              autoManaged: false,
            });

        return {
          ...bracket,
          name: editingBracketName.trim() || bracket.name,
          athleteIds: editingAthleteIds,
          slotAthleteIds: nextSlotAthleteIds,
          winnerSelections: nextWinnerSelections,
          metadata: nextMetadata,
          rounds: buildBracketRounds(nextSlotAthleteIds, athletesById, nextWinnerSelections),
        };
      })
    );

    closeEditModal(false);
  }

  return (
    <div className="min-h-screen bg-black text-zinc-100">
      <header className="sticky top-0 z-10 border-b border-zinc-900 bg-black/80 backdrop-blur">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h1 className="text-xl font-semibold">Chaveamento</h1>
              <p className="text-sm text-zinc-400">
                Atletas: {athletes.length} • Chaves: {brackets.length} • Confrontos: {totalFights}
              </p>
              <p className="mt-1 text-xs text-zinc-500">
                Regras automaticas: app/_lib/chaveamento-rules.ts
                {saveState === "saving" ? " • salvando..." : null}
                {saveState === "saved" ? " • alterações publicadas" : null}
                {saveState === "error" ? " • erro ao publicar" : null}
              </p>
              {saveError ? <p className="mt-1 text-xs text-red-400">{saveError}</p> : null}
            </div>

            <div className="hidden items-center gap-3 md:flex">
              <Button asChild variant="outline" className="h-8 rounded-xl border-zinc-800 bg-zinc-950/40 hover:bg-white">
                <Link href="/admin/painel">Painel</Link>
              </Button>
              <Button asChild variant="outline" className="h-8 rounded-xl border-zinc-800 bg-zinc-950/40 hover:bg-white">
                <Link href="/admin/categorias">Categorias</Link>
              </Button>
              <Button asChild variant="outline" className="h-8 rounded-xl border-zinc-800 bg-zinc-950/40 hover:bg-white">
                <Link href="/admin/cashback">Cashback</Link>
              </Button>
              <Button asChild variant="outline" className="h-8 rounded-xl border-zinc-800 bg-zinc-950/40 hover:bg-white">
                <Link href="/admin/cronometro">Cronometro</Link>
              </Button>
              <Button
                variant="ghost"
                className="h-9 cursor-pointer rounded-xl px-3 text-zinc-300 hover:bg-zinc-900 hover:text-red-700"
                type="button"
                onClick={handleLogout}
              >
                Sair
              </Button>
            </div>

            <div className="md:hidden">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="h-9 w-9 cursor-pointer rounded-xl p-0 text-zinc-300 hover:bg-zinc-900 hover:text-zinc-100">
                    <Menu className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="border-zinc-800 bg-zinc-950 text-zinc-100">
                  <Link href="/admin/painel">
                    <DropdownMenuItem className="cursor-pointer data-highlighted:bg-white">Painel</DropdownMenuItem>
                  </Link>
                  <Link href="/admin/categorias">
                    <DropdownMenuItem className="cursor-pointer data-highlighted:bg-white">Categorias</DropdownMenuItem>
                  </Link>
                  <Link href="/admin/cashback">
                    <DropdownMenuItem className="cursor-pointer data-highlighted:bg-white">Cashback</DropdownMenuItem>
                  </Link>
                  <Link href="/admin/cronometro">
                    <DropdownMenuItem className="cursor-pointer data-highlighted:bg-white">Cronometro</DropdownMenuItem>
                  </Link>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleLogout} className="cursor-pointer hover:text-red-700 data-highlighted:bg-white">
                    Sair
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
      </header>

      <main className={`container mx-auto px-4 ${activeBracket ? "space-y-4 py-4" : "space-y-6 py-8"}`}>
        {activeBracket ? (
          <>
            <section className="rounded-3xl border border-zinc-900 bg-zinc-950/50 p-4">
              <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                <div className="flex items-center gap-3">
                  <Button
                    variant="outline"
                    onClick={() => setActiveBracketId(null)}
                    className="cursor-pointer border-zinc-700 bg-zinc-900/20 text-zinc-100 hover:bg-zinc-800"
                  >
                    Voltar para chaveamento
                  </Button>

                  <div>
                    <div className="text-xs uppercase tracking-[0.28em] text-zinc-500">Edicao da chave</div>
                    <div className="text-sm text-zinc-400">
                      Selecione os atletas das primeiras lutas e avance os vencedores ate a final.
                    </div>
                  </div>
                </div>

                <div className="flex w-full max-w-xl items-center gap-2">
                  <Input
                    value={activeBracket.name}
                    readOnly
                    className="border-zinc-800 bg-zinc-950 text-lg font-semibold text-zinc-100"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => openEditModal(activeBracket.id)}
                    className="shrink-0 cursor-pointer border-zinc-700 bg-zinc-900/20 text-zinc-100 hover:bg-zinc-800"
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="grid gap-3 xl:grid-cols-4">
                {(activeBracket.rounds[0]?.matches ?? []).map((match, matchIndex) => {
                  const slotIndices = getSlotIndicesForMatch(matchIndex);

                  return (
                    <div key={match.id} className="rounded-2xl border border-zinc-800 bg-black/30 p-3">
                      <div className="mb-3 text-xs uppercase tracking-[0.24em] text-zinc-500">
                        Luta {match.number}
                      </div>

                      {(
                        [
                          { key: "top", label: "Atleta A", slotIndex: slotIndices.top },
                          { key: "bottom", label: "Atleta B", slotIndex: slotIndices.bottom },
                        ] as const
                      ).map((slot) => {
                        const currentValue = activeBracket.slotAthleteIds[slot.slotIndex] ?? "";
                        const usedAthleteIds = new Set(
                          activeBracket.slotAthleteIds.filter(
                            (athleteId, index): athleteId is string =>
                              Boolean(athleteId) && index !== slot.slotIndex
                          )
                        );

                        return (
                          <div key={`${match.id}-${slot.key}`} className="mb-3 last:mb-0">
                            <label className="mb-2 block text-[11px] uppercase tracking-[0.2em] text-zinc-500">
                              {slot.label}
                            </label>
                            <select
                              className="w-full cursor-pointer rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
                              value={currentValue}
                              onChange={(e) =>
                                updateBracketSlot(activeBracket.id, slot.slotIndex, e.target.value || null)
                              }
                            >
                              <option value="">Selecionar atleta</option>
                              {activeBracketAthletes
                                .filter(
                                  (athlete) =>
                                    athlete.id === currentValue || !usedAthleteIds.has(athlete.id)
                                )
                                .map((athlete) => (
                                  <option key={athlete.id} value={athlete.id}>
                                    {formatAthleteLabel(athlete)}
                                  </option>
                                ))}
                            </select>
                          </div>
                        );
                      })}

                      <div className="mt-3">
                        <label className="mb-2 block text-[11px] uppercase tracking-[0.2em] text-zinc-500">
                          Vencedor
                        </label>
                        <select
                          className="w-full cursor-pointer rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
                          value={match.winnerSide ?? ""}
                          onChange={(e) =>
                            updateMatchWinner(
                              activeBracket.id,
                              0,
                              matchIndex,
                              (e.target.value as MatchSide) || null
                            )
                          }
                        >
                          <option value="">Selecionar vencedor</option>
                          <option value="top" disabled={!match.top.athlete}>
                            {match.top.label}
                          </option>
                          <option value="bottom" disabled={!match.bottom.athlete}>
                            {match.bottom.label}
                          </option>
                        </select>
                      </div>
                    </div>
                  );
                })}
              </div>

              {getDirectAdvanceSlotIndex(activeBracket.slotAthleteIds.length) !== null ? (
                <div className="mt-4 rounded-2xl border border-amber-700/40 bg-amber-950/20 p-3">
                  <div className="mb-2 text-xs uppercase tracking-[0.24em] text-amber-300/80">
                    Classificado direto
                  </div>
                  {(() => {
                    const slotIndex = getDirectAdvanceSlotIndex(activeBracket.slotAthleteIds.length) as number;
                    const currentValue = activeBracket.slotAthleteIds[slotIndex] ?? "";
                    const usedAthleteIds = new Set(
                      activeBracket.slotAthleteIds.filter(
                        (athleteId, index): athleteId is string =>
                          Boolean(athleteId) && index !== slotIndex
                      )
                    );

                    return (
                      <select
                        className="w-full cursor-pointer rounded-xl border border-amber-700/40 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
                        value={currentValue}
                        onChange={(e) =>
                          updateBracketSlot(activeBracket.id, slotIndex, e.target.value || null)
                        }
                      >
                        <option value="">Selecionar atleta</option>
                        {activeBracketAthletes
                          .filter(
                            (athlete) => athlete.id === currentValue || !usedAthleteIds.has(athlete.id)
                          )
                          .map((athlete) => (
                            <option key={athlete.id} value={athlete.id}>
                              {formatAthleteLabel(athlete)}
                            </option>
                          ))}
                      </select>
                    );
                  })()}
                </div>
              ) : null}
            </section>

            <section className="rounded-3xl border border-zinc-900 bg-zinc-950/50 p-4">
              <div className="mb-4 text-xs uppercase tracking-[0.28em] text-zinc-500">Progresso</div>
              <div className="grid gap-4 xl:grid-cols-3">
                {activeBracket.rounds.slice(1).map((round, roundIndex) => (
                  <div key={`${activeBracket.id}-${round.title}-${roundIndex + 1}`}>
                    <div className="mb-2 text-sm font-medium text-zinc-200">{round.title}</div>
                    <div className="space-y-3">
                      {round.matches.map((match, matchIndex) => (
                        <div key={match.id} className="rounded-2xl border border-zinc-800 bg-black/30 p-3">
                          <div className="mb-2 text-xs uppercase tracking-[0.2em] text-zinc-500">
                            Luta {match.number}
                          </div>
                          <div className="mb-3 space-y-2">
                            <div className="rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-200">
                              {match.top.label}
                            </div>
                            <div className="rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-200">
                              {match.bottom.label}
                            </div>
                          </div>
                          <select
                            className="w-full cursor-pointer rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
                            value={match.winnerSide ?? ""}
                            onChange={(e) =>
                              updateMatchWinner(
                                activeBracket.id,
                                roundIndex + 1,
                                matchIndex,
                                (e.target.value as MatchSide) || null
                              )
                            }
                          >
                            <option value="">Selecionar vencedor</option>
                            <option value="top" disabled={!match.top.athlete}>
                              {match.top.label}
                            </option>
                            <option value="bottom" disabled={!match.bottom.athlete}>
                              {match.bottom.label}
                            </option>
                          </select>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-3xl border border-zinc-900 bg-zinc-950/50 p-4">
              <div className="mb-4 text-xs uppercase tracking-[0.28em] text-zinc-500">Chaveamento</div>
              <div className="overflow-x-auto">
                <BracketVisualization bracket={activeBracket} athletesCount={activeBracketAthletes.length} />
              </div>
            </section>
          </>
        ) : (
          <>
            <section className="rounded-2xl border border-zinc-900 bg-zinc-950/40 p-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                <div className="text-sm text-zinc-400">
                  As chaves automaticas seguem as regras do arquivo app/_lib/chaveamento-rules.ts. Use esta area para criar excecoes manuais e ajustar confrontos.
                </div>
                <Button onClick={openCreateModal} className="w-full cursor-pointer bg-white text-black hover:bg-zinc-200 md:w-auto">
                  Criar nova chave
                </Button>
              </div>

              {fetchError ? <div className="mt-3 text-sm text-red-400">{fetchError}</div> : null}
            </section>

            {loading ? (
              <div className="rounded-2xl border border-zinc-900 bg-zinc-950/40 p-8 text-center text-zinc-400">
                Carregando atletas...
              </div>
            ) : brackets.length === 0 ? (
              <div className="rounded-2xl border border-zinc-900 bg-zinc-950/40 p-8 text-center text-zinc-400">
                Nenhuma chave criada ainda.
              </div>
            ) : (
              brackets.map((bracket) => {
                const bracketAthletes = bracket.athleteIds
                  .map((id) => athletesById.get(id))
                  .filter((athlete): athlete is Athlete => Boolean(athlete));

                return (
                  <section key={bracket.id} className="rounded-2xl border border-zinc-900 bg-zinc-950/40 p-6">
                    <div className="mb-5 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                      <div className="min-w-0 flex-1">
                        <Input
                          value={bracket.name}
                          onChange={(e) => updateBracketName(bracket.id, e.target.value)}
                          className="max-w-xl border-zinc-800 bg-zinc-950 text-lg font-semibold text-zinc-100"
                        />
                        <div className="mt-2 text-sm text-zinc-400">{bracket.description}</div>
                        <div className="mt-2 text-sm text-zinc-500">Atletas na chave: {bracketAthletes.length}</div>
                      </div>

                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          onClick={() => setActiveBracketId(bracket.id)}
                          className="cursor-pointer border-zinc-700 bg-zinc-900/20 text-zinc-100 hover:bg-zinc-800"
                        >
                          <Eye className="mr-2 h-4 w-4" />
                          Editar chave
                        </Button>
                        <Button className="cursor-pointer" variant="destructive" size="icon" onClick={() => removeBracket(bracket.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    <BracketVisualization bracket={bracket} athletesCount={bracketAthletes.length} />
                  </section>
                );
              })
            )}
          </>
        )}
      </main>

      <Dialog open={createOpen} onOpenChange={closeCreateModal}>
        <DialogContent className="border-zinc-800 bg-zinc-950 text-zinc-100 sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Criar nova chave</DialogTitle>
            <DialogDescription className="text-zinc-400">
              Filtre por idade e peso e selecione atletas para uma chave manual.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="rounded-xl border border-zinc-800 bg-black/40 p-3">
              <p className="mb-2 text-xs text-zinc-400">Nome da chave</p>
              <Input
                placeholder="Ex.: Peso Medio Juvenil"
                value={newBracketName}
                onChange={(e) => setNewBracketName(e.target.value)}
                className="h-9 rounded-lg border-zinc-700 bg-zinc-950 text-zinc-100 placeholder:text-zinc-500"
              />
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div className="rounded-xl border border-zinc-800 bg-black/40 p-3">
                <p className="mb-2 text-xs text-zinc-400">Idade</p>
                <div className="grid grid-cols-2 gap-2">
                  <Input inputMode="numeric" placeholder="De" value={filterMinAge} onChange={(e) => setFilterMinAge(e.target.value)} className="h-9 rounded-lg border-zinc-700 bg-zinc-950 text-zinc-100 placeholder:text-zinc-500" />
                  <Input inputMode="numeric" placeholder="Ate" value={filterMaxAge} onChange={(e) => setFilterMaxAge(e.target.value)} className="h-9 rounded-lg border-zinc-700 bg-zinc-950 text-zinc-100 placeholder:text-zinc-500" />
                </div>
              </div>

              <div className="rounded-xl border border-zinc-800 bg-black/40 p-3">
                <p className="mb-2 text-xs text-zinc-400">Peso (kg)</p>
                <div className="grid grid-cols-2 gap-2">
                  <Input inputMode="decimal" placeholder="De" value={filterMinWeight} onChange={(e) => setFilterMinWeight(e.target.value)} className="h-9 rounded-lg border-zinc-700 bg-zinc-950 text-zinc-100 placeholder:text-zinc-500" />
                  <Input inputMode="decimal" placeholder="Ate" value={filterMaxWeight} onChange={(e) => setFilterMaxWeight(e.target.value)} className="h-9 rounded-lg border-zinc-700 bg-zinc-950 text-zinc-100 placeholder:text-zinc-500" />
                </div>
              </div>
            </div>

            <div className="text-sm text-zinc-300">
              Atletas encontrados: {filteredAthletesForCreation.length} • Selecionados: {selectedAthleteIds.length}
            </div>

            {createGenderConflict ? (
              <div className="rounded-xl border border-red-900/60 bg-red-950/30 p-3 text-sm text-red-400">
                Não é permitido misturar atletas do sexo masculino e feminino na mesma chave, exceto no festival infantil.
              </div>
            ) : null}

            <div className="max-h-72 space-y-2 overflow-y-auto rounded-xl border border-zinc-800 bg-black/40 p-3">
              {filteredAthletesForCreation.length === 0 ? (
                <div className="py-6 text-center text-sm text-zinc-400">
                  Nenhum atleta encontrado para os filtros informados.
                </div>
              ) : (
                filteredAthletesForCreation.map((athlete) => (
                  <label key={athlete.id} className="flex cursor-pointer items-center gap-3 rounded-lg border border-zinc-800 px-3 py-2 hover:bg-zinc-900/30">
                    <input type="checkbox" checked={selectedAthleteIdsSet.has(athlete.id)} onChange={() => toggleAthleteSelection(athlete.id)} className="h-4 w-4 cursor-pointer accent-white" />
                    <span className="text-sm text-zinc-100">{formatAthleteLabel(athlete)}</span>
                  </label>
                ))
              )}
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
              <Button type="button" variant="outline" onClick={() => closeCreateModal(false)} className="cursor-pointer border-zinc-700 bg-zinc-900/20 text-zinc-100 hover:bg-zinc-800">
                Cancelar
              </Button>
              <Button type="button" onClick={createBracketFromSelection} disabled={selectedAthleteIds.length === 0 || createGenderConflict} className="cursor-pointer bg-white text-black hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-50">
                Criar chave com selecionados
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={editOpen} onOpenChange={closeEditModal}>
        <DialogContent className="border-zinc-800 bg-zinc-950 text-zinc-100 sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Editar chave</DialogTitle>
            <DialogDescription className="text-zinc-400">
              Altere o nome da chave e os atletas participantes.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="rounded-xl border border-zinc-800 bg-black/40 p-3">
              <p className="mb-2 text-xs text-zinc-400">Nome da chave</p>
              <Input
                placeholder="Ex.: Peso Medio Juvenil"
                value={editingBracketName}
                onChange={(e) => setEditingBracketName(e.target.value)}
                className="h-9 rounded-lg border-zinc-700 bg-zinc-950 text-zinc-100 placeholder:text-zinc-500"
              />
            </div>

            <div className="text-sm text-zinc-300">
              Atletas selecionados: {editingAthleteIds.length}
            </div>

            {editGenderConflict ? (
              <div className="rounded-xl border border-red-900/60 bg-red-950/30 p-3 text-sm text-red-400">
                Não é permitido misturar atletas do sexo masculino e feminino na mesma chave, exceto no festival infantil.
              </div>
            ) : null}

            <div className="max-h-72 space-y-2 overflow-y-auto rounded-xl border border-zinc-800 bg-black/40 p-3">
              {athletes.length === 0 ? (
                <div className="py-6 text-center text-sm text-zinc-400">
                  Nenhum atleta disponível.
                </div>
              ) : (
                athletes.map((athlete) => (
                  <label
                    key={athlete.id}
                    className="flex cursor-pointer items-center gap-3 rounded-lg border border-zinc-800 px-3 py-2 hover:bg-zinc-900/30"
                  >
                    <input
                      type="checkbox"
                      checked={editingAthleteIdsSet.has(athlete.id)}
                      onChange={() => toggleEditingAthleteSelection(athlete.id)}
                      className="h-4 w-4 cursor-pointer accent-white"
                    />
                    <span className="text-sm text-zinc-100">{formatAthleteLabel(athlete)}</span>
                  </label>
                ))
              )}
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => closeEditModal(false)}
                className="cursor-pointer border-zinc-700 bg-zinc-900/20 text-zinc-100 hover:bg-zinc-800"
              >
                Cancelar
              </Button>
              <Button
                type="button"
                onClick={saveBracketEdit}
                disabled={!editingBracket || editingAthleteIds.length === 0 || editGenderConflict}
                className="cursor-pointer bg-white text-black hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Salvar alterações
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

    </div>
  );
}

