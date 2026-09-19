export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/app/_lib/supabase/admin";
import { createPixPayment } from "@/app/_lib/mercadopago";

type OpenPaymentRow = {
  status: string;
  pix_copy_paste: string | null;
  pix_qr_code_base64?: string | null;
  qr_code_base64?: string | null;
};

function getQrBase64(row: OpenPaymentRow) {
  return row.pix_qr_code_base64 ?? row.qr_code_base64 ?? null;
}

export async function POST(req: Request) {
  let body: { registrationId?: string | number } = {};

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body invalido" }, { status: 400 });
  }

  const registrationId = String(body.registrationId ?? "").trim();

  if (!registrationId) {
    return NextResponse.json({ error: "registrationId obrigatorio" }, { status: 400 });
  }

  const sb = supabaseAdmin();

  const { data: registration, error } = await sb
    .from("participantes")
    .select("id, valor_inscricao, nome, area_code, phone_number")
    .eq("id", registrationId)
    .single();

  if (error || !registration) {
    console.error("Erro ao buscar inscrição (Supabase):", error);
    return NextResponse.json({ error: "Inscrição não encontrada" }, { status: 404 });
  }

  const { data: openPayment } = await sb
    .from("payments")
    .select("*")
    .eq("registration_id", registrationId)
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .maybeSingle<OpenPaymentRow>();

  if (openPayment) {
    return NextResponse.json({
      pixCopyPaste: openPayment.pix_copy_paste,
      qrCodeBase64: getQrBase64(openPayment),
      status: openPayment.status,
    });
  }

  const previousAppUrl = process.env.APP_URL;
  if (!process.env.APP_URL) {
    process.env.APP_URL = new URL(req.url).origin;
  }

  let payment: Awaited<ReturnType<typeof createPixPayment>>;

  try {
    payment = await createPixPayment({
      amount: registration.valor_inscricao,
      reference: String(registration.id),
      name: registration.nome,
      areaCode: registration.area_code || undefined,
      phoneNumber: registration.phone_number || undefined,
    });
  } catch (mpError) {
    console.error("Erro ao gerar PIX no Mercado Pago:", mpError);
    return NextResponse.json(
      {
        error:
          mpError instanceof Error ? mpError.message : "Não foi possível gerar o PIX no momento",
      },
      { status: 500 }
    );
  } finally {
    if (previousAppUrl === undefined) {
      delete process.env.APP_URL;
    } else {
      process.env.APP_URL = previousAppUrl;
    }
  }

  let { error: insertError } = await sb.from("payments").insert({
    registration_id: registration.id,
    gateway: "mercadopago",
    gateway_payment_id: payment.paymentId,
    payment_method: "pix",
    amount_cents: Math.round(registration.valor_inscricao * 100),
    status: "pending",
    pix_qr_code_base64: payment.qrCodeBase64,
    pix_copy_paste: payment.qrCode,
  });

  if (insertError && (insertError.message ?? "").includes("pix_qr_code_base64")) {
    const fallback = await sb.from("payments").insert({
      registration_id: registration.id,
      gateway: "mercadopago",
      gateway_payment_id: payment.paymentId, 
      payment_method: "pix",
      amount_cents: Math.round(registration.valor_inscricao * 100),
      status: "pending",
      qr_code_base64: payment.qrCodeBase64,
      pix_copy_paste: payment.qrCode,
    });
    insertError = fallback.error;
  }

  if (insertError) {
    console.error("Erro ao salvar pagamento no banco:", insertError);
    return NextResponse.json({ error: "Erro ao registrar pagamento" }, { status: 500 });
  }

  return NextResponse.json({
    qrCodeBase64: payment.qrCodeBase64,
    pixCopyPaste: payment.qrCode,
    status: payment.status,
  });
}
