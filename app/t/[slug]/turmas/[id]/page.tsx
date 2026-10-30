import Link from "next/link";
import { notFound } from "next/navigation";

import { Button } from "@/app/_components/ui/button";
import {
  addSchedule,
  endEnrollment,
  enrollStudent,
  removeSchedule,
} from "@/app/_lib/actions/management";
import { requireTenant } from "@/app/_lib/session";
import { createClient } from "@/app/_lib/supabase/server";
import { brl, hhmm, WEEKDAY_ORDER, WEEKDAYS } from "@/app/_lib/weekdays";
import { Card, ErrorBanner, Field, Input, PageHeader, selectClass } from "../../_components/ui";

const one = <T,>(v: T | T[] | null): T | null => (Array.isArray(v) ? (v[0] ?? null) : v);

export default async function TurmaDetalhePage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string; id: string }>;
  searchParams: Promise<{ erro?: string }>;
}) {
  const { slug, id } = await params;
  const { erro } = await searchParams;
  const ctx = await requireTenant(slug, undefined, "management");
  const canEditClass = ctx.permissions.includes("classes.write");
  const canEnroll = ctx.permissions.includes("enrollments.write");
  const canOverride = ctx.permissions.includes("enrollments.override");

  const supabase = await createClient();
  const { data: klass } = await supabase
    .from("classes")
    .select("id, name, capacity, monthly_fee_cents, notes, sports(name), teachers(name)")
    .eq("tenant_id", ctx.tenant.id)
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();
  if (!klass) notFound();

  const [{ data: schedules }, { data: enrollments }, { data: candidates }] = await Promise.all([
    supabase
      .from("class_schedules")
      .select("id, weekday, start_time, end_time")
      .eq("class_id", id)
      .order("weekday")
      .order("start_time"),
    supabase
      .from("enrollments")
      .select("id, status, started_at, ended_at, fee_cents, capacity_override, students(id, name, phone)")
      .eq("class_id", id)
      .order("started_at", { ascending: false }),
    canEnroll
      ? supabase
          .from("students")
          .select("id, name")
          .eq("tenant_id", ctx.tenant.id)
          .eq("status", "active")
          .is("deleted_at", null)
          .order("name")
          .limit(500)
      : Promise.resolve({ data: [] as { id: string; name: string }[] }),
  ]);

  const active = (enrollments ?? []).filter((e) => e.status === "active");
  const enrolledIds = new Set(
    (enrollments ?? [])
      .filter((e) => e.status !== "ended")
      .map((e) => one(e.students as { id: string } | { id: string }[] | null)?.id)
  );
  const available = (candidates ?? []).filter((s) => !enrolledIds.has(s.id));
  const free = Math.max(klass.capacity - active.length, 0);
  const sortedSchedules = [...(schedules ?? [])].sort(
    (a, b) => WEEKDAY_ORDER.indexOf(a.weekday as never) - WEEKDAY_ORDER.indexOf(b.weekday as never)
  );

  return (
    <>
      <Link href={`/t/${slug}/turmas`} className="mb-4 inline-block text-sm text-zinc-400 hover:text-zinc-100">
        ← Turmas
      </Link>
      <PageHeader
        title={klass.name}
        subtitle={`${one(klass.sports as { name: string } | { name: string }[] | null)?.name} · ${
          one(klass.teachers as { name: string } | { name: string }[] | null)?.name ?? "sem professor"
        } · ${brl(klass.monthly_fee_cents)}/mês · ${active.length}/${klass.capacity} alunos (${free} vaga(s))`}
      />
      <ErrorBanner message={erro} />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Horários">
          <ul className="mb-4 divide-y divide-zinc-800 text-sm">
            {sortedSchedules.map((s) => (
              <li key={s.id} className="flex items-center justify-between py-2">
                <span>
                  {WEEKDAYS[s.weekday]} · {hhmm(s.start_time)}–{hhmm(s.end_time)}
                </span>
                {canEditClass && (
                  <form action={removeSchedule}>
                    <input type="hidden" name="slug" value={slug} />
                    <input type="hidden" name="class_id" value={id} />
                    <input type="hidden" name="id" value={s.id} />
                    <Button type="submit" variant="ghost" size="sm" className="text-zinc-400">
                      Remover
                    </Button>
                  </form>
                )}
              </li>
            ))}
            {!sortedSchedules.length && <li className="py-2 text-zinc-500">Sem horários.</li>}
          </ul>
          {canEditClass && (
            <form action={addSchedule} className="grid grid-cols-3 items-end gap-2">
              <input type="hidden" name="slug" value={slug} />
              <input type="hidden" name="class_id" value={id} />
              <Field label="Dia">
                <select name="weekday" className={selectClass} defaultValue="1">
                  {WEEKDAY_ORDER.map((d) => (
                    <option key={d} value={d}>
                      {WEEKDAYS[d]}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Início">
                <Input name="start_time" type="time" required />
              </Field>
              <Field label="Fim">
                <Input name="end_time" type="time" required />
              </Field>
              <div className="col-span-3">
                <Button type="submit" variant="secondary">
                  Adicionar horário
                </Button>
              </div>
            </form>
          )}
        </Card>

        <Card title="Matricular aluno">
          {canEnroll ? (
            <form action={enrollStudent} className="space-y-3">
              <input type="hidden" name="slug" value={slug} />
              <input type="hidden" name="class_id" value={id} />
              <Field label="Aluno">
                <select name="student_id" required className={selectClass}>
                  {available.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Valor contratado (R$)">
                <Input name="fee" inputMode="decimal" defaultValue={(klass.monthly_fee_cents / 100).toFixed(2)} />
              </Field>
              <Field label="Observações">
                <Input name="notes" />
              </Field>
              {canOverride && (
                <label className="flex items-center gap-2 text-sm text-zinc-300">
                  <input type="checkbox" name="capacity_override" />
                  Autorizar exceção de capacidade
                </label>
              )}
              <Button type="submit" disabled={!available.length}>
                Matricular
              </Button>
            </form>
          ) : (
            <p className="text-sm text-zinc-500">Sem permissão para matricular.</p>
          )}
        </Card>
      </div>

      <Card title={`Alunos matriculados (${active.length})`} className="mt-6">
        <ul className="divide-y divide-zinc-800 text-sm">
          {(enrollments ?? []).map((e) => {
            const st = one(e.students as { id: string; name: string; phone: string | null } | { id: string; name: string; phone: string | null }[] | null);
            return (
              <li key={e.id} className="flex items-center justify-between py-2">
                <div>
                  <div className={e.status === "ended" ? "text-zinc-500 line-through" : ""}>{st?.name}</div>
                  <div className="text-xs text-zinc-500">
                    desde {e.started_at}
                    {e.ended_at ? ` até ${e.ended_at}` : ""} · {brl(e.fee_cents)}
                    {e.capacity_override ? " · exceção de capacidade" : ""}
                  </div>
                </div>
                {canEnroll && e.status !== "ended" && (
                  <form action={endEnrollment}>
                    <input type="hidden" name="slug" value={slug} />
                    <input type="hidden" name="class_id" value={id} />
                    <input type="hidden" name="id" value={e.id} />
                    <Button type="submit" variant="ghost" size="sm" className="text-zinc-400">
                      Encerrar
                    </Button>
                  </form>
                )}
              </li>
            );
          })}
          {!enrollments?.length && <li className="py-2 text-zinc-500">Nenhum aluno matriculado.</li>}
        </ul>
      </Card>
    </>
  );
}
