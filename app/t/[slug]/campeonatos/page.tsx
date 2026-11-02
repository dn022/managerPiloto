import Link from "next/link";

import { Button } from "@/app/_components/ui/button";
import { CHAMPIONSHIP_STATUS_LABEL } from "@/app/_lib/championship-labels";
import { createChampionship } from "@/app/_lib/actions/championships";
import { requireTenant } from "@/app/_lib/session";
import { createClient } from "@/app/_lib/supabase/server";
import { Card, ErrorBanner, Field, Input, PageHeader, selectClass, FormToggle } from "../_components/ui";

const one = <T,>(v: T | T[] | null): T | null => (Array.isArray(v) ? (v[0] ?? null) : v);

export default async function CampeonatosPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ erro?: string }>;
}) {
  const { slug } = await params;
  const { erro } = await searchParams;
  const ctx = await requireTenant(slug, undefined, "championships");
  const canWrite = ctx.permissions.includes("championships.write");

  const supabase = await createClient();
  const [{ data: championships }, { data: sports }] = await Promise.all([
    supabase
      .from("championships")
      .select("id, name, event_date, status, sports(name)")
      .eq("tenant_id", ctx.tenant.id)
      .order("event_date", { ascending: false, nullsFirst: true }),
    supabase.from("sports").select("id, name").eq("tenant_id", ctx.tenant.id).is("deleted_at", null).order("name"),
  ]);

  return (
    <>
      <PageHeader title="Campeonatos" subtitle="Eventos esportivos da arena." />
      <ErrorBanner message={erro} />

      {canWrite && (
        <FormToggle title="Novo campeonato">
          <form action={createChampionship} className="grid gap-3 sm:grid-cols-2">
            <input type="hidden" name="slug" value={slug} />
            <Field label="Nome">
              <Input name="name" placeholder="Ex.: Open Beach Tennis 2026" required />
            </Field>
            <Field label="Data">
              <Input name="event_date" type="date" />
            </Field>
            <Field label="Local">
              <Input name="location" />
            </Field>
            <Field label="Modalidade (opcional)">
              <select name="sport_id" className={selectClass} defaultValue="">
                <option value="">Nenhuma</option>
                {(sports ?? []).map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </Field>
            <div className="sm:col-span-2">
              <Button type="submit">Criar campeonato</Button>
            </div>
          </form>
        </FormToggle>
      )}

      <Card>
        <ul className="divide-y divide-zinc-800 text-sm">
          {(championships ?? []).map((c) => (
            <li key={c.id} className="py-3">
              <Link href={`/t/${slug}/campeonatos/${c.id}`} className="flex items-center justify-between hover:underline">
                <div>
                  <div>{c.name}</div>
                  <div className="text-xs text-zinc-500">
                    {c.event_date ?? "sem data"}
                    {one(c.sports as { name: string } | { name: string }[] | null)
                      ? ` · ${one(c.sports as { name: string } | { name: string }[] | null)?.name}`
                      : ""}
                  </div>
                </div>
                <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-xs text-zinc-300">
                  {CHAMPIONSHIP_STATUS_LABEL[c.status]}
                </span>
              </Link>
            </li>
          ))}
          {!championships?.length && <li className="py-3 text-zinc-500">Nenhum campeonato.</li>}
        </ul>
      </Card>
    </>
  );
}
