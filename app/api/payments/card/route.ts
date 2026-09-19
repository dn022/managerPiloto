export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { createCardPayment } from "@/app/_lib/mercadopago";
import { supabaseAdmin } from "@/app/_lib/supabase/admin";
import { syncStoredBracketsWithParticipants } from "@/app/_lib/chaveamento-server";

export async function POST(req: Request) {

  const body = await req.json();

  const { registrationId, token, email, installments, paymentMethodId, issuerId } = body;

  if (Number(installments) > 3) {
    return NextResponse.json(
      { error: "Parcelamento permitido apenas até 3x" },
      { status: 400 }
    );
  }

  const sb = supabaseAdmin();

  const { data: registration } = await sb
    .from("participantes")
    .select("*")
    .eq("id", registrationId)
    .single();

  if (!registration) {
    return NextResponse.json({ error: "Inscrição não encontrada" }, { status: 404 });
  }

  const payment = await createCardPayment({
    amount: registration.valor_inscricao,
    token,
    email,
    installments,
    paymentMethodId,
    ...(issuerId && { issuerId }),
  });

  await sb.from("payments").insert({
    registration_id: registration.id,
    gateway: "mercadopago",
    gateway_payment_id: payment.paymentId,
    payment_method: "credit_card",
    amount_cents: Math.round(registration.valor_inscricao * 100),
    status: payment.status,
  });

  if (payment.status === "approved") {
    await sb.from("participantes").update({ status: "paid" }).eq("id", registration.id);

    try {
      await syncStoredBracketsWithParticipants();
    } catch (syncError) {
      console.error("Erro ao sincronizar chaveamento:", syncError);
    }
  }

  return NextResponse.json({
    status: payment.status,
  });

}
