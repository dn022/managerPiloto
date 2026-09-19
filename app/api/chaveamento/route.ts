import { NextRequest, NextResponse } from "next/server";

import {
  getChaveamentoAthletes,
  saveStoredBrackets,
  syncStoredBracketsWithParticipants,
} from "@/app/_lib/chaveamento-server";
import { normalizeStoredBracket, type StoredBracket } from "@/app/_lib/chaveamento";

function isAdmin(request: NextRequest) {
  return Boolean(request.cookies.get("admin_auth")?.value);
}

export async function GET() {
  try {
    const { athletes, brackets } = await syncStoredBracketsWithParticipants();
    return NextResponse.json({ athletes, brackets, rulesFile: "app/_lib/chaveamento-rules.ts" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao carregar chaveamento.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  if (!isAdmin(request)) {
    return NextResponse.json({ error: "Nao autorizado." }, { status: 401 });
  }

  try {
    const body = await request.json();
    const input = Array.isArray(body?.brackets) ? body.brackets : [];
    const brackets = input
      .map((bracket: unknown) => normalizeStoredBracket(bracket))
      .filter((bracket: StoredBracket | null): bracket is StoredBracket => bracket !== null);

    if (brackets.length !== input.length) {
      return NextResponse.json({ error: "Formato de chaveamento invalido." }, { status: 400 });
    }

    await saveStoredBrackets(brackets);
    const athletes = await getChaveamentoAthletes();
    return NextResponse.json({ success: true, athletes });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao salvar chaveamento.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
