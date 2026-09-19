"use client";

import type { UseFormReturn } from "react-hook-form";

import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/app/_components/ui/form";
import { Input } from "@/app/_components/ui/input";
import { getCategoryLabel } from "@/app/_lib/types";
import { phoneMask } from "@/app/_lib/utils";
import {
  inputClassName,
  isFestivalAthlete,
} from "@/app/_components/inscricao/constants";
import type { FormValues } from "@/app/inscricao/form-schema";

type AthleteInfoSectionProps = {
  divisionLabel: string | null;
  form: UseFormReturn<FormValues>;
  resolvedCategory: FormValues["category"];
};

function GuardianFields({ form }: { form: UseFormReturn<FormValues> }) {
  return (
    <div className="flex w-full flex-col gap-6 rounded-2xl border border-yellow-600/40 bg-yellow-950/20 p-4 md:col-span-2">
      <h3 className="text-lg font-semibold text-yellow-200">
        Dados do Responsável Legal
      </h3>

      <FormField
        control={form.control}
        name="responsavel_name"
        render={({ field }) => (
          <FormItem>
            <FormLabel className="text-zinc-200">Nome do Responsável</FormLabel>
            <FormControl>
              <Input
                {...field}
                value={field.value ?? ""}
                placeholder="Nome completo do responsável"
                className={`${inputClassName} w-full`}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="responsavel_cpf"
        render={({ field }) => (
          <FormItem>
            <FormLabel className="text-zinc-200">CPF do Responsável</FormLabel>
            <FormControl>
              <Input
                {...field}
                value={field.value ?? ""}
                placeholder="CPF do responsável"
                className={inputClassName}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="responsavel_telefone"
        render={({ field }) => (
          <FormItem>
            <FormLabel className="text-zinc-200">
              Telefone do Responsável
            </FormLabel>
            <FormControl>
              <Input
                inputMode="numeric"
                {...field}
                value={field.value ?? ""}
                placeholder="(22) 9 9999-9999"
                className={inputClassName}
                maxLength={15}
                onChange={(event) => field.onChange(phoneMask(event.target.value))}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  );
}

export function AthleteInfoSection({
  divisionLabel,
  form,
  resolvedCategory,
}: AthleteInfoSectionProps) {
  const age = form.watch("age");
  const festivalAthlete = isFestivalAthlete(age);
  const needsGuardian = typeof age === "number" && age < 18;

  return (
    <>
      <FormField
        control={form.control}
        name="full_name"
        render={({ field }) => (
          <FormItem>
            <FormLabel className="text-base text-zinc-200 sm:text-lg">
              Nome completo
            </FormLabel>
            <FormControl>
              <Input
                placeholder="Nome do atleta"
                {...field}
                className={inputClassName}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="cpf"
        render={({ field }) => (
          <FormItem>
            <FormLabel className="text-base text-zinc-200 sm:text-lg">
              CPF
            </FormLabel>
            <FormControl>
              <Input
                placeholder="CPF do atleta"
                {...field}
                className={inputClassName}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="phone"
        render={({ field }) => (
          <FormItem className="w-full md:col-span-2">
            <FormLabel className="text-base text-zinc-200 sm:text-lg">
              Telefone (WhatsApp)
            </FormLabel>
            <FormControl>
              <Input
                inputMode="numeric"
                placeholder="(22) 9 9999-9999"
                {...field}
                className={inputClassName}
                maxLength={15}
                onChange={(event) => field.onChange(phoneMask(event.target.value))}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <div className="grid w-full grid-cols-1 gap-6 md:grid-cols-2 md:gap-8">
        <FormField
          control={form.control}
          name="age"
          render={({ field }) => (
            <FormItem className="w-full">
              <FormLabel className="flex w-full text-base text-zinc-200 sm:text-lg md:flex">
                Idade
              </FormLabel>
              <FormControl>
                <Input
                  type="number"
                  inputMode="numeric"
                  className={`${inputClassName} w-full`}
                  value={field.value ?? ""}
                  onChange={(event) => {
                    const nextValue = event.target.value;
                    field.onChange(nextValue === "" ? undefined : Number(nextValue));
                  }}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {festivalAthlete && (
          <div className="flex items-center justify-center rounded-xl border border-yellow-600/50 bg-yellow-950/30 p-4 text-yellow-200">
            <div className="text-sm">
              <span className="mb-1 block text-base font-bold sm:text-lg">
                Categoria Festival
              </span>
              Atletas abaixo de 8 anos participam automaticamente no Festival, em
              um formato pensado para incentivo, aprendizado e experiência
              positiva.
            </div>
          </div>
        )}

        {needsGuardian && <GuardianFields form={form} />}

        {!festivalAthlete && (
          <FormField
            control={form.control}
            name="category"
            render={() => (
              <FormItem className="w-full">
                <FormLabel className="flex w-full text-base text-zinc-200 sm:text-lg md:flex">
                  Categoria
                </FormLabel>
                <FormControl>
                  <Input
                    readOnly
                    value={resolvedCategory ? getCategoryLabel(resolvedCategory) : ""}
                    placeholder="Informe idade, sexo e peso"
                    className={inputClassName}
                  />
                </FormControl>
                <p className="text-sm text-zinc-400">
                  Divisão aplicada:{" "}
                  {divisionLabel ?? "aguardando dados do atleta"}
                </p>
                <FormMessage />
              </FormItem>
            )}
          />
        )}
      </div>
    </>
  );
}
