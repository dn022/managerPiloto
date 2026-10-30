"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  buildRounds,
  emptyWinners,
  placementsOf,
  sanitizeWinners,
  seedSlots,
  type MatchSide,
  type Participant,
} from "@/app/_lib/brackets";
import { requireTenant } from "@/app/_lib/session";
import { createClient } from "@/app/_lib/supabase/server";

const text = (fd: FormData, key: string) => String(fd.get(key) ?? "").trim();
const optional = (fd: FormData, key: string) => text(fd, key) || null;
const optionalNumber = (fd: FormData, key: string) => {
  const raw = text(fd, key).replace(",", ".");
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
};

function fail(path: string, message: string): never {
  redirect(`${path}?erro=${encodeURIComponent(message)}`);
}

function friendly(message: string) {
  if (message.includes("duplicate key")) return "Já existe um registro com esses dados.";
  if (message.includes("row-level security") || message.includes("permission denied")) {
    return "Você não tem permissão para esta ação.";
  }
  if (message.includes("violates check constraint")) return "Algum valor informado é inválido.";
  return message;
}

// O tenant_id vem sempre da sessão (requireTenant), nunca do formulário.
const ctx = (slug: string, permission = "championships.write") =>
  requireTenant(slug, permission, "championships");

const base = (slug: string) => `/t/${slug}/campeonatos`;

export async function createChampionship(formData: FormData) {
  const slug = text(formData, "slug");
  const { tenant } = await ctx(slug);
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("championships")
    .insert({
      tenant_id: tenant.id,
      name: text(formData, "name"),
      event_date: optional(formData, "event_date"),
      location: optional(formData, "location"),
      sport_id: optional(formData, "sport_id"),
    })
    .select("id")
    .single();
  if (error || !data) fail(base(slug), friendly(error?.message ?? "Não foi possível criar o campeonato."));

  revalidatePath(base(slug));
  redirect(`${base(slug)}/${data.id}`);
}

export async function updateChampionship(formData: FormData) {
  const slug = text(formData, "slug");
  const id = text(formData, "id");
  const path = `${base(slug)}/${id}`;
  const { tenant } = await ctx(slug);
  const supabase = await createClient();

  const { error } = await supabase
    .from("championships")
    .update({
      status: text(formData, "status"),
      ranking_id: optional(formData, "ranking_id"),
    })
    .eq("tenant_id", tenant.id)
    .eq("id", id);
  if (error) fail(path, friendly(error.message));

  revalidatePath(path);
  redirect(path);
}

export async function addCategory(formData: FormData) {
  const slug = text(formData, "slug");
  const championshipId = text(formData, "championship_id");
  const path = `${base(slug)}/${championshipId}`;
  const { tenant } = await ctx(slug);
  const supabase = await createClient();

  const { error } = await supabase.from("championship_categories").insert({
    tenant_id: tenant.id,
    championship_id: championshipId,
    name: text(formData, "name"),
    gender: optional(formData, "gender"),
    min_age: optionalNumber(formData, "min_age"),
    max_age: optionalNumber(formData, "max_age"),
    min_weight_kg: optionalNumber(formData, "min_weight_kg"),
    max_weight_kg: optionalNumber(formData, "max_weight_kg"),
    level: optional(formData, "level"),
  });
  if (error) fail(path, friendly(error.message));

  revalidatePath(path);
  redirect(path);
}

export async function removeCategory(formData: FormData) {
  const slug = text(formData, "slug");
  const championshipId = text(formData, "championship_id");
  const path = `${base(slug)}/${championshipId}`;
  const { tenant } = await ctx(slug);
  const supabase = await createClient();

  const { error } = await supabase
    .from("championship_categories")
    .delete()
    .eq("tenant_id", tenant.id)
    .eq("id", text(formData, "id"));
  if (error) fail(path, "Não é possível remover: há inscrições ou chave nesta categoria.");

  revalidatePath(path);
  redirect(path);
}

export async function setPointsRule(formData: FormData) {
  const slug = text(formData, "slug");
  const championshipId = text(formData, "championship_id");
  const path = `${base(slug)}/${championshipId}`;
  const { tenant } = await ctx(slug);
  const supabase = await createClient();

  const { error } = await supabase.from("championship_points_rules").upsert({
    tenant_id: tenant.id,
    championship_id: championshipId,
    placement: Number(text(formData, "placement")),
    points: Number(text(formData, "points")),
  });
  if (error) fail(path, friendly(error.message));

  revalidatePath(path);
  redirect(path);
}

