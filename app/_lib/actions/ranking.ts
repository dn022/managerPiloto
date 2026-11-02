"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireTenant } from "@/app/_lib/session";
import { createClient } from "@/app/_lib/supabase/server";

const text = (fd: FormData, key: string) => String(fd.get(key) ?? "").trim();
const optional = (fd: FormData, key: string) => text(fd, key) || null;

function fail(path: string, message: string): never {
  redirect(`${path}?erro=${encodeURIComponent(message)}`);
}

function friendly(message: string) {
  if (message.includes("duplicate key")) return "Já existe um registro com esses dados.";
  if (message.includes("row-level security")) return "Você não tem permissão para esta ação.";
  if (message.includes("ranking_point_events_check") || message.includes("points_check")) {
    return "Informe uma pontuação diferente de zero.";
  }
  return message;
}

// O tenant_id vem sempre da sessão (requireTenant), nunca do formulário.
const ctx = (slug: string) => requireTenant(slug, "rankings.write", "ranking");

export async function createRanking(formData: FormData) {
  const slug = text(formData, "slug");
  const path = `/t/${slug}/ranking`;
  const { tenant } = await ctx(slug);
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("rankings")
    .insert({
      tenant_id: tenant.id,
      name: text(formData, "name"),
      season: text(formData, "season"),
      sport_id: optional(formData, "sport_id"),
    })
    .select("id")
    .single();
  if (error || !data) fail(path, friendly(error?.message ?? "Não foi possível criar o ranking."));

  revalidatePath(path);
  redirect(`${path}/${data.id}`);
}

export async function addCategory(formData: FormData) {
  const slug = text(formData, "slug");
  const rankingId = text(formData, "ranking_id");
  const path = `/t/${slug}/ranking/${rankingId}`;
  const { tenant } = await ctx(slug);
  const supabase = await createClient();

  const { error } = await supabase
    .from("ranking_categories")
    .insert({ tenant_id: tenant.id, ranking_id: rankingId, name: text(formData, "name") });
  if (error) fail(path, friendly(error.message));

  revalidatePath(path);
  redirect(path);
}

export async function addEntry(formData: FormData) {
  const slug = text(formData, "slug");
  const rankingId = text(formData, "ranking_id");
  const path = `/t/${slug}/ranking/${rankingId}`;
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

  const { error } = await supabase.from("ranking_entries").insert({
    tenant_id: tenant.id,
    ranking_id: rankingId,
    category_id: optional(formData, "category_id"),
    student_id: studentId,
    name,
  });
  if (error) fail(path, friendly(error.message));

  revalidatePath(path);
  redirect(path);
}

export async function addPoints(formData: FormData) {
  const slug = text(formData, "slug");
  const rankingId = text(formData, "ranking_id");
  const path = `/t/${slug}/ranking/${rankingId}`;
  const { tenant } = await ctx(slug);
  const supabase = await createClient();

  const points = Number(text(formData, "points"));
  if (!Number.isInteger(points) || points === 0) fail(path, "Informe uma pontuação inteira diferente de zero.");

  const { error } = await supabase.from("ranking_point_events").insert({
    tenant_id: tenant.id,
    entry_id: text(formData, "entry_id"),
    points,
    reason: text(formData, "reason"),
  });
  if (error) fail(path, friendly(error.message));

  revalidatePath(path);
  redirect(path);
}

export async function deactivateEntry(formData: FormData) {
  const slug = text(formData, "slug");
  const rankingId = text(formData, "ranking_id");
  const path = `/t/${slug}/ranking/${rankingId}`;
  const { tenant } = await ctx(slug);
  const supabase = await createClient();

  const { error } = await supabase
    .from("ranking_entries")
    .update({ active: false })
    .eq("tenant_id", tenant.id)
    .eq("id", text(formData, "id"));
  if (error) fail(path, friendly(error.message));

  revalidatePath(path);
  redirect(path);
}

export async function archiveRanking(formData: FormData) {
  const slug = text(formData, "slug");
  const path = `/t/${slug}/ranking`;
  const { tenant } = await ctx(slug);
  const supabase = await createClient();

  const { error } = await supabase
    .from("rankings")
    .update({ status: "archived" })
    .eq("tenant_id", tenant.id)
    .eq("id", text(formData, "id"));
  if (error) fail(path, friendly(error.message));

  revalidatePath(path);
  redirect(path);
}
