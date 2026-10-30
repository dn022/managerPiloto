"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requirePlatformAdmin } from "@/app/_lib/session";
import { createClient } from "@/app/_lib/supabase/server";

export async function createTenant(
  _prev: { error: string | null; ok?: boolean },
  formData: FormData
): Promise<{ error: string | null; ok?: boolean }> {
  await requirePlatformAdmin();

  const name = String(formData.get("name") ?? "").trim();
  const slug = String(formData.get("slug") ?? "").trim().toLowerCase();
  const ownerEmail = String(formData.get("owner_email") ?? "").trim();
  const plan = String(formData.get("plan") ?? "completo");

  if (!name || !slug || !ownerEmail) return { error: "Preencha todos os campos." };

  // A autorização é revalidada no banco (create_tenant exige Super Admin).
  const supabase = await createClient();
  const { error } = await supabase.rpc("create_tenant", {
    p_name: name,
    p_slug: slug,
    p_owner_email: ownerEmail,
    p_plan_code: plan,
  });

  if (error) return { error: error.message };

  revalidatePath("/platform");
  return { error: null, ok: true };
}

// Super Admin: plano, status, validade e overrides de módulo de um tenant.
// Cada RPC revalida is_platform_admin() no banco.
export async function updateSubscription(formData: FormData) {
  await requirePlatformAdmin();
  const tenant = String(formData.get("tenant_id") ?? "");
  const periodEnd = String(formData.get("period_end") ?? "");

  const supabase = await createClient();
  const { error } = await supabase.rpc("set_tenant_subscription", {
    p_tenant: tenant,
    p_plan_code: String(formData.get("plan") ?? ""),
    p_status: String(formData.get("status") ?? ""),
    p_period_end: periodEnd ? new Date(`${periodEnd}T23:59:59`).toISOString() : null,
  });
  if (error) redirect(`/platform?erro=${encodeURIComponent(error.message)}`);

  for (const [key, value] of formData.entries()) {
    if (!key.startsWith("module:")) continue;
    const { error: modError } = await supabase.rpc("set_tenant_module", {
      p_tenant: tenant,
      p_module: key.slice("module:".length),
      p_enabled: value === "on" ? true : value === "off" ? false : null,
    });
    if (modError) redirect(`/platform?erro=${encodeURIComponent(modError.message)}`);
  }

  revalidatePath("/platform");
  redirect("/platform");
}
