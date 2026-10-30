"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireTenant } from "@/app/_lib/session";
import { createClient } from "@/app/_lib/supabase/server";

const text = (fd: FormData, key: string) => String(fd.get(key) ?? "").trim();

const LOGO_TYPES: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" };
const LOGO_MAX_BYTES = 1024 * 1024;
const SETTING_KEYS = ["phone", "whatsapp", "instagram", "website", "address", "primary_color"] as const;

function fail(path: string, message: string): never {
  redirect(`${path}?erro=${encodeURIComponent(message)}`);
}

function ok(path: string): never {
  redirect(`${path}?ok=1`);
}

function friendly(message: string) {
  if (message.includes("tenants_settings_valid")) return "Alguma informação está em formato inválido (a cor deve ser #RRGGBB).";
  if (message.includes("row-level security")) return "Você não tem permissão para esta ação.";
  if (message.includes("permission denied")) return "Você não tem permissão para esta ação.";
  return message;
}

// O tenant_id vem sempre da sessão (requireTenant), nunca do formulário.
const manage = (slug: string) => requireTenant(slug, "tenant.manage");

export async function updateOrganization(formData: FormData) {
  const slug = text(formData, "slug");
  const path = `/t/${slug}/configuracoes`;
  const { tenant } = await manage(slug);

  const name = text(formData, "name");
  if (!name) fail(path, "Informe o nome da organização.");

  const settings: Record<string, string> = {};
  for (const key of SETTING_KEYS) {
    const value = text(formData, key);
    if (value) settings[key] = value;
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tenants")
    .update({ name, settings })
    .eq("id", tenant.id)
    .select("id");
  if (error) fail(path, friendly(error.message));
  if (!data?.length) fail(path, "Você não tem permissão para esta ação.");

  revalidatePath(`/t/${slug}`, "layout");
  ok(path);
}

export async function uploadLogo(formData: FormData) {
  const slug = text(formData, "slug");
  const path = `/t/${slug}/configuracoes`;
  const { tenant } = await manage(slug);

  const file = formData.get("logo");
  if (!(file instanceof File) || file.size === 0) fail(path, "Selecione uma imagem.");
  const ext = LOGO_TYPES[file.type];
  if (!ext) fail(path, "Use uma imagem PNG, JPG ou WebP.");
  if (file.size > LOGO_MAX_BYTES) fail(path, "A imagem deve ter no máximo 1 MB.");

  const supabase = await createClient();
  const newPath = `${tenant.id}/logo-${Date.now()}.${ext}`;
  const { error: upError } = await supabase.storage
    .from("tenant-assets")
    .upload(newPath, file, { contentType: file.type, upsert: false });
  if (upError) fail(path, friendly(upError.message));

  const { data, error } = await supabase.from("tenants").update({ logo_path: newPath }).eq("id", tenant.id).select("id");
  if (error || !data?.length) {
    await supabase.storage.from("tenant-assets").remove([newPath]);
    fail(path, friendly(error?.message ?? "Não foi possível salvar o logo."));
  }

  if (tenant.logoPath) await supabase.storage.from("tenant-assets").remove([tenant.logoPath]);

  revalidatePath(`/t/${slug}`, "layout");
  ok(path);
}

export async function removeLogo(formData: FormData) {
  const slug = text(formData, "slug");
  const path = `/t/${slug}/configuracoes`;
  const { tenant } = await manage(slug);

  const supabase = await createClient();
  const { error } = await supabase.from("tenants").update({ logo_path: null }).eq("id", tenant.id);
  if (error) fail(path, friendly(error.message));
  if (tenant.logoPath) await supabase.storage.from("tenant-assets").remove([tenant.logoPath]);

  revalidatePath(`/t/${slug}`, "layout");
  ok(path);
}

// --- usuários (RPCs validam users.manage e as regras de owner no banco)

const usersCtx = (slug: string) => requireTenant(slug, "users.manage");

export async function addUser(formData: FormData) {
  const slug = text(formData, "slug");
  const path = `/t/${slug}/usuarios`;
  const { tenant } = await usersCtx(slug);

  const email = text(formData, "email").toLowerCase();
  const role = text(formData, "role");
  if (!email || !role) fail(path, "Informe o e-mail e o papel.");

  const supabase = await createClient();
  const { error } = await supabase.rpc("add_member", { p_tenant: tenant.id, p_email: email, p_role_code: role });
  if (error) fail(path, friendly(error.message));

  revalidatePath(path);
  ok(path);
}

export async function setUserStatus(formData: FormData) {
  const slug = text(formData, "slug");
  const path = `/t/${slug}/usuarios`;
  const { tenant } = await usersCtx(slug);

  const supabase = await createClient();
  const { error } = await supabase.rpc("set_member_status", {
    p_tenant: tenant.id,
    p_user: text(formData, "user_id"),
    p_status: text(formData, "status"),
  });
  if (error) fail(path, friendly(error.message));

  revalidatePath(path);
  ok(path);
}