export async function removePointsRule(formData: FormData) {
  const slug = text(formData, "slug");
  const championshipId = text(formData, "championship_id");
  const path = `${base(slug)}/${championshipId}`;
  const { tenant } = await ctx(slug);
  const supabase = await createClient();

  const { error } = await supabase
    .from("championship_points_rules")
    .delete()
    .eq("tenant_id", tenant.id)
    .eq("championship_id", championshipId)
    .eq("placement", Number(text(formData, "placement")));
  if (error) fail(path, friendly(error.message));

  revalidatePath(path);
  redirect(path);
}

export async function addRegistration(formData: FormData) {
  const slug = text(formData, "slug");
  const championshipId = text(formData, "championship_id");
  const path = `${base(slug)}/${championshipId}/inscricoes`;
  const { tenant } = await ctx(slug);
  const supabase = await createClient();

  const studentId = optional(formData, "student_id");
  let name = text(formData, "name");
  if (studentId) {
    const { data: student } = await supabase
      .from("students")
      .select("name")
      .eq("tenant_id", tenant.id)
      .eq("id", studentId)
      .maybeSingle();
    if (!student) fail(path, "Aluno não encontrado.");
    name = student.name;
  }
  if (!name) fail(path, "Informe um aluno ou o nome do atleta.");

  const fee = Math.round(Number(text(formData, "fee").replace(",", ".") || "0") * 100);

  const { error } = await supabase.from("championship_registrations").insert({
    tenant_id: tenant.id,
    championship_id: championshipId,
    category_id: optional(formData, "category_id"),
    student_id: studentId,
    name,
    team: optional(formData, "team"),
    gender: optional(formData, "gender"),
    weight_kg: optionalNumber(formData, "weight_kg"),
    birth_date: optional(formData, "birth_date"),
    phone: optional(formData, "phone"),
    fee_cents: Number.isFinite(fee) && fee >= 0 ? fee : 0,
    status: text(formData, "status") === "pending" ? "pending" : "confirmed",
  });
  if (error) fail(path, friendly(error.message));

  revalidatePath(path);
  redirect(path);
}

export async function setRegistrationStatus(formData: FormData) {
  const slug = text(formData, "slug");
  const championshipId = text(formData, "championship_id");
  const path = `${base(slug)}/${championshipId}/inscricoes`;
  const { tenant } = await ctx(slug);
  const status = text(formData, "status");
  if (!["pending", "confirmed", "cancelled"].includes(status)) fail(path, "Status inválido.");

  const supabase = await createClient();
  const { error } = await supabase
    .from("championship_registrations")
    .update({ status })
    .eq("tenant_id", tenant.id)
    .eq("id", text(formData, "id"));
  if (error) fail(path, friendly(error.message));

  revalidatePath(path);
  redirect(path);
}

// Cria (ou refaz) a chave da categoria com as inscrições confirmadas.
export async function generateBracket(formData: FormData) {
  const slug = text(formData, "slug");
  const championshipId = text(formData, "championship_id");
  const categoryId = text(formData, "category_id");
  const path = `${base(slug)}/${championshipId}/chaves`;
  const { tenant } = await ctx(slug);
  const supabase = await createClient();

  const [{ data: category }, { data: regs }] = await Promise.all([
    supabase
      .from("championship_categories")
      .select("id, name")
      .eq("tenant_id", tenant.id)
      .eq("championship_id", championshipId)
      .eq("id", categoryId)
      .maybeSingle(),
    supabase
      .from("championship_registrations")
      .select("id, name, team")
      .eq("tenant_id", tenant.id)
      .eq("championship_id", championshipId)
      .eq("category_id", categoryId)
      .eq("status", "confirmed"),
  ]);
  if (!category) fail(path, "Categoria não encontrada.");
  if (!regs || regs.length < 2) fail(path, "São necessárias ao menos 2 inscrições confirmadas na categoria.");

  const slots = seedSlots(regs as Participant[]);

  const { error } = await supabase.from("championship_brackets").upsert(
    {
      tenant_id: tenant.id,
      championship_id: championshipId,
      category_id: categoryId,
      name: category.name,
      slots,
      winners: emptyWinners(slots.length),
    },
    { onConflict: "championship_id,category_id" }
  );
  if (error) fail(path, friendly(error.message));

  revalidatePath(path);
  redirect(path);
}

