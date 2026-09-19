import {
  categoryEnum,
  categoryLabel,
  type Category,
  type Gender,
} from "@/app/_lib/types";

type DivisionRule = {
  id: string;
  label: string;
  minAge: number;
  maxAge: number;
  gender: Gender | null;
  separateByGender: boolean;
  upperBounds: Partial<Record<Category, number>>;
};

export const CATEGORY_ORDER = [...categoryEnum];

const DIVISION_RULES: DivisionRule[] = [
  {
    id: "pre-mirim-1",
    label: "Pre-Mirim 1",
    minAge: 4,
    maxAge: 4,
    gender: null,
    separateByGender: true,
    upperBounds: { PLUMA: 14.7, PENA: 18, LEVE: 21, MEDIO: 24, MEIO_PESADO: 27, PESADO: 30, SUPER_PESADO: 33 },
  },
  {
    id: "pre-mirim-2",
    label: "Pre-Mirim 2",
    minAge: 5,
    maxAge: 5,
    gender: null,
    separateByGender: true,
    upperBounds: { PLUMA: 17.9, PENA: 20, LEVE: 24, MEDIO: 26, MEIO_PESADO: 28, PESADO: 32, SUPER_PESADO: 35 },
  },
  {
    id: "pre-mirim-3",
    label: "Pre-Mirim 3",
    minAge: 6,
    maxAge: 6,
    gender: null,
    separateByGender: true,
    upperBounds: { PLUMA: 18.9, PENA: 22, LEVE: 25, MEDIO: 28, MEIO_PESADO: 31.2, PESADO: 34.2, SUPER_PESADO: 37.2 },
  },
  {
    id: "mirim-1",
    label: "Mirim 1",
    minAge: 7,
    maxAge: 7,
    gender: null,
    separateByGender: true,
    upperBounds: { PLUMA: 21, PENA: 23.5, LEVE: 27, MEDIO: 30.2, MEIO_PESADO: 33.2, PESADO: 36.2, SUPER_PESADO: 39.3 },
  },
  {
    id: "mirim-2",
    label: "Mirim 2",
    minAge: 8,
    maxAge: 8,
    gender: null,
    separateByGender: true,
    upperBounds: { PLUMA: 24, PENA: 26.3, LEVE: 30.2, MEDIO: 33.2, MEIO_PESADO: 35.4, PESADO: 39.3, SUPER_PESADO: 42.3 },
  },
  {
    id: "mirim-3",
    label: "Mirim 3",
    minAge: 9,
    maxAge: 9,
    gender: null,
    separateByGender: true,
    upperBounds: { PLUMA: 27, PENA: 29.4, LEVE: 33.2, MEDIO: 36.2, MEIO_PESADO: 39.3, PESADO: 42.3, SUPER_PESADO: 45.3 },
  },
  {
    id: "infantil-1",
    label: "Infantil 1",
    minAge: 10,
    maxAge: 10,
    gender: null,
    separateByGender: true,
    upperBounds: { GALO: 27, PLUMA: 30.2, PENA: 33.2, LEVE: 36.4, MEDIO: 39.3, MEIO_PESADO: 42.3, PESADO: 45.3, SUPER_PESADO: 48.3 },
  },
  {
    id: "infantil-2",
    label: "Infantil 2",
    minAge: 11,
    maxAge: 11,
    gender: null,
    separateByGender: true,
    upperBounds: { GALO: 30.2, PLUMA: 33.2, PENA: 36.2, LEVE: 39.3, MEDIO: 42.3, MEIO_PESADO: 45.3, PESADO: 48.3, SUPER_PESADO: 51.5 },
  },
  {
    id: "infantil-3",
    label: "Infantil 3",
    minAge: 12,
    maxAge: 12,
    gender: null,
    separateByGender: true,
    upperBounds: { GALO: 32.2, PLUMA: 36.2, PENA: 40.3, LEVE: 44.3, MEDIO: 48.3, MEIO_PESADO: 52.5, PESADO: 56.5, SUPER_PESADO: 60.5 },
  },
  {
    id: "infanto-juvenil-1",
    label: "Infanto-Juvenil 1",
    minAge: 13,
    maxAge: 13,
    gender: null,
    separateByGender: true,
    upperBounds: { GALO: 36.2, PLUMA: 40.3, PENA: 44.3, LEVE: 48.3, MEDIO: 52.5, MEIO_PESADO: 56.5, PESADO: 60.5, SUPER_PESADO: 64.2 },
  },
  {
    id: "infanto-juvenil-2",
    label: "Infanto-Juvenil 2",
    minAge: 14,
    maxAge: 14,
    gender: null,
    separateByGender: true,
    upperBounds: { GALO: 40.3, PLUMA: 44.3, PENA: 47.5, LEVE: 52.5, MEDIO: 56.5, MEIO_PESADO: 60.5, PESADO: 65, SUPER_PESADO: 69 },
  },
  {
    id: "infanto-juvenil-3",
    label: "Infanto-Juvenil 3",
    minAge: 15,
    maxAge: 15,
    gender: null,
    separateByGender: true,
    upperBounds: { GALO: 44.3, PLUMA: 48.3, PENA: 52.5, LEVE: 56.5, MEDIO: 60.5, MEIO_PESADO: 65, PESADO: 69, SUPER_PESADO: 73 },
  },
  {
    id: "juvenil-masculino-1",
    label: "Juvenil 1",
    minAge: 16,
    maxAge: 16,
    gender: "M",
    separateByGender: true,
    upperBounds: { GALO: 48.5, PLUMA: 53.5, PENA: 58.5, LEVE: 64, MEDIO: 69, MEIO_PESADO: 74, PESADO: 79.3, SUPER_PESADO: 84.3 },
  },
  {
    id: "juvenil-masculino-2",
    label: "Juvenil 2",
    minAge: 17,
    maxAge: 17,
    gender: "M",
    separateByGender: true,
    upperBounds: { GALO: 53.5, PLUMA: 58.5, PENA: 64, LEVE: 69, MEDIO: 74, MEIO_PESADO: 79.3, PESADO: 84.3, SUPER_PESADO: 89.3 },
  },
  {
    id: "juvenil-feminino",
    label: "Juvenil Feminino",
    minAge: 16,
    maxAge: 17,
    gender: "F",
    separateByGender: true,
    upperBounds: { GALO: 44.3, PLUMA: 48.3, PENA: 52.5, LEVE: 56.5, MEDIO: 60.5, MEIO_PESADO: 65, PESADO: 69, SUPER_PESADO: 73 },
  },
  {
    id: "adulto-masculino",
    label: "Adulto",
    minAge: 18,
    maxAge: 120,
    gender: "M",
    separateByGender: true,
    upperBounds: { GALO: 57.5, PLUMA: 64, PENA: 70, LEVE: 76, MEDIO: 82.3, MEIO_PESADO: 88.3, PESADO: 94.3, SUPER_PESADO: 100.5 },
  },
  {
    id: "adulto-feminino",
    label: "Adulto",
    minAge: 18,
    maxAge: 120,
    gender: "F",
    separateByGender: true,
    upperBounds: { GALO: 48.5, PLUMA: 53.5, PENA: 58.5, LEVE: 64, MEDIO: 69, MEIO_PESADO: 74, PESADO: 79.3, SUPER_PESADO: 84.3 },
  },
];

