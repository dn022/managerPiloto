"use server";

import { supabaseAdmin } from "@/app/_lib/supabase/admin";

type PaymentRow = {
  status: string | null;
  payment_method: string | null;
  amount_cents: number | null;
  created_at: string | null;
};

function digitsOnly(value: string | null | undefined) {
  return (value ?? "").replace(/\D/g, "");
}

function formatPhoneBR(areaCodeRaw?: string | null, phoneRaw?: string | null) {
  const areaCode = digitsOnly(areaCodeRaw);
  const phone = digitsOnly(phoneRaw);

  if (areaCode.length === 2 && (phone.length === 8 || phone.length === 9)) {
    return phone.length === 9
      ? `(${areaCode}) ${phone.slice(0, 5)}-${phone.slice(5)}`
      : `(${areaCode}) ${phone.slice(0, 4)}-${phone.slice(4)}`;
  }

  const merged = digitsOnly(`${areaCodeRaw ?? ""}${phoneRaw ?? ""}`);
  if (merged.length === 11) {
    return `(${merged.slice(0, 2)}) ${merged.slice(2, 7)}-${merged.slice(7)}`;
  }
  if (merged.length === 10) {
    return `(${merged.slice(0, 2)}) ${merged.slice(2, 6)}-${merged.slice(6)}`;
  }

  return null;
}

function normalizePaymentMethod(method: string | null | undefined) {
  switch (method) {
    case "pix":
      return "pix";
    case "credit_card":
      return "credit_card";
    default:
      return null;
  }
}

type ParticipantRow = {
  id: string | number;
  nome: string | null;
  cpf: string | null;
  faixa: string | null;
  categoria: string | null;
  peso: number | null;
  phone_number: string | null;
  area_code: string | null;
  valor_inscricao: number | null;
  mod_gi: boolean | null;
  mod_nogi: boolean | null;
  mod_gi_extra: boolean | null;
  festival: boolean | null;
  status?: string | null;
};

async function getPaymentSnapshot(registrationId: string) {
  const sb = supabaseAdmin();

  const { data: approvedPayment } = await sb
    .from("payments")
    .select("status, payment_method, amount_cents, created_at")
    .eq("registration_id", registrationId)
    .eq("status", "approved")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<PaymentRow>();

  if (approvedPayment) {
    return approvedPayment;
  }

  const { data: latestPayment } = await sb
    .from("payments")
    .select("status, payment_method, amount_cents, created_at")
    .eq("registration_id", registrationId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<PaymentRow>();

  return latestPayment ?? null;
}

function mapParticipantSummary(participant: ParticipantRow, payment: PaymentRow | null) {
  const registrationId = String(participant.id);
  const paymentMethod = normalizePaymentMethod(payment?.payment_method);
  const paidAmount =
    typeof payment?.amount_cents === "number"
      ? payment.amount_cents / 100
      : participant.valor_inscricao ?? null;

  const paidStatus =
    payment?.status === "approved" || participant.status === "paid" ? "paid" : "pending";

  return {
    id: registrationId,
    nome: participant.nome ?? "-",
    cpf: participant.cpf ?? "-",
    faixa: participant.faixa ?? "-",
    categoria: participant.categoria ?? null,
    peso: participant.peso ?? null,
    wpp:
      formatPhoneBR(participant.area_code, participant.phone_number) ??
      participant.phone_number ??
      "-",
    valor: participant.valor_inscricao ?? 0,
    mods: {
      gi: Boolean(participant.mod_gi),
      nogi: Boolean(participant.mod_nogi),
      abs: Boolean(participant.mod_gi_extra),
      festival: Boolean(participant.festival),
    },
    payment: {
      status: payment?.status ?? null,
      method: paymentMethod,
      amount: paidAmount,
      createdAt: payment?.created_at ?? null,
    },
    status: paidStatus,
  };
}

export async function getRegistrationSummaryById(id: string) {
  const sb = supabaseAdmin();
  const { data, error } = await sb
    .from("participantes")
    .select(
      "id, nome, cpf, faixa, categoria, peso, phone_number, area_code, valor_inscricao, mod_gi, mod_nogi, mod_gi_extra, festival, status"
    )
    .eq("id", id)
    .single<ParticipantRow>();

  if (error || !data) {
    return null;
  }

  const payment = await getPaymentSnapshot(String(data.id));
  return mapParticipantSummary(data, payment);
}

export async function getRegistrationSummaryByCpf(cpf: string) {
  const sb = supabaseAdmin();
  const normalizedCpf = digitsOnly(cpf);

  const { data, error } = await sb
    .from("participantes")
    .select(
      "id, nome, cpf, faixa, categoria, peso, phone_number, area_code, valor_inscricao, mod_gi, mod_nogi, mod_gi_extra, festival, status"
    )
    .eq("cpf", normalizedCpf)
    .maybeSingle<ParticipantRow>();

  if (error || !data) {
    return null;
  }

  const payment = await getPaymentSnapshot(String(data.id));
  return mapParticipantSummary(data, payment);
}