export async function setWinner(formData: FormData) {
  const slug = text(formData, "slug");
  const championshipId = text(formData, "championship_id");
  const path = `${base(slug)}/${championshipId}/chaves`;
  const { tenant } = await ctx(slug);
  const supabase = await createClient();

  const roundIndex = Number(text(formData, "round"));
  const matchIndex = Number(text(formData, "match"));
  const raw = text(formData, "side");
  const side: MatchSide | null = raw === "top" || raw === "bottom" ? raw : null;

  const { data: bracket } = await supabase
    .from("championship_brackets")
    .select("id, slots, winners")
    .eq("tenant_id", tenant.id)
    .eq("id", text(formData, "id"))
    .maybeSingle();
  if (!bracket) fail(path, "Chave não encontrada.");

  const slots = bracket.slots as Array<string | null>;
  const winners = sanitizeWinners(slots.length, bracket.winners);
  if (!winners[roundIndex] || matchIndex < 0 || matchIndex >= winners[roundIndex].length) {
    fail(path, "Luta inválida.");
  }
  winners[roundIndex][matchIndex] = side;

  // Mudar um vencedor invalida as rodadas seguintes.
  for (let r = roundIndex + 1; r < winners.length; r += 1) {
    winners[r] = winners[r].map(() => null);
  }

  const { error } = await supabase
    .from("championship_brackets")
    .update({ winners })
    .eq("tenant_id", tenant.id)
    .eq("id", bracket.id);
  if (error) fail(path, friendly(error.message));

  revalidatePath(path);
  redirect(path);
}

// Lê todas as chaves e grava a colocação (1º, 2º, 3º) de cada categoria decidida.
export async function saveResultsFromBrackets(formData: FormData) {
  const slug = text(formData, "slug");
  const championshipId = text(formData, "championship_id");
  const path = `${base(slug)}/${championshipId}/resultados`;
  const { tenant } = await ctx(slug);
  const supabase = await createClient();

  const [{ data: brackets }, { data: regs }] = await Promise.all([
    supabase
      .from("championship_brackets")
      .select("category_id, slots, winners")
      .eq("tenant_id", tenant.id)
      .eq("championship_id", championshipId),
    supabase
      .from("championship_registrations")
      .select("id, name, team")
      .eq("tenant_id", tenant.id)
      .eq("championship_id", championshipId),
  ]);

  const participants = new Map((regs ?? []).map((r) => [r.id as string, r as Participant]));
  const rows: Array<{
    tenant_id: string;
    championship_id: string;
    category_id: string | null;
    registration_id: string;
    placement: number;
  }> = [];

  for (const bracket of brackets ?? []) {
    const slots = bracket.slots as Array<string | null>;
    const rounds = buildRounds(slots, participants, sanitizeWinners(slots.length, bracket.winners));
    for (const p of placementsOf(rounds)) {
      rows.push({
        tenant_id: tenant.id,
        championship_id: championshipId,
        category_id: bracket.category_id,
        registration_id: p.participantId,
        placement: p.placement,
      });
    }
  }

  if (!rows.length) fail(path, "Nenhuma chave com final decidida.");

  const { error } = await supabase
    .from("championship_results")
    .upsert(rows, { onConflict: "championship_id,registration_id" });
  if (error) fail(path, friendly(error.message));

  revalidatePath(path);
  redirect(path);
}

export async function publishToRanking(formData: FormData) {
  const slug = text(formData, "slug");
  const championshipId = text(formData, "championship_id");
  const path = `${base(slug)}/${championshipId}/resultados`;
  await requireTenant(slug, "championships.write", "championships");
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("publish_results_to_ranking", {
    p_championship: championshipId,
  });
  if (error) fail(path, friendly(error.message));

  revalidatePath(path);
  redirect(`${path}?publicou=${data ?? 0}`);
}

export async function addExpense(formData: FormData) {
  const slug = text(formData, "slug");
  const championshipId = text(formData, "championship_id");
  const path = `${base(slug)}/${championshipId}/despesas`;
  const { tenant } = await ctx(slug, "payments.write");
  const supabase = await createClient();

  const amount = Math.round(Number(text(formData, "amount").replace(",", ".")) * 100);
  if (!Number.isFinite(amount) || amount < 0) fail(path, "Valor inválido.");

  const { error } = await supabase.from("championship_expenses").insert({
    tenant_id: tenant.id,
    championship_id: championshipId,
    description: text(formData, "description"),
    category: optional(formData, "category"),
    amount_cents: amount,
    spent_on: optional(formData, "spent_on") ?? new Date().toISOString().slice(0, 10),
  });
  if (error) fail(path, friendly(error.message));

  revalidatePath(path);
  redirect(path);
}

export async function removeExpense(formData: FormData) {
  const slug = text(formData, "slug");
  const championshipId = text(formData, "championship_id");
  const path = `${base(slug)}/${championshipId}/despesas`;
  const { tenant } = await ctx(slug, "payments.write");
  const supabase = await createClient();

  const { error } = await supabase
    .from("championship_expenses")
    .delete()
    .eq("tenant_id", tenant.id)
    .eq("id", text(formData, "id"));
  if (error) fail(path, friendly(error.message));

  revalidatePath(path);
  redirect(path);
}
