import { z } from "zod";

import { beltEnum, categoryEnum, genderEnum } from "@/app/_lib/types";
import { isValidBrazilianCellPhone } from "@/app/_lib/utils";
import { resolveCategoryByAgeGenderWeight } from "@/app/_lib/weight-categories";
import {
  isFestivalAthlete,
  YOUTH_ONLY_BELTS,
} from "@/app/_components/inscricao/constants";

export const formSchema = z
  .object({
    full_name: z.string().min(3, { message: "Informe o nome completo" }),
    cpf: z.string().min(11, { message: "Informe um CPF válido" }),
    phone: z
      .string()
      .nonempty({ message: "Informe um telefone para contato" })
      .refine(isValidBrazilianCellPhone, {
        message: "Informe um telefone válido com DDD (ex: (11) 98765-4321)",
      }),
    age: z
      .number({ message: "Idade inválida" })
      .int({ message: "Idade deve ser um número inteiro" })
      .min(4, { message: "Idade mínima é 4 anos" })
      .max(90, { message: "Idade máxima é 90 anos" }),
    academy: z.string().optional(),
    mod_gi: z.boolean(),
    mod_nogi: z.boolean(),
    mod_gi_extra: z.boolean(),
    category: z.enum(categoryEnum).nullable(),
    weight_kg: z
      .number({ message: "Peso inválido" })
      .min(10, { message: "Peso mínimo é 10kg" })
      .max(300, { message: "Peso máximo é 300kg" })
      .nullable(),
    belt_color: z.enum(beltEnum),
    gender: z.enum(genderEnum),
    responsavel_name: z.string().optional(),
    responsavel_cpf: z.string().optional(),
    responsavel_telefone: z.string().optional(),
    terms: z.boolean().refine((value) => value === true, {
      message: "Você deve aceitar os termos para continuar",
    }),
  })
  .superRefine((data, ctx) => {
    const festivalAthlete = isFestivalAthlete(data.age);

    if (!festivalAthlete && !data.mod_gi) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["mod_gi"],
        message: "A inscrição está disponível apenas para a modalidade Gi",
      });
    }

    if (!festivalAthlete && data.weight_kg === null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["weight_kg"],
        message: "Informe o peso do atleta",
      });
    }

    if (!festivalAthlete) {
      const resolvedCategory = resolveCategoryByAgeGenderWeight({
        age: data.age,
        gender: data.gender,
        weight: data.weight_kg,
      });

      if (!resolvedCategory) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["weight_kg"],
          message: "Não foi possível localizar a categoria com os dados informados",
        });
      }
    }

    const needsGuardian = data.age < 18;
    if (needsGuardian) {
      if (!data.responsavel_name || data.responsavel_name.trim().length < 3) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["responsavel_name"],
          message: "Informe o nome do responsável legal",
        });
      }

      if (!data.responsavel_cpf || data.responsavel_cpf.trim().length < 11) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["responsavel_cpf"],
          message: "Informe o CPF do responsável legal",
        });
      }

      if (
        !data.responsavel_telefone ||
        !isValidBrazilianCellPhone(data.responsavel_telefone)
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["responsavel_telefone"],
          message:
            "Informe um telefone válido do responsável (ex: (11) 98765-4321)",
        });
      }
    }

    if (
      typeof data.age === "number" &&
      data.age >= 16 &&
      YOUTH_ONLY_BELTS.includes(data.belt_color)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["belt_color"],
        message:
          "Faixas cinza, amarela, laranja e verde são apenas para atletas com menos de 16 anos",
      });
    }
  });

export type FormValues = z.infer<typeof formSchema>;

export function getDefaultFormValues(cpf: string | null): Partial<FormValues> {
  return {
    cpf: cpf ?? "",
    full_name: "",
    phone: "",
    academy: "",
    mod_gi: true,
    mod_nogi: false,
    mod_gi_extra: false,
    terms: false,
    category: null,
    weight_kg: null,
    responsavel_name: "",
    responsavel_cpf: "",
    responsavel_telefone: "",
  };
}
