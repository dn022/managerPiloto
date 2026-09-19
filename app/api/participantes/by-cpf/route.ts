import { NextResponse } from "next/server";
import { getRegistrationSummaryByCpf } from "@/app/_lib/registration-summary";

export async function POST(req: Request) {
  try {
    const { cpf } = await req.json();

    if (!cpf) {
      return NextResponse.json({ error: "CPF nao informado" }, { status: 400 });
    }

    const summary = await getRegistrationSummaryByCpf(cpf);
    return NextResponse.json(summary ?? null, { status: 200 });
  } catch (err) {
    console.error("Erro API CPF:", err);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
