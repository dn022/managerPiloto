export const runtime = "nodejs";
import { NextRequest, NextResponse } from "next/server";
import { deleteCusto } from "@/app/_lib/actions/custos";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await deleteCusto(id);
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Erro ao deletar" },
      { status: 500 }
    );
  }
}
