export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getRegistrationSummaryById } from "@/app/_lib/registration-summary";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "id obrigatorio" }, { status: 400 });
  }

  const summary = await getRegistrationSummaryById(id);

  if (!summary) {
    return NextResponse.json({ error: "Participante nao encontrado" }, { status: 404 });
  }

  return NextResponse.json(summary);
}
