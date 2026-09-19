"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Plus, Users, CheckCircle } from "lucide-react";

import { Button } from "@/app/_components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/app/_components/ui/dialog";
import { Form } from "@/app/_components/ui/form";
import { Input } from "@/app/_components/ui/input";
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/app/_components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/app/_components/ui/select";
import { Checkbox } from "@/app/_components/ui/checkbox";

import { AthleteInfoSection } from "@/app/_components/inscricao/AthleteInfoSection";
import { ModalitiesSection } from "@/app/_components/inscricao/ModalitiesSection";
import { TermsSection } from "@/app/_components/inscricao/TermsSection";
import {
  isFestivalAthlete,
  splitPhoneParts,
  beltOptionsForAge,
  genderOptions,
  inputClassName,
  selectTriggerClassName,
  selectContentClassName,
  selectItemClassName,
  YOUTH_ONLY_BELTS,
} from "@/app/_components/inscricao/constants";

import { formSchema, getDefaultFormValues, type FormValues } from "@/app/inscricao/form-schema";
import { getDivisionLabel, resolveCategoryByAgeGenderWeight } from "@/app/_lib/weight-categories";
import { beltLabel, beltDotClasses, getCategoryLabel } from "@/app/_lib/types";
import { phoneMask } from "@/app/_lib/utils";

import { createParticipantViaLink } from "@/app/_lib/actions/createParticipanteViaLink";
import type { LinkInscricao, LinkParticipante } from "@/app/_lib/actions/adminLinks";

type Props = {
  link: LinkInscricao;
  initialParticipantes: LinkParticipante[];
};

