export const runtime = "nodejs";
import { NextRequest, NextResponse } from "next/server";
import { createCusto } from "@/app/_lib/actions/custos";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { descricao, valor, data, categoria } = body;

    if (!descricao || !valor || !data) {
      return NextResponse.json({ error: "Campos obrigatórios ausentes" }, { status: 400 });
    }

    const custo = await createCusto({ descricao, valor: Number(valor), data, categoria: categoria ?? "Geral" });
    return NextResponse.json({ custo }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Erro ao criar custo" },
      { status: 500 }
    );
  }
}
