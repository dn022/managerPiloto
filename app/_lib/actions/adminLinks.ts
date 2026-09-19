"use server";

import { randomBytes } from "crypto";
import { supabaseAdmin } from "@/app/_lib/supabase/admin";

export type LinkInscricao = {
  id: string;
  token: string;
  academia: string;
  quantidade: number;
  inscritos: number;
  created_at: string;
};

export type LinkParticipante = {
  id: string;
  nome: string;
  idade: number;
  academia: string | null;
  faixa: string;
  sexo: string;
  categoria: string | null;
  peso: number | null;
  mod_gi: boolean;
  mod_nogi: boolean;
  mod_gi_extra: boolean;
  festival: boolean;
  created_at: string;
};

type LinkRow = {
  id: string;
  token: string;
  academia: string;
  quantidade: number;
  created_at: string;
};

function generateToken(): string {
  return randomBytes(6).toString("hex");
}

export async function createLink(academia: string, quantidade: number): Promise<LinkInscricao> {
  const sb = supabaseAdmin();
  const token = generateToken();

  const { data, error } = await sb
    .from("link_inscricoes")
    .insert({ token, academia: academia.trim(), quantidade })
    .select("*")
    .single();

  if (error) throw new Error(error.message);

  return { ...(data as LinkRow), inscritos: 0 };
}

export async function listLinks(): Promise<LinkInscricao[]> {
  const sb = supabaseAdmin();

  const { data: links, error } = await sb
    .from("link_inscricoes")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  if (!links || links.length === 0) return [];

  const tokens = (links as LinkRow[]).map((l) => l.token);

  const { data: counts } = await sb
    .from("participantes")
    .select("link_token")
    .in("link_token", tokens);

  const countByToken: Record<string, number> = {};
  for (const row of (counts ?? []) as { link_token: string | null }[]) {
    if (row.link_token) {
      countByToken[row.link_token] = (countByToken[row.link_token] ?? 0) + 1;
    }
  }

  return (links as LinkRow[]).map((l) => ({
    ...l,
    inscritos: countByToken[l.token] ?? 0,
  }));
}

export async function deleteLink(id: string): Promise<void> {
  const sb = supabaseAdmin();
  const { error } = await sb.from("link_inscricoes").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export async function getLinkByToken(token: string): Promise<LinkInscricao | null> {
  const sb = supabaseAdmin();

  const { data: link, error } = await sb
    .from("link_inscricoes")
    .select("*")
    .eq("token", token)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!link) return null;

  const { count } = await sb
    .from("participantes")
    .select("id", { count: "exact", head: true })
    .eq("link_token", token);

  return { ...(link as LinkRow), inscritos: count ?? 0 };
}

export async function getParticipantesByToken(token: string): Promise<LinkParticipante[]> {
  const sb = supabaseAdmin();

  const { data, error } = await sb
    .from("participantes")
    .select(
      "id, nome, idade, academia, faixa, sexo, categoria, peso, mod_gi, mod_nogi, mod_gi_extra, festival, created_at"
    )
    .eq("link_token", token)
    .order("created_at", { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []) as LinkParticipante[];
}
