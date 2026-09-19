import { NextResponse } from "next/server";
import { paymentClient } from "@/app/_lib/mercadopago";
import { supabaseAdmin } from "@/app/_lib/supabase/admin";
import { syncStoredBracketsWithParticipants } from "@/app/_lib/chaveamento-server";

export async function POST(req: Request) {
  const body = await req.json();

  if (body.type === "payment") {
    const payment = await paymentClient.get({ id: Number(body.data.id) });

    if (payment.status === "approved") {
      const registrationId = payment.external_reference ?? payment.metadata?.registration_id;
      const sb = supabaseAdmin();

      await sb
        .from("payments")
        .update({ status: "approved" })
        .eq("gateway_payment_id", String(body.data.id));

      if (registrationId) {
        await sb
          .from("participantes")
          .update({ status: "paid" })
          .eq("id", String(registrationId));

        try {
          await syncStoredBracketsWithParticipants();
        } catch (syncError) {
          console.error("Erro ao sincronizar chaveamento:", syncError);
        }
      }
    }
  }

  return NextResponse.json({ received: true });
}