export function getDivisionRule(age: number, gender: Gender | null | undefined) {
  return (
    DIVISION_RULES.find((rule) => {
      if (age < rule.minAge || age > rule.maxAge) return false;
      if (rule.gender && gender !== rule.gender) return false;
      return true;
    }) ?? null
  );
}

export function getDivisionLabel(age: number, gender: Gender | null | undefined) {
  return getDivisionRule(age, gender)?.label ?? null;
}

export function resolveCategoryByAgeGenderWeight({
  age,
  gender,
  weight,
}: {
  age: number;
  gender: Gender | null | undefined;
  weight: number | null | undefined;
}) {
  if (!Number.isFinite(age) || weight === null || weight === undefined || !Number.isFinite(weight)) {
    return null;
  }

  const automaticRules = buildAutomaticBracketRulesFromWeightTable();
  const matchedRule = automaticRules.find((rule) => {
    if (rule.category === null) return false;
    if (age < rule.minAge || age > rule.maxAge) return false;
    if (rule.gender && gender !== rule.gender) return false;
    if (rule.minWeight !== undefined && weight < rule.minWeight) return false;
    if (rule.maxWeight !== undefined && weight > rule.maxWeight) return false;
    return true;
  });

  return matchedRule?.category ?? null;
}

export function buildAutomaticBracketRulesFromWeightTable() {
  return DIVISION_RULES.flatMap((rule) => {
    const rules = [];
    let previousMaxWeight: number | undefined;

    for (const category of CATEGORY_ORDER) {
      if (category === "PESADISSIMO") {
        rules.push({
          id: `${rule.id}-${category.toLowerCase()}`,
          category,
          categoryLabel: categoryLabel[category],
          ageLabel: rule.label,
          minAge: rule.minAge,
          maxAge: rule.maxAge,
          minWeight:
            previousMaxWeight === undefined ? undefined : Number((previousMaxWeight + 0.001).toFixed(3)),
          maxWeight: undefined,
          gender: rule.gender,
          separateByGender: rule.separateByGender,
        });
        continue;
      }

      const maxWeight = rule.upperBounds[category];
      if (maxWeight === undefined) continue;

      rules.push({
        id: `${rule.id}-${category.toLowerCase()}`,
        category,
        categoryLabel: categoryLabel[category],
        ageLabel: rule.label,
        minAge: rule.minAge,
        maxAge: rule.maxAge,
        minWeight:
          previousMaxWeight === undefined ? undefined : Number((previousMaxWeight + 0.001).toFixed(3)),
        maxWeight,
        gender: rule.gender,
        separateByGender: rule.separateByGender,
      });

      previousMaxWeight = maxWeight;
    }

    return rules;
  });
}
