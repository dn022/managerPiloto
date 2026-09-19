"use client";

import * as React from "react";
import type { UseFormReturn } from "react-hook-form";

import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/app/_components/ui/form";
import { Input } from "@/app/_components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/app/_components/ui/select";
import {
  beltOptionsForAge,
  genderOptions,
  inputClassName,
  isFestivalAthlete,
  selectContentClassName,
  selectItemClassName,
  selectTriggerClassName,
  YOUTH_ONLY_BELTS,
} from "@/app/_components/inscricao/constants";
import type { FormValues } from "@/app/inscricao/form-schema";

export function AthleteDetailsSection({
  form,
}: {
  form: UseFormReturn<FormValues>;
}) {
  const age = form.watch("age");
  const festivalAthlete = isFestivalAthlete(age);
  const availableBelts = beltOptionsForAge(age);

  React.useEffect(() => {
    if (typeof age !== "number" || !Number.isFinite(age) || age < 16) return;
    const current = form.getValues("belt_color");
    if (current && YOUTH_ONLY_BELTS.includes(current)) {
      form.setValue("belt_color", "BRANCA", { shouldValidate: true });
    }
  }, [age, form]);

  return (
    <>
      <div className="flex flex-col-reverse gap-6 md:flex-row md:gap-8">
        <FormField
          control={form.control}
          name="academy"
          render={({ field }) => (
            <FormItem className="w-full">
              <FormLabel className="text-base text-zinc-200 sm:text-lg">
                Academia
              </FormLabel>
              <FormControl>
                <Input
                  {...field}
                  value={field.value ?? ""}
                  className={inputClassName}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {!festivalAthlete && (
          <FormField
            control={form.control}
            name="weight_kg"
            render={({ field }) => (
              <FormItem className="w-full">
                <FormLabel className="text-base text-zinc-200 sm:text-lg">
                  Peso
                </FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    step="0.1"
                    className={inputClassName}
                    value={field.value ?? ""}
                    onChange={(event) =>
                      field.onChange(
                        event.target.value === ""
                          ? null
                          : Number(event.target.value)
                      )
                    }
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        )}
      </div>

      <div className="flex flex-col gap-6 md:flex-row md:gap-8">
        <FormField
          control={form.control}
          name="belt_color"
          render={({ field }) => (
            <FormItem className="w-full">
              <FormLabel className="text-base text-zinc-200 sm:text-lg">
                Faixa
              </FormLabel>
              <Select value={field.value ?? ""} onValueChange={field.onChange}>
                <FormControl>
                  <SelectTrigger className={selectTriggerClassName}>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                </FormControl>

                <SelectContent className={selectContentClassName}>
                  {availableBelts.map((belt) => (
                    <SelectItem
                      key={belt.value}
                      value={belt.value}
                      className={selectItemClassName}
                    >
                      {belt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="gender"
          render={({ field }) => (
            <FormItem className="w-full">
              <FormLabel className="text-base text-zinc-200 sm:text-lg">
                Gênero
              </FormLabel>
              <Select value={field.value ?? ""} onValueChange={field.onChange}>
                <FormControl>
                  <SelectTrigger className={selectTriggerClassName}>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                </FormControl>

                <SelectContent className={selectContentClassName}>
                  {genderOptions.map((gender) => (
                    <SelectItem
                      key={gender.value}
                      value={gender.value}
                      className={selectItemClassName}
                    >
                      {gender.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>
    </>
  );
}
