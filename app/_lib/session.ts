import { notFound, redirect } from "next/navigation";
import { cache } from "react";
import "server-only";

import { createClient } from "@/app/_lib/supabase/server";

export const getUser = cache(async () => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  return data.user;
});

export async function requireUser() {
  const user = await getUser();
  if (!user) redirect("/entrar");
  return user;
}

export async function isPlatformAdmin() {
  const supabase = await createClient();
  const { data } = await supabase.rpc("is_platform_admin");
  return data === true;
}

export async function requirePlatformAdmin() {
  const user = await requireUser();
  if (!(await isPlatformAdmin())) notFound();
  return user;
}

export type TenantContext = {
  tenant: {
    id: string;
    name: string;
    slug: string;
    logoPath: string | null;
    settings: Record<string, string>;
  };
  roleCode: string;
  permissions: string[];
  modules: string[];
  subscriptionStatus: string | null;
};

// O tenant é resolvido pela membership do usuário autenticado (via RLS):
// se o slug não for de um tenant do qual ele é membro, a resposta é 404.
export const getTenantContext = cache(async (slug: string): Promise<TenantContext | null> => {
  const user = await getUser();
  if (!user) return null;

  const supabase = await createClient();

  const { data: tenant } = await supabase
    .from("tenants")
    .select("id, name, slug, logo_path, settings")
    .eq("slug", slug)
    .maybeSingle();
  if (!tenant) return null;

  // Depois do tenant, o resto não depende um do outro: uma única rodada em paralelo.
  const [{ data: membership }, { data: allModules }, { data: subStatus }] = await Promise.all([
    supabase
      .from("memberships")
      .select("status, roles(code, role_permissions(permission))")
      .eq("tenant_id", tenant.id)
      .eq("user_id", user.id)
      .eq("status", "active")
      .maybeSingle(),
    supabase.from("modules").select("code"),
    supabase.rpc("subscription_status", { p_tenant: tenant.id }),
  ]);
  if (!membership) return null;

  const role = Array.isArray(membership.roles) ? membership.roles[0] : membership.roles;

  const flags = await Promise.all(
    (allModules ?? []).map(async (m) => {
      const { data } = await supabase.rpc("module_enabled", { p_tenant: tenant.id, p_module: m.code });
      return data === true ? m.code : null;
    })
  );
  const enabled = flags.filter((c): c is string => c !== null);

  return {
    tenant: {
      id: tenant.id,
      name: tenant.name,
      slug: tenant.slug,
      logoPath: tenant.logo_path,
      settings: (tenant.settings ?? {}) as Record<string, string>,
    },
    roleCode: role?.code ?? "",
    permissions: (role?.role_permissions ?? []).map((p: { permission: string }) => p.permission),
    modules: enabled,
    subscriptionStatus: typeof subStatus === "string" ? subStatus : null,
  };
});

export async function requireTenant(slug: string, permission?: string, module?: string) {
  const ctx = await getTenantContext(slug);
  if (!ctx) notFound();
  if (permission && !ctx.permissions.includes(permission)) notFound();
  if (module && !ctx.modules.includes(module)) notFound();
  return ctx;
}