function AthleteBadge({ p }: { p: LinkParticipante }) {
  const modalities = [
    p.mod_gi && "Gi",
    p.mod_nogi && "NoGi",
    p.mod_gi_extra && "Absoluto",
    p.festival && "Festival",
  ].filter(Boolean) as string[];

  return (
    <div className="flex items-start gap-3 rounded-xl border border-zinc-800 bg-zinc-950/60 p-4">
      <CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-green-400" />
      <div className="min-w-0 flex-1">
        <p className="font-medium text-zinc-100 truncate">{p.nome}</p>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-zinc-400">
          <span>{p.idade} anos</span>
          {p.peso && <span>{p.peso} kg</span>}
          {p.categoria && <span>{getCategoryLabel(p.categoria as Parameters<typeof getCategoryLabel>[0])}</span>}
          <span className="flex items-center gap-1">
            <span
              className={`inline-block h-2.5 w-2.5 rounded-full border ${beltDotClasses[p.faixa as keyof typeof beltDotClasses]}`}
            />
            {beltLabel[p.faixa as keyof typeof beltLabel]}
          </span>
        </div>
        {modalities.length > 0 && (
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {modalities.map((m) => (
              <span
                key={m}
                className="rounded-full border border-zinc-700 bg-zinc-900 px-2 py-0.5 text-xs text-zinc-300"
              >
                {m}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function LinkAthleteForm({
  academia,
  token,
  onSuccess,
  onCancel,
}: {
  academia: string;
  token: string;
  onSuccess: (participante: LinkParticipante) => void;
  onCancel: () => void;
}) {
  const [submitting, setSubmitting] = React.useState(false);
  const [serverError, setServerError] = React.useState<string | null>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    shouldUnregister: true,
    defaultValues: {
      ...getDefaultFormValues(null),
      academy: academia,
    },
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
        : resolveCategoryByAgeGenderWeight({ age, gender, weight }),
    [age, festivalAthlete, gender, weight]
  );

  const divisionLabel = React.useMemo(
    () => (festivalAthlete ? "Festival Infantil" : getDivisionLabel(age, gender)),
    [age, festivalAthlete, gender]
  );

  const availableBelts = beltOptionsForAge(age);

  React.useEffect(() => {
    if (festivalAthlete) {
      form.setValue("category", null);
      form.setValue("mod_gi", false);
      form.setValue("mod_nogi", false);
      form.setValue("mod_gi_extra", false);
      form.setValue("weight_kg", null);
      return;
    }
    form.setValue("category", resolvedCategory, { shouldDirty: true, shouldValidate: false });
    form.setValue("mod_gi", true, { shouldDirty: true, shouldValidate: false });
    form.setValue("mod_nogi", false, { shouldDirty: true, shouldValidate: false });
    form.setValue("mod_gi_extra", false, { shouldDirty: true, shouldValidate: false });
  }, [festivalAthlete, form, resolvedCategory]);

  React.useEffect(() => {
    if (typeof age !== "number" || !Number.isFinite(age) || age < 16) return;
    const current = form.getValues("belt_color");
    if (current && YOUTH_ONLY_BELTS.includes(current)) {
      form.setValue("belt_color", "BRANCA", { shouldValidate: true });
    }
  }, [age, form]);

  async function onSubmit(values: FormValues) {
    setSubmitting(true);
    setServerError(null);

    try {
      const athleteIsFestival = isFestivalAthlete(values.age);
      const athletePhone = splitPhoneParts(values.phone);
      const guardianPhone = athleteIsFestival ? splitPhoneParts(values.responsavel_telefone) : null;

      const newId = await createParticipantViaLink({
        token,
        academia,
        full_name: values.full_name.trim(),
        cpf: values.cpf.trim(),
        phone_number: athletePhone.phoneNumber,
        area_code: athletePhone.areaCode,
        age: values.age,
        category: athleteIsFestival ? null : values.category,
        weight_kg: athleteIsFestival ? null : values.weight_kg,
        belt_color: values.belt_color,
        gender: values.gender,
        mod_gi: values.mod_gi,
        mod_nogi: values.mod_nogi,
        mod_gi_extra: values.mod_gi_extra,
        responsavel_name: athleteIsFestival ? values.responsavel_name?.trim() : undefined,
        responsavel_cpf: athleteIsFestival ? values.responsavel_cpf?.trim() : undefined,
        responsavel_area_code: athleteIsFestival ? guardianPhone?.areaCode : undefined,
        responsavel_phone_number: athleteIsFestival ? guardianPhone?.phoneNumber : undefined,
      });

      const newParticipante: LinkParticipante = {
        id: newId,
        nome: values.full_name.trim().toUpperCase(),
        idade: values.age,
        academia,
        faixa: values.belt_color,
        sexo: values.gender,
        categoria: athleteIsFestival ? null : (values.category ?? null),
        peso: athleteIsFestival ? null : values.weight_kg,
        mod_gi: values.mod_gi,
        mod_nogi: values.mod_nogi,
        mod_gi_extra: values.mod_gi_extra,
        festival: athleteIsFestival,
        created_at: new Date().toISOString(),
      };

      onSuccess(newParticipante);
    } catch (error) {
      setServerError(
        error instanceof Error ? error.message : "Não foi possível concluir a inscrição."
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-6">
        <AthleteInfoSection
          divisionLabel={divisionLabel}
          form={form}
          resolvedCategory={resolvedCategory}
        />

        {/* Academia - fixada pelo link */}
        <div className="flex flex-col-reverse gap-6 md:flex-row md:gap-8">
          <FormItem className="w-full">
            <FormLabel className="text-base text-zinc-200 sm:text-lg">Academia</FormLabel>
            <Input
              value={academia}
              readOnly
              className={`${inputClassName} cursor-not-allowed opacity-70`}
            />
          </FormItem>

          {!festivalAthlete && (
            <FormField
              control={form.control}
              name="weight_kg"
              render={({ field }) => (
                <FormItem className="w-full">
                  <FormLabel className="text-base text-zinc-200 sm:text-lg">Peso</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      step="0.1"
                      className={inputClassName}
                      value={field.value ?? ""}
                      onChange={(e) =>
                        field.onChange(e.target.value === "" ? null : Number(e.target.value))
                      }
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}
        </div>

        {/* Faixa e Gênero */}
        <div className="flex flex-col gap-6 md:flex-row md:gap-8">
          <FormField
            control={form.control}
            name="belt_color"
            render={({ field }) => (
              <FormItem className="w-full">
                <FormLabel className="text-base text-zinc-200 sm:text-lg">Faixa</FormLabel>
                <Select value={field.value ?? ""} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger className={selectTriggerClassName}>
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent className={selectContentClassName}>
                    {availableBelts.map((belt) => (
                      <SelectItem key={belt.value} value={belt.value} className={selectItemClassName}>
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
                <FormLabel className="text-base text-zinc-200 sm:text-lg">Gênero</FormLabel>
                <Select value={field.value ?? ""} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger className={selectTriggerClassName}>
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent className={selectContentClassName}>
                    {genderOptions.map((g) => (
                      <SelectItem key={g.value} value={g.value} className={selectItemClassName}>
                        {g.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {serverError && (
          <div className="rounded-xl border border-red-900/50 bg-red-950/40 px-3 py-2 text-sm text-red-200">
            {serverError}
          </div>
        )}

        <ModalitiesSection form={form} />
        <TermsSection form={form} />

        <div className="flex justify-end gap-3 pt-2">
          <Button
            type="button"
            variant="ghost"
            onClick={onCancel}
            className="rounded-xl text-zinc-400 hover:text-zinc-100"
            disabled={submitting}
          >
            Cancelar
          </Button>
          <Button
            type="submit"
            className="rounded-xl bg-red-600 px-6 hover:bg-red-500"
            disabled={submitting || !termsAccepted}
          >
            {submitting ? "Salvando..." : "Salvar inscrição"}
          </Button>
        </div>
      </form>
    </Form>
  );
}

export default function LinkInscricaoClient({ link, initialParticipantes }: Props) {
  const router = useRouter();
  const [participantes, setParticipantes] = React.useState<LinkParticipante[]>(initialParticipantes);
  const [modalOpen, setModalOpen] = React.useState(false);

  const inscritos = participantes.length;
  const vagas = link.quantidade;
  const lotado = inscritos >= vagas;

  function handleSuccess(novo: LinkParticipante) {
    setParticipantes((prev) => [...prev, novo]);
    setModalOpen(false);
    router.refresh();
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-black px-4 py-8 text-zinc-100 sm:py-10">
      <div className="absolute -top-24 left-1/2 h-[520px] w-[520px] -translate-x-1/2 rounded-full bg-red-600/15 blur-3xl" />
      <div className="absolute -bottom-40 right-[-120px] h-[520px] w-[520px] rounded-full bg-red-500/10 blur-3xl" />

      <div className="relative mx-auto w-full max-w-xl">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-zinc-100 sm:text-3xl">{link.academia}</h1>
          <p className="mt-1 text-base text-zinc-400">Inscrições via link exclusivo</p>
        </div>

        {/* Contador */}
        <div className="mb-6 rounded-2xl border border-zinc-800 bg-zinc-950/70 p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-zinc-900 p-3">
                <Users className="h-5 w-5 text-zinc-100" />
              </div>
              <div>
                <p className="text-3xl font-bold text-zinc-100">
                  {inscritos}
                  <span className="text-xl font-normal text-zinc-500">/{vagas}</span>
                </p>
                <p className="text-sm text-zinc-400">
                  {lotado ? "Limite atingido" : `${vagas - inscritos} vaga${vagas - inscritos !== 1 ? "s" : ""} restante${vagas - inscritos !== 1 ? "s" : ""}`}
                </p>
              </div>
            </div>

            <Button
              onClick={() => setModalOpen(true)}
              disabled={lotado}
              className="flex items-center gap-2 rounded-xl bg-red-600 px-4 hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">Adicionar atleta</span>
              <span className="sm:hidden">Adicionar</span>
            </Button>
          </div>

          {lotado && (
            <p className="mt-4 rounded-xl border border-yellow-900/50 bg-yellow-950/30 px-3 py-2 text-sm text-yellow-300">
              O limite de inscrições deste link foi atingido. Entre em contato com o organizador para obter um novo link.
            </p>
          )}
        </div>

        {/* Lista de inscritos */}
        <div className="flex flex-col gap-3">
          {participantes.length === 0 ? (
            <div className="rounded-2xl border border-zinc-800 bg-zinc-950/60 p-8 text-center text-zinc-500">
              Nenhuma inscrição realizada ainda. Clique em &quot;Adicionar atleta&quot; para começar.
            </div>
          ) : (
            participantes.map((p) => <AthleteBadge key={p.id} p={p} />)
          )}
        </div>
      </div>

      {/* Modal de inscrição */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-h-[90vh] max-w-xl overflow-y-auto border-zinc-800 bg-zinc-950 text-zinc-100">
          <DialogHeader>
            <DialogTitle>Adicionar atleta</DialogTitle>
            <DialogDescription className="text-zinc-400">
              Preencha os dados do atleta. A academia <strong className="text-zinc-200">{link.academia}</strong> já está preenchida automaticamente.
            </DialogDescription>
          </DialogHeader>

          <LinkAthleteForm
            academia={link.academia}
            token={link.token}
            onSuccess={handleSuccess}
            onCancel={() => setModalOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
