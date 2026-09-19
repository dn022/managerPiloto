"use server";

import { supabaseAdmin } from "@/app/_lib/supabase/admin";

export type Custo = {
  id: string;
  descricao: string;
  valor: number;
  data: string;
  categoria: string;
  criado_em: string;
};

export async function listCustos(): Promise<Custo[]> {
  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("custos")
    .select("*")
    .order("data", { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []) as Custo[];
}

export async function createCusto(input: {
  descricao: string;
  valor: number;
  data: string;
  categoria: string;
}): Promise<Custo> {
  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("custos")
    .insert([input])
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data as Custo;
}

export async function deleteCusto(id: string): Promise<void> {
  const supabase = supabaseAdmin();
  const { error } = await supabase.from("custos").delete().eq("id", id);
  if (error) throw new Error(error.message);
}
