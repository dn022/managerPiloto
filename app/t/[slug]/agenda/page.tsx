import Link from "next/link";

import { Button } from "@/app/_components/ui/button";
import { requireTenant } from "@/app/_lib/session";
import { createClient } from "@/app/_lib/supabase/server";
import { hhmm, WEEKDAY_ORDER, WEEKDAYS } from "@/app/_lib/weekdays";
import { Card, PageHeader, selectClass, sportColor } from "../_components/ui";

const one = <T,>(v: T | T[] | null): T | null => (Array.isArray(v) ? (v[0] ?? null) : v);

type Row = {
  id: string;
  weekday: number;
  start_time: string;
  end_time: string;
  classes: {
    id: string;
    name: string;
    sport_id: string;
    teacher_id: string | null;
    status: string;
    deleted_at: string | null;
    sports: { name: string } | { name: string }[] | null;
    teachers: { name: string } | { name: string }[] | null;
  } | null;
};

export default async function AgendaPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ modalidade?: string; professor?: string; turma?: string }>;
}) {
  const { slug } = await params;
  const { modalidade, professor, turma } = await searchParams;
  const ctx = await requireTenant(slug, undefined, "management");
  const today = new Date().getDay();

  const supabase = await createClient();
  const [{ data: rows }, { data: sports }, { data: teachers }, { data: classes }] = await Promise.all([
    supabase
      .from("class_schedules")
      .select(
        "id, weekday, start_time, end_time, classes!inner(id, name, sport_id, teacher_id, status, deleted_at, sports(name), teachers(name))"
      )
      .eq("tenant_id", ctx.tenant.id)
      .order("start_time"),
    supabase.from("sports").select("id, name").eq("tenant_id", ctx.tenant.id).is("deleted_at", null).order("name"),
    supabase.from("teachers").select("id, name").eq("tenant_id", ctx.tenant.id).is("deleted_at", null).order("name"),
    supabase.from("classes").select("id, name").eq("tenant_id", ctx.tenant.id).is("deleted_at", null).order("name"),
  ]);

  const items = ((rows ?? []) as unknown as (Omit<Row, "classes"> & { classes: Row["classes"] | Row["classes"][] })[])
    .map((r) => ({ ...r, classes: one(r.classes) }))
    .filter((r): r is Row & { classes: NonNullable<Row["classes"]> } => Boolean(r.classes))
    .filter((r) => !r.classes.deleted_at && r.classes.status === "active")
    .filter((r) => !modalidade || r.classes.sport_id === modalidade)
    .filter((r) => !professor || r.classes.teacher_id === professor)
    .filter((r) => !turma || r.classes.id === turma);

  return (
    <>
      <PageHeader title="Agenda" subtitle="Turmas organizadas por dia e horário." />

      <form className="mb-6 grid gap-3 sm:grid-cols-4">
        <select name="modalidade" defaultValue={modalidade ?? ""} className={selectClass}>
          <option value="">Todas as modalidades</option>
          {(sports ?? []).map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <select name="professor" defaultValue={professor ?? ""} className={selectClass}>
          <option value="">Todos os professores</option>
          {(teachers ?? []).map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
        <select name="turma" defaultValue={turma ?? ""} className={selectClass}>
          <option value="">Todas as turmas</option>
          {(classes ?? []).map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <Button type="submit" variant="secondary">
          Filtrar
        </Button>
      </form>

      <div className="grid gap-4 md:grid-cols-2">
        {WEEKDAY_ORDER.map((day) => {
          const list = items.filter((i) => i.weekday === day);
          if (!list.length) return null;
          return (
            <Card key={day} title={WEEKDAYS[day].toUpperCase() + (day === today ? " · HOJE" : "")} className={day === today ? "arena-today" : ""}>
              <ul className="space-y-3 text-sm">
                {list.map((i) => (
                  <li
                    key={i.id}
                    className="arena-slot"
                    style={{ "--sport": sportColor(one(i.classes.sports)?.name) } as React.CSSProperties}
                  >
                    <div className="text-xs font-medium tabular-nums text-zinc-400">
                      {hhmm(i.start_time)}–{hhmm(i.end_time)}
                    </div>
                    <Link href={`/t/${slug}/turmas/${i.classes.id}`} className="font-medium hover:underline">
                      {i.classes.name}
                    </Link>
                    <div className="text-xs text-zinc-500">
                      {one(i.classes.teachers)?.name ?? "sem professor"}
                    </div>
                  </li>
                ))}
              </ul>
            </Card>
          );
        })}
        {!items.length && <p className="text-sm text-zinc-500">Nenhuma aula encontrada.</p>}
      </div>
    </>
  );
}
