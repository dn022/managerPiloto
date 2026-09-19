import "server-only";

import { supabaseAdmin } from "@/app/_lib/supabase/admin";
import {
  type Athlete,
  type StoredBracket,
  normalizeStoredBracket,
  syncAutomaticBrackets,
} from "@/app/_lib/chaveamento";

type BracketRow = {
  id: string;
  name: string;
  description: string;
  athlete_ids: unknown;
  slot_athlete_ids: unknown;
  winner_selections: unknown;
  metadata?: unknown;
};

function mapAthlete(row: Record<string, unknown>): Athlete {
  return {
    id: String(row.id ?? ""),
    nome: String(row.nome ?? ""),
    academy: row.academia === null || row.academia === undefined ? null : String(row.academia),
    idade: Number(row.idade ?? 0),
    peso: row.peso === null || row.peso === undefined ? null : Number(row.peso),
    faixa: String(row.faixa ?? ""),
    categoria: row.categoria === null || row.categoria === undefined ? null : String(row.categoria),
    sexo: row.sexo === "M" || row.sexo === "F" ? row.sexo : null,
    festival: Boolean(row.festival),
    status: String(row.status ?? ""),
  };
}

function mapBracket(row: BracketRow): StoredBracket | null {
  return normalizeStoredBracket({
    id: row.id,
    name: row.name,
    description: row.description,
    athleteIds: row.athlete_ids,
    slotAthleteIds: row.slot_athlete_ids,
    winnerSelections: row.winner_selections,
    metadata: row.metadata,
  });
}

function isMissingTableError(error: { code?: string; message?: string } | null) {
  if (!error) return false;
  if (error.code === "42P01" || error.code === "PGRST205") return true;
  return (error.message ?? "").toLowerCase().includes("could not find the table");
}

function isMissingMetadataColumnError(error: { code?: string; message?: string } | null) {
  if (!error) return false;
  const message = (error.message ?? "").toLowerCase();
  return (
    message.includes("column chaveamentos.metadata does not exist") ||
    message.includes("could not find the 'metadata' column of 'chaveamentos'")
  );
}

export async function getChaveamentoAthletes() {
  const sb = supabaseAdmin();
  const { data, error } = await sb
    .from("participantes")
    .select("id, nome, academia, idade, peso, faixa, categoria, sexo, festival, status")
    .eq("status", "paid")
    .order("nome", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).map((row) => mapAthlete(row as Record<string, unknown>));
}

export async function getStoredBrackets() {
  const sb = supabaseAdmin();
  let data: BracketRow[] | null = null;
  let error: { code?: string; message?: string } | null = null;

  const primaryQuery = await sb
    .from("chaveamentos")
    .select("id, name, description, athlete_ids, slot_athlete_ids, winner_selections, metadata")
    .order("updated_at", { ascending: false });

  data = (primaryQuery.data ?? null) as BracketRow[] | null;
  error = primaryQuery.error;

  if (isMissingMetadataColumnError(error)) {
    const fallback = await sb
      .from("chaveamentos")
      .select("id, name, description, athlete_ids, slot_athlete_ids, winner_selections")
      .order("updated_at", { ascending: false });

    data = (fallback.data ?? null) as BracketRow[] | null;
    error = fallback.error;
  }

  if (error) {
    if (isMissingTableError(error)) return [];
    throw new Error(error.message);
  }

  return (data ?? [])
    .map((row) => mapBracket(row as BracketRow))
    .filter((row): row is StoredBracket => row !== null);
}

export async function saveStoredBrackets(brackets: StoredBracket[]) {
  const sb = supabaseAdmin();
  const rows = brackets.map((bracket) => ({
    id: bracket.id,
    name: bracket.name,
    description: bracket.description,
    athlete_ids: bracket.athleteIds,
    slot_athlete_ids: bracket.slotAthleteIds,
    winner_selections: bracket.winnerSelections,
    metadata: bracket.metadata,
  }));
  const legacyRows = brackets.map((bracket) => ({
    id: bracket.id,
    name: bracket.name,
    description: bracket.description,
    athlete_ids: bracket.athleteIds,
    slot_athlete_ids: bracket.slotAthleteIds,
    winner_selections: bracket.winnerSelections,
  }));

  const { data: existingRows, error: existingError } = await sb.from("chaveamentos").select("id");
  if (existingError) {
    if (isMissingTableError(existingError)) {
      throw new Error(
        "Tabela 'chaveamentos' nao encontrada. Execute o arquivo Notes/chaveamentos.sql no Supabase."
      );
    }
    throw new Error(existingError.message);
  }

  const existingIds = new Set((existingRows ?? []).map((row) => String(row.id)));
  const nextIds = new Set(brackets.map((bracket) => bracket.id));
  const idsToDelete = Array.from(existingIds).filter((id) => !nextIds.has(id));

  if (rows.length > 0) {
    let { error: upsertError } = await sb.from("chaveamentos").upsert(rows, { onConflict: "id" });

    if (isMissingMetadataColumnError(upsertError)) {
      const legacyUpsert = await sb.from("chaveamentos").upsert(legacyRows, { onConflict: "id" });
      upsertError = legacyUpsert.error;
    }

    if (upsertError) {
      throw new Error(upsertError.message);
    }
  }

  if (idsToDelete.length > 0) {
    const { error: deleteError } = await sb.from("chaveamentos").delete().in("id", idsToDelete);
    if (deleteError) {
      throw new Error(deleteError.message);
    }
  }

  if (rows.length === 0 && existingIds.size > 0) {
    const { error: clearError } = await sb.from("chaveamentos").delete().in("id", Array.from(existingIds));
    if (clearError) {
      throw new Error(clearError.message);
    }
  }
}

export async function syncStoredBracketsWithParticipants() {
  const [athletes, storedBrackets] = await Promise.all([getChaveamentoAthletes(), getStoredBrackets()]);
  const syncedBrackets = syncAutomaticBrackets(storedBrackets, athletes);
  await saveStoredBrackets(syncedBrackets);
  return { athletes, brackets: syncedBrackets };
}
