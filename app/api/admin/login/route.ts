export const runtime = "nodejs";
import { NextRequest, NextResponse } from "next/server";

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "admin123";

export async function POST(request: NextRequest) {
  try {
    const { password } = await request.json();

    if (!password) {
      return NextResponse.json(
        { error: "Senha é obrigatória" },
        { status: 400 }
      );
    }

    if (password !== ADMIN_PASSWORD) {
      return NextResponse.json(
        { error: "Senha inválida" },
        { status: 401 }
      );
    }

    const token = Buffer.from(`admin-${Date.now()}`).toString("base64");

    const response = NextResponse.json(
      { success: true, message: "Login realizado com sucesso" },
      { status: 200 }
    );

    response.cookies.set("admin_auth", token, {
      httpOnly: false, 
      secure: process.env.NODE_ENV === "production", 
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7, 
      path: "/",
    });

    return response;
  } catch {
    return NextResponse.json(
      { error: "Erro ao processar login" },
      { status: 500 }
    );
  }
}

