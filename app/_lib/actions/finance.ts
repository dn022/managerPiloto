"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireTenant } from "@/app/_lib/session";
import { createClient } from "@/app/_lib/supabase/server";

const text = (fd: FormData, key: string) => String(fd.get(key) ?? "").trim();

function back(slug: string, competence: string, params: Record<string, string> = {}): never {
  const qs = new URLSearchParams({ competencia: competence.slice(0, 7), ...params });
  redirect(`/t/${slug}/mensalidades?${qs.toString()}`);
}

function friendly(message: string) {
  if (message.includes("row-level security") || message.includes("permission denied")) {
    return "Você não tem permissão para esta ação.";
  }
  return message;
}

const cents = (value: string) => {
  const n = Math.round(Number(value.replace(",", ".")) * 100);
  return Number.isFinite(n) && n >= 0 ? n : null;
};

export async function generateInvoices(formData: FormData) {
  const slug = text(formData, "slug");
  const competence = `${text(formData, "competencia")}-01`;
  const { tenant } = await requireTenant(slug, "payments.write", "management");
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("generate_monthly_invoices", {
    p_tenant: tenant.id,
    p_competence: competence,
    p_due_day: Number(text(formData, "due_day")) || 10,
  });
  if (error) back(slug, competence, { erro: friendly(error.message) });

  revalidatePath(`/t/${slug}/mensalidades`);
  back(slug, competence, { gerou: String(data ?? 0) });
}

export async function markInvoicePaid(formData: FormData) {
  const slug = text(formData, "slug");
  const competence = text(formData, "competence");
  const { tenant } = await requireTenant(slug, "payments.write", "management");
  const supabase = await createClient();

  const amount = cents(text(formData, "amount"));
  if (amount === null) back(slug, competence, { erro: "Valor inválido." });

  const { error } = await supabase
    .from("invoices")
    .update({ status: "paid", paid_at: new Date().toISOString(), paid_amount_cents: amount })
    .eq("tenant_id", tenant.id)
    .eq("id", text(formData, "id"));
  if (error) back(slug, competence, { erro: friendly(error.message) });

  revalidatePath(`/t/${slug}/mensalidades`);
  back(slug, competence);
}

// Muda o status para cancelled | exempt | pending (reabrir).
export async function setInvoiceStatus(formData: FormData) {
  const slug = text(formData, "slug");
  const competence = text(formData, "competence");
  const status = text(formData, "status");
  const { tenant } = await requireTenant(slug, "payments.write", "management");

  if (!["cancelled", "exempt", "pending"].includes(status)) {
    back(slug, competence, { erro: "Status inválido." });
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("invoices")
    .update({ status, paid_at: null, paid_amount_cents: null })
    .eq("tenant_id", tenant.id)
    .eq("id", text(formData, "id"));
  if (error) back(slug, competence, { erro: friendly(error.message) });

  revalidatePath(`/t/${slug}/mensalidades`);
  back(slug, competence);
}
