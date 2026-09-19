"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import * as React from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft } from "lucide-react";
import { useForm } from "react-hook-form";

import { AthleteDetailsSection } from "@/app/_components/inscricao/AthleteDetailsSection";
import { AthleteInfoSection } from "@/app/_components/inscricao/AthleteInfoSection";
import {
  isFestivalAthlete,
  splitPhoneParts,
} from "@/app/_components/inscricao/constants";
import { ModalitiesSection } from "@/app/_components/inscricao/ModalitiesSection";
import { TermsSection } from "@/app/_components/inscricao/TermsSection";
import { Button } from "@/app/_components/ui/button";
import { Form } from "@/app/_components/ui/form";
import { createParticipant } from "@/app/_lib/actions/createParticipante";
import {
  getDefaultFormValues,
  formSchema,
  type FormValues,
} from "@/app/inscricao/form-schema";
import {
  getDivisionLabel,
  resolveCategoryByAgeGenderWeight,
} from "@/app/_lib/weight-categories";

function InscricaoContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const cpfFromQuery = searchParams.get("cpf");
  const [submitting, setSubmitting] = React.useState(false);
  const [serverError, setServerError] = React.useState<string | null>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    shouldUnregister: true,
    defaultValues: getDefaultFormValues(cpfFromQuery),
  });

  const age = form.watch("age");
  const gender = form.watch("gender");
  const weight = form.watch("weight_kg");
  const termsAccepted = form.watch("terms");
  const festivalAthlete = isFestivalAthlete(age);

  const resolvedCategory = React.useMemo(
    () =>
      festivalAthlete
        ? null
        : resolveCategoryByAgeGenderWeight({
            age,
            gender,
            weight,
          }),
    [age, festivalAthlete, gender, weight]
  );

  const divisionLabel = React.useMemo(
    () => (festivalAthlete ? "Festival Infantil" : getDivisionLabel(age, gender)),
    [age, festivalAthlete, gender]
  );

  React.useEffect(() => {
    if (festivalAthlete) {
      form.setValue("category", null);
      form.setValue("mod_gi", false);
      form.setValue("mod_nogi", false);
      form.setValue("mod_gi_extra", false);
      form.setValue("weight_kg", null);
      return;
    }

    form.setValue("category", resolvedCategory, {
      shouldDirty: true,
      shouldValidate: false,
    });
    form.setValue("mod_gi", true, {
      shouldDirty: true,
      shouldValidate: false,
    });
    form.setValue("mod_nogi", false, {
      shouldDirty: true,
      shouldValidate: false,
    });
    form.setValue("mod_gi_extra", false, {
      shouldDirty: true,
      shouldValidate: false,
    });
  }, [festivalAthlete, form, resolvedCategory]);

  async function onSubmit(values: FormValues) {
    setSubmitting(true);
    setServerError(null);

    try {
      const athleteIsFestival = isFestivalAthlete(values.age);
      const athletePhone = splitPhoneParts(values.phone);
      const guardianPhone = athleteIsFestival
        ? splitPhoneParts(values.responsavel_telefone)
        : null;

      const id = await createParticipant({
        full_name: values.full_name.trim(),
        cpf: values.cpf.trim(),
        phone_number: athletePhone.phoneNumber,
        area_code: athletePhone.areaCode,
        age: values.age,
        academy: values.academy?.trim(),
        category: athleteIsFestival ? null : values.category,
        weight_kg: athleteIsFestival ? null : values.weight_kg,
        belt_color: values.belt_color,
        gender: values.gender,
        mod_gi: values.mod_gi,
        mod_nogi: values.mod_nogi,
        mod_gi_extra: values.mod_gi_extra,
        responsavel_name: athleteIsFestival
          ? values.responsavel_name?.trim()
          : undefined,
        responsavel_cpf: athleteIsFestival
          ? values.responsavel_cpf?.trim()
          : undefined,
        responsavel_area_code: athleteIsFestival
          ? guardianPhone?.areaCode
          : undefined,
        responsavel_phone_number: athleteIsFestival
          ? guardianPhone?.phoneNumber
          : undefined,
      });

      router.push(`/cash?id=${encodeURIComponent(id)}`);
    } catch (error) {
      console.error(error);
      setServerError(
        error instanceof Error
          ? error.message
          : "Não foi possível concluir sua inscrição."
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-black px-4 py-8 text-zinc-100 sm:py-10">
      <div className="absolute -top-24 left-1/2 h-[520px] w-[520px] -translate-x-1/2 rounded-full bg-red-600/15 blur-3xl" />
      <div className="absolute -bottom-40 right-[-120px] h-[520px] w-[520px] rounded-full bg-red-500/10 blur-3xl" />

      <div className="relative mx-auto w-full max-w-xl">
        <Link
          className="mb-6 inline-flex items-center gap-2 text-base text-zinc-400 transition-colors hover:text-zinc-100 sm:mb-8 sm:text-xl"
          href="/"
        >
          <ArrowLeft className="h-5 w-5" />
          Voltar para o início
        </Link>

        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-zinc-100 sm:text-3xl">
            Inscrição
          </h1>
          <p className="mt-1 text-base text-zinc-400 sm:text-lg">
            Preencha os dados do atleta com atenção. <br />
            Cada detalhe certo aproxima você de uma grande atuação no campeonato.
          </p>
        </div>

        <div className="flex flex-col gap-5 rounded-2xl border border-zinc-800 bg-zinc-950/70 p-4 shadow-sm backdrop-blur sm:p-6">
          <div>
            <h2 className="text-lg font-semibold text-zinc-100 sm:text-xl">
              Formulário de Inscrição
            </h2>
            <p className="mb-2 mt-1 text-base text-zinc-400 sm:text-lg">
              Finalize este cadastro para seguir ao pagamento e garantir sua vaga
              no evento.
            </p>
          </div>

          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(onSubmit)}
              className="flex flex-col gap-6 sm:gap-8"
            >
              <AthleteInfoSection
                divisionLabel={divisionLabel}
                form={form}
                resolvedCategory={resolvedCategory}
              />

              <AthleteDetailsSection form={form} />

              {serverError && (
                <div className="rounded-xl border border-red-900/50 bg-red-950/40 px-3 py-2 text-sm text-red-200">
                  {serverError}
                </div>
              )}

              <ModalitiesSection form={form} />

              <TermsSection form={form} />

              <div className="flex justify-center gap-4">
                <Button
                  className="h-12 rounded-xl bg-red-600 px-8 hover:bg-red-500"
                  disabled={submitting || !termsAccepted}
                  type="submit"
                >
                  {submitting ? "Enviando..." : "Concluir inscrição"}
                </Button>
              </div>
            </form>
          </Form>
        </div>
      </div>
    </div>
  );
}

export default function InscricaoPage() {
  return (
    <React.Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-black text-zinc-100">
          Carregando...
        </div>
      }
    >
      <InscricaoContent />
    </React.Suspense>
  );
}
