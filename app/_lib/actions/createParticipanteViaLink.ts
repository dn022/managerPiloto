"use server";

import { supabaseAdmin } from "@/app/_lib/supabase/admin";
import { syncStoredBracketsWithParticipants } from "@/app/_lib/chaveamento-server";
import type { BeltColor, Category, Gender } from "@/app/_lib/types";
import { resolveCategoryByAgeGenderWeight } from "@/app/_lib/weight-categories";

export type CreateParticipantViaLinkInput = {
  token: string;
  academia: string;
  full_name: string;
  cpf: string;
  phone_number: string;
  area_code: string;
  age: number;
  category: Category | null;
  weight_kg: number | null;
  belt_color: BeltColor;
  gender: Gender;
  mod_gi: boolean;
  mod_nogi: boolean;
  mod_gi_extra: boolean;
  responsavel_name?: string;
  responsavel_cpf?: string;
  responsavel_area_code?: string;
  responsavel_phone_number?: string;
};

type DbError = {
  code?: string;
  message?: string;
  constraint?: string;
};

function digitsOnly(value: string | undefined) {
  return (value ?? "").replace(/\D/g, "");
}

function normalizeFullNameUppercase(value: string) {
  return value.trim().replace(/\s+/g, " ").toLocaleUpperCase("pt-BR");
}

function isDuplicateError(error: DbError | null | undefined) {
  if (!error) return false;
  if (error.code === "23505") return true;
  return (error.message ?? "").toLowerCase().includes("duplicate key value");
}

function isPrimaryKeyError(error: DbError | null | undefined) {
  if (!error) return false;
  const constraint = (error.constraint ?? "").toLowerCase();
  const message = (error.message ?? "").toLowerCase();
  return constraint === "participantes_pkey" || message.includes("participantes_pkey");
}

export async function createParticipantViaLink(input: CreateParticipantViaLinkInput) {
  const sb = supabaseAdmin();
  const isFestival = input.age < 8;
  const normalizedCpf = digitsOnly(input.cpf);
  const resolvedCategory = isFestival
    ? null
    : resolveCategoryByAgeGenderWeight({
        age: input.age,
        gender: input.gender,
        weight: input.weight_kg,
      });

  if (!isFestival && (input.weight_kg === null || resolvedCategory === null)) {
    throw new Error("Não foi possível identificar a categoria pelo peso informado.");
  }

  const { data: existingByCpf } = await sb
    .from("participantes")
    .select("id")
    .eq("cpf", normalizedCpf)
    .maybeSingle();

  if (existingByCpf?.id) {
    throw new Error("Já existe uma inscrição com esse CPF.");
  }

  const payloadBase = {
    created_at: new Date().toISOString(),
    nome: normalizeFullNameUppercase(input.full_name),
    cpf: normalizedCpf,
    phone_number: input.phone_number,
    area_code: input.area_code,
    idade: input.age,
    academia: input.academia,
    ...(isFestival ? {} : { categoria: resolvedCategory, peso: input.weight_kg }),
    faixa: input.belt_color ?? null,
    sexo: input.gender ?? null,
    mod_gi: input.mod_gi,
    mod_nogi: input.mod_nogi,
    mod_gi_extra: input.mod_gi_extra,
    festival: isFestival,
    valor_inscricao: 50,
    status: "paid",
    link_token: input.token,
    ...(input.age < 18
      ? {
          responsavel_name: input.responsavel_name?.trim()
            ? normalizeFullNameUppercase(input.responsavel_name)
            : null,
          responsavel_cpf: input.responsavel_cpf ? digitsOnly(input.responsavel_cpf) : null,
          responsavel_area_code: input.responsavel_area_code ?? null,
          responsavel_phone_number: input.responsavel_phone_number ?? null,
        }
      : {}),
  };

  const MAX_ATTEMPTS = 30;

  async function finalizeRegistration(id: string) {
    await syncStoredBracketsWithParticipants();
    return id;
  }

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const { data: lastRow } = await sb
      .from("participantes")
      .select("id")
      .order("id", { ascending: false })
      .limit(1)
      .maybeSingle();

    const maxId = Number(lastRow?.id ?? 0);
    const nextId = Number.isFinite(maxId) ? maxId + 1 : 1;

    const { data, error } = await sb
      .from("participantes")
      .insert({ id: nextId, ...payloadBase })
      .select("id")
      .single();

    if (!error && data?.id) return finalizeRegistration(String(data.id));

    const typedError = error as DbError | null;

    if (typedError?.code === "428C9") {
      const regularInsert = await sb
        .from("participantes")
        .insert(payloadBase)
        .select("id")
        .single();

      if (!regularInsert.error && regularInsert.data?.id) {
        return finalizeRegistration(String(regularInsert.data.id));
      }

      const regularError = regularInsert.error as DbError | null;
      if (isDuplicateError(regularError)) {
        if (isPrimaryKeyError(regularError) && attempt < MAX_ATTEMPTS) continue;
      }

      throw new Error(regularError?.message ?? "Erro ao criar inscrição");
    }

    if (isDuplicateError(typedError)) {
      if (isPrimaryKeyError(typedError) && attempt < MAX_ATTEMPTS) continue;
    }

    throw new Error(typedError?.message ?? "Erro ao criar inscrição");
  }

  throw new Error("Não foi possível concluir a inscrição. Tente novamente.");
}
