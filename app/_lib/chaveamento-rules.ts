import type { Category, Gender } from "@/app/_lib/types";
import { buildAutomaticBracketRulesFromWeightTable } from "@/app/_lib/weight-categories";

export type AutomaticBracketRule = {
  id: string;
  category: Category | null;
  categoryLabel: string;
  ageLabel: string;
  minAge: number;
  maxAge: number;
  minWeight?: number;
  maxWeight?: number;
  gender: Gender | null;
  separateByGender: boolean;
};

export const AUTOMATIC_BRACKET_RULES: AutomaticBracketRule[] =
  buildAutomaticBracketRulesFromWeightTable();

export const FESTIVAL_BRACKET_RULE = {
  id: "festival-infantil",
  label: "Festival Infantil",
};

export function genderLabel(gender: Gender | null | undefined) {
  if (gender === "F") return "Feminino";
  if (gender === "M") return "Masculino";
  return "Sem sexo";
}
