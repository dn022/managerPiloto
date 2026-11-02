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
  if (message.includes("turma lotada")) return "Turma lotada. Um administrador pode autorizar uma exceção.";
  if (message.includes("limite do plano")) return "Limite do plano atingido.";
  if (message.includes("duplicate key")) return "Já existe um registro com esses dados.";
  if (message.includes("row-level security")) return "Você não tem permissão para esta ação.";
  return message;
}

// O tenant_id vem sempre da sessão (requireTenant), nunca do formulário.
async function ctx(slug: string, permission: string) {
  return requireTenant(slug, permission, "management");
}

export async function createSport(formData: FormData) {
  const slug = text(formData, "slug");
  const path = `/t/${slug}/modalidades`;
  const { tenant } = await ctx(slug, "sports.write");
  const supabase = await createClient();

  const { error } = await supabase
    .from("sports")
    .insert({ tenant_id: tenant.id, name: text(formData, "name") });
  if (error) fail(path, friendly(error.message));

  revalidatePath(path);
  redirect(path);
}

export async function archiveSport(formData: FormData) {
  const slug = text(formData, "slug");
  const path = `/t/${slug}/modalidades`;
  const { tenant } = await ctx(slug, "sports.write");
  const supabase = await createClient();

  const { error } = await supabase
    .from("sports")
    .update({ deleted_at: new Date().toISOString() })
    .eq("tenant_id", tenant.id)
    .eq("id", text(formData, "id"));
  if (error) fail(path, friendly(error.message));

  revalidatePath(path);
  redirect(path);
}

export async function createTeacher(formData: FormData) {
  const slug = text(formData, "slug");
  const path = `/t/${slug}/professores`;
  const { tenant } = await ctx(slug, "teachers.write");
  const supabase = await createClient();

  const { error } = await supabase.from("teachers").insert({
    tenant_id: tenant.id,
    name: text(formData, "name"),
    phone: optional(formData, "phone"),
    email: optional(formData, "email"),
    notes: optional(formData, "notes"),
  });
  if (error) fail(path, friendly(error.message));

  revalidatePath(path);
  redirect(path);
}

export async function archiveTeacher(formData: FormData) {
  const slug = text(formData, "slug");
  const path = `/t/${slug}/professores`;
  const { tenant } = await ctx(slug, "teachers.write");
  const supabase = await createClient();

  const { error } = await supabase
    .from("teachers")
    .update({ deleted_at: new Date().toISOString() })
    .eq("tenant_id", tenant.id)
    .eq("id", text(formData, "id"));
  if (error) fail(path, friendly(error.message));

  revalidatePath(path);
  redirect(path);
}

export async function createStudent(formData: FormData) {
  const slug = text(formData, "slug");
  const path = `/t/${slug}/alunos`;
  const { tenant } = await ctx(slug, "students.write");
  const supabase = await createClient();

  const { error } = await supabase.from("students").insert({
    tenant_id: tenant.id,
    name: text(formData, "name"),
    phone: optional(formData, "phone"),
    email: optional(formData, "email"),
    birth_date: optional(formData, "birth_date"),
    document: optional(formData, "document"),
    notes: optional(formData, "notes"),
  });
  if (error) fail(path, friendly(error.message));

  revalidatePath(path);
  redirect(path);
}

export async function archiveStudent(formData: FormData) {
  const slug = text(formData, "slug");
  const path = `/t/${slug}/alunos`;
  const { tenant } = await ctx(slug, "students.write");
  const supabase = await createClient();

  const { error } = await supabase
    .from("students")
    .update({ deleted_at: new Date().toISOString(), status: "inactive" })
    .eq("tenant_id", tenant.id)
    .eq("id", text(formData, "id"));
  if (error) fail(path, friendly(error.message));

  revalidatePath(path);
  redirect(path);
}

export async function createClass(formData: FormData) {
  const slug = text(formData, "slug");
  const path = `/t/${slug}/turmas`;
  const { tenant } = await ctx(slug, "classes.write");
  const supabase = await createClient();

  const fee = Math.round(Number(text(formData, "monthly_fee").replace(",", ".")) * 100);

  const { data, error } = await supabase
    .from("classes")
    .insert({
      tenant_id: tenant.id,
      sport_id: text(formData, "sport_id"),
      teacher_id: optional(formData, "teacher_id"),
      name: text(formData, "name"),
      capacity: Number(text(formData, "capacity")),
      monthly_fee_cents: Number.isFinite(fee) && fee >= 0 ? fee : 0,
      notes: optional(formData, "notes"),
    })
    .select("id")
    .single();
  if (error || !data) fail(path, friendly(error?.message ?? "Não foi possível criar a turma."));

  revalidatePath(path);
  redirect(`${path}/${data.id}`);
}

export async function addSchedule(formData: FormData) {
  const slug = text(formData, "slug");
  const classId = text(formData, "class_id");
  const path = `/t/${slug}/turmas/${classId}`;
  const { tenant } = await ctx(slug, "classes.write");
  const supabase = await createClient();

  const { error } = await supabase.from("class_schedules").insert({
    tenant_id: tenant.id,
    class_id: classId,
    weekday: Number(text(formData, "weekday")),
    start_time: text(formData, "start_time"),
    end_time: text(formData, "end_time"),
  });
  if (error) fail(path, friendly(error.message));

  revalidatePath(path);
  redirect(path);
}

export async function removeSchedule(formData: FormData) {
  const slug = text(formData, "slug");
  const classId = text(formData, "class_id");
  const path = `/t/${slug}/turmas/${classId}`;
  const { tenant } = await ctx(slug, "classes.write");
  const supabase = await createClient();

  const { error } = await supabase
    .from("class_schedules")
    .delete()
    .eq("tenant_id", tenant.id)
    .eq("id", text(formData, "id"));
  if (error) fail(path, friendly(error.message));

  revalidatePath(path);
  redirect(path);
}

export async function enrollStudent(formData: FormData) {
  const slug = text(formData, "slug");
  const classId = text(formData, "class_id");
  const path = `/t/${slug}/turmas/${classId}`;
  const { tenant, permissions } = await ctx(slug, "enrollments.write");
  const supabase = await createClient();

  const override = formData.get("capacity_override") === "on";
  if (override && !permissions.includes("enrollments.override")) {
    fail(path, "Você não pode autorizar exceção de capacidade.");
  }

  const fee = Math.round(Number(text(formData, "fee").replace(",", ".")) * 100);

  const { error } = await supabase.from("enrollments").insert({
    tenant_id: tenant.id,
    student_id: text(formData, "student_id"),
    class_id: classId,
    fee_cents: Number.isFinite(fee) && fee >= 0 ? fee : 0,
    capacity_override: override,
    notes: optional(formData, "notes"),
  });
  if (error) fail(path, friendly(error.message));

  revalidatePath(path);
  redirect(path);
}

export async function endEnrollment(formData: FormData) {
  const slug = text(formData, "slug");
  const classId = text(formData, "class_id");
  const path = `/t/${slug}/turmas/${classId}`;
  const { tenant } = await ctx(slug, "enrollments.write");
  const supabase = await createClient();

  const { error } = await supabase
    .from("enrollments")
    .update({ status: "ended", ended_at: new Date().toISOString().slice(0, 10) })
    .eq("tenant_id", tenant.id)
    .eq("id", text(formData, "id"));
  if (error) fail(path, friendly(error.message));

  revalidatePath(path);
  redirect(path);
}
