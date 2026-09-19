import type { BeltColor, Gender } from "@/app/_lib/types";

export const FESTIVAL_AGE_LIMIT = 8;

/** Cinza, amarela, laranja e verde: apenas até 15 anos (regra IBJJF infantil). */
export const YOUTH_ONLY_BELTS: BeltColor[] = ["CINZA", "AMARELA", "LARANJA", "VERDE"];

export const beltOptions: Array<{ label: string; value: BeltColor }> = [
  { label: "Cinza", value: "CINZA" },
  { label: "Amarela", value: "AMARELA" },
  { label: "Laranja", value: "LARANJA" },
  { label: "Verde", value: "VERDE" },
  { label: "Branca", value: "BRANCA" },
  { label: "Azul", value: "AZUL" },
  { label: "Roxa", value: "ROXA" },
  { label: "Marrom", value: "MARROM" },
  { label: "Preta", value: "PRETA" },
];

export const genderOptions: Array<{ label: string; value: Gender }> = [
  { label: "Masculino", value: "M" },
  { label: "Feminino", value: "F" },
];

/** Mesmo conjunto para Festival e juvenis (até 15 anos): todas as faixas. A partir de 16, use faixas sem as infantil-only. */
export function beltOptionsForAge(age: number | null | undefined) {
  if (typeof age !== "number" || !Number.isFinite(age)) {
    return beltOptions;
  }
  if (age < 16) {
    return beltOptions;
  }
  return beltOptions.filter((b) => !YOUTH_ONLY_BELTS.includes(b.value));
}

export const inputClassName =
  "rounded-xl border-zinc-800 bg-black/40 text-zinc-100 placeholder:text-zinc-500 focus-visible:ring-red-500/30";

export const selectTriggerClassName =
  "w-full cursor-pointer rounded-2xl border-zinc-800 bg-black/40 text-zinc-100";

export const selectContentClassName =
  "border-zinc-800 bg-zinc-950 text-zinc-100";

export const selectItemClassName =
  "cursor-pointer focus:outline-none data-[highlighted]:bg-zinc-900 data-[highlighted]:text-zinc-100 hover:bg-zinc-900/60";

export function isFestivalAthlete(age: number | null | undefined) {
  return typeof age === "number" && age < FESTIVAL_AGE_LIMIT;
}

export function splitPhoneParts(phone: string | null | undefined) {
  const digits = (phone ?? "").replace(/\D/g, "");

  return {
    areaCode: digits.slice(0, 2),
    phoneNumber: digits.slice(2),
  };
}
