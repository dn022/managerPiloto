"use client";

import type { UseFormReturn } from "react-hook-form";

import { Checkbox } from "@/app/_components/ui/checkbox";
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/app/_components/ui/form";
import type { FormValues } from "@/app/inscricao/form-schema";

export function TermsSection({
  form,
}: {
  form: UseFormReturn<FormValues>;
}) {
  return (
    <FormField
      control={form.control}
      name="terms"
      render={({ field }) => (
        <FormItem className="flex items-start gap-3 space-y-0 rounded-xl border border-zinc-800 bg-black/30 p-4">
          <FormControl>
            <Checkbox
              checked={field.value}
              onCheckedChange={field.onChange}
              className="mt-1"
            />
          </FormControl>

          <div className="flex flex-col gap-2 leading-none">
            <FormLabel className="flex cursor-pointer flex-wrap text-zinc-100">
              Declaro que li e aceito os{" "}
              <a
                href="/termo-de-autorizacao.pdf"
                className="flex flex-row justify-between text-white hover:text-red-600"
                target="_blank"
                rel="noopener noreferrer"
              >
                termos de inscrição
              </a>
            </FormLabel>
            <p className="flex text-sm text-zinc-400">
              Ao prosseguir, confirmo que as informações fornecidas são
              verdadeiras e que entro neste evento com responsabilidade, respeito
              e ciência das regras oficiais.
            </p>
            <FormMessage />
          </div>
        </FormItem>
      )}
    />
  );
}
