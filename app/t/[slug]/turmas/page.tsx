import Link from "next/link";

import { Button } from "@/app/_components/ui/button";
import { createClass } from "@/app/_lib/actions/management";
import { requireTenant } from "@/app/_lib/session";
import { createClient } from "@/app/_lib/supabase/server";
import { brl, hhmm, WEEKDAYS } from "@/app/_lib/weekdays";
import { ErrorBanner, Field, Input, PageHeader, selectClass, FormToggle, sportColor } from "../_components/ui";

type Schedule = { weekday: number; start_time: string; end_time: string };
const one = <T,>(v: T | T[] | null): T | null => (Array.isArray(v) ? (v[0] ?? null) : v);

export default async function TurmasPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ erro?: string }>;
}) {
  const { slug } = await params;
  const { erro } = await searchParams;
  const ctx = await requireTenant(slug, undefined, "management");
  const canWrite = ctx.permissions.includes("classes.write");

  const supabase = await createClient();
  const [{ data: classes }, { data: sports }, { data: teachers }, { data: occupancy }] = await Promise.all([
    supabase
      .from("classes")
      .select(
        "id, name, capacity, monthly_fee_cents, status, sports(name), teachers(name), class_schedules(weekday, start_time, end_time)"
      )
      .eq("tenant_id", ctx.tenant.id)
      .is("deleted_at", null)
      .order("name"),
    supabase.from("sports").select("id, name").eq("tenant_id", ctx.tenant.id).is("deleted_at", null).order("name"),
    supabase.from("teachers").select("id, name").eq("tenant_id", ctx.tenant.id).is("deleted_at", null).order("name"),
    supabase.from("class_occupancy").select("class_id, enrolled").eq("tenant_id", ctx.tenant.id),
  ]);
  const enrolledByClass = new Map((occupancy ?? []).map((o) => [o.class_id, o.enrolled as number]));

  return (
    <>
      <PageHeader title="Turmas" />
      <ErrorBanner message={erro} />

      {canWrite && (
        <FormToggle title="Nova turma">
          {!sports?.length ? (
            <p className="text-sm text-zinc-400">Cadastre uma modalidade antes de criar turmas.</p>
          ) : (
            <form action={createClass} className="grid gap-3 sm:grid-cols-2">
              <input type="hidden" name="slug" value={slug} />
              <Field label="Nome">
                <Input name="name" placeholder="Ex.: Beach Tennis Intermediário" required />
              </Field>
              <Field label="Modalidade">
                <select name="sport_id" required className={selectClass}>
                  {sports.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Professor">
                <select name="teacher_id" className={selectClass} defaultValue="">
                  <option value="">Sem professor</option>
                  {(teachers ?? []).map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Capacidade">
                <Input name="capacity" type="number" min={1} defaultValue={12} required />
              </Field>
              <Field label="Valor mensal (R$)">
                <Input name="monthly_fee" inputMode="decimal" defaultValue="0" />
              </Field>
              <Field label="Observações">
                <Input name="notes" />
              </Field>
              <div className="sm:col-span-2">
                <Button type="submit">Criar e definir horários</Button>
              </div>
            </form>
          )}
        </FormToggle>
      )}

      <div className="grid gap-3 md:grid-cols-2">
        {(classes ?? []).map((c) => {
          const enrolled = enrolledByClass.get(c.id) ?? 0;
          const free = Math.max(c.capacity - enrolled, 0);
          const schedules = (c.class_schedules ?? []) as Schedule[];
          return (
            <Link
              key={c.id}
              href={`/t/${slug}/turmas/${c.id}`}
              className="arena-class-card rounded-xl border border-zinc-800 bg-zinc-900/60 p-4"
              style={{ "--sport": sportColor(one(c.sports as { name: string } | { name: string }[] | null)?.name) } as React.CSSProperties}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="font-medium">{c.name}</div>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs ${
                    free === 0 ? "bg-red-950 text-red-300" : "bg-emerald-950 text-emerald-300"
                  }`}
                >
                  {free === 0 ? "Lotada" : `${free} vaga(s)`}
                </span>
              </div>
              <div className="mt-1 text-xs text-zinc-500">
                {one(c.sports as { name: string } | { name: string }[] | null)?.name} ·{" "}
                {one(c.teachers as { name: string } | { name: string }[] | null)?.name ?? "sem professor"} ·{" "}
                {brl(c.monthly_fee_cents)}
              </div>
              <div className="mt-3 flex items-center justify-between text-sm text-zinc-300">
                <span>
                  {enrolled}/{c.capacity} alunos
                </span>
              </div>
              <div className="arena-meter mt-1" aria-hidden>
                <span style={{ width: `${Math.min(100, Math.round((enrolled / c.capacity) * 100))}%` }} />
              </div>
              <div className="mt-1 text-xs text-zinc-400">
                {schedules.length
                  ? schedules
                      .map((s) => `${WEEKDAYS[s.weekday].slice(0, 3)} ${hhmm(s.start_time)}-${hhmm(s.end_time)}`)
                      .join(" · ")
                  : "sem horários"}
              </div>
            </Link>
          );
        })}
        {!classes?.length && <p className="text-sm text-zinc-500">Nenhuma turma cadastrada.</p>}
      </div>
    </>
  );
}
