export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/app/_lib/supabase/admin";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const registrationId = searchParams.get("registrationId");

  if (!registrationId) {
    return NextResponse.json({ error: "registrationId obrigatorio" }, { status: 400 });
  }

  const sb = supabaseAdmin();

  const { data, error } = await sb
    .from("payments")
    .select("status")
    .eq("registration_id", registrationId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: "Erro ao consultar pagamento" }, { status: 500 });
  }

  if (!data) {
    return NextResponse.json({ status: "pending" });
  }

  return NextResponse.json({
    status: data.status,
  });
}