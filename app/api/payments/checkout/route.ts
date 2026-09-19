import { NextResponse } from "next/server";
import { preferenceClient } from "@/app/_lib/mercadopago";

export async function POST(req: Request) {

  const { registrationId, fullName } = await req.json();

  const preference = await preferenceClient.create({
    body: {
      items: [
        {
          id: "inscricao",
          title: "Inscrição Campeonato Jiu-Jitsu",
          quantity: 1,
          currency_id: "BRL",
          unit_price: 120,
        },
      ],

      metadata: {
        registration_id: registrationId,
      },

      back_urls: {
        success: `${process.env.NEXT_PUBLIC_SITE_URL}/confirmacao`,
        failure: `${process.env.NEXT_PUBLIC_SITE_URL}/erro`,
        pending: `${process.env.NEXT_PUBLIC_SITE_URL}/pendente`,
      },

      auto_return: "approved" as const,
    },
  });

  const initPoint = preference.init_point ?? preference.sandbox_init_point;

  return NextResponse.json({
    checkoutUrl: initPoint,
  });
}