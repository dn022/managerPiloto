import Link from "next/link";

import { Button } from "@/app/_components/ui/button";
import { archiveRanking, createRanking } from "@/app/_lib/actions/ranking";
import { requireTenant } from "@/app/_lib/session";
import { createClient } from "@/app/_lib/supabase/server";
import { Card, ErrorBanner, Field, Input, PageHeader, selectClass, FormToggle } from "../_components/ui";

const one = <T,>(v: T | T[] | null): T | null => (Array.isArray(v) ? (v[0] ?? null) : v);

export default async function RankingListPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ erro?: string; arquivados?: string }>;
}) {
  const { slug } = await params;
  const { erro, arquivados } = await searchParams;
  const ctx = await requireTenant(slug, undefined, "ranking");
  const canWrite = ctx.permissions.includes("rankings.write");
  const showArchived = arquivados === "1";

  const supabase = await createClient();
  const [{ data: rankings }, { data: sports }] = await Promise.all([
    supabase
      .from("rankings")
      .select("id, name, season, status, sports(name)")
      .eq("tenant_id", ctx.tenant.id)
      .eq("status", showArchived ? "archived" : "active")
      .order("season", { ascending: false })
      .order("name"),
    canWrite
      ? supabase.from("sports").select("id, name").eq("tenant_id", ctx.tenant.id).is("deleted_at", null).order("name")
      : Promise.resolve({ data: [] as { id: string; name: string }[] }),
  ]);

  return (
    <>
      <PageHeader title="Ranking" subtitle="Classificações por temporada, baseadas em histórico de pontos." />
      <ErrorBanner message={erro} />

      {canWrite && (
        <FormToggle title="Novo ranking">
          <form action={createRanking} className="grid gap-3 sm:grid-cols-3">
            <input type="hidden" name="slug" value={slug} />
            <Field label="Nome">
              <Input name="name" placeholder="Ex.: Ranking Beach Tennis" required />
            </Field>
            <Field label="Temporada">
              <Input name="season" placeholder="2026" defaultValue={new Date().getFullYear()} required />
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
            <div className="sm:col-span-3">
              <Button type="submit">Criar ranking</Button>
            </div>
          </form>
        </FormToggle>
      )}

      <div className="mb-3 text-sm">
        <Link className="underline" href={`/t/${slug}/ranking${showArchived ? "" : "?arquivados=1"}`}>
          {showArchived ? "Ver ativos" : "Ver arquivados"}
        </Link>
      </div>

      <Card>
        <ul className="divide-y divide-zinc-800 text-sm">
          {(rankings ?? []).map((r) => (
            <li key={r.id} className="flex items-center justify-between py-3">
              <Link href={`/t/${slug}/ranking/${r.id}`} className="hover:underline">
                <div>{r.name}</div>
                <div className="text-xs text-zinc-500">
                  Temporada {r.season}
                  {one(r.sports as { name: string } | { name: string }[] | null)
                    ? ` · ${one(r.sports as { name: string } | { name: string }[] | null)?.name}`
                    : ""}
                </div>
              </Link>
              {canWrite && r.status === "active" && (
                <form action={archiveRanking}>
                  <input type="hidden" name="slug" value={slug} />
                  <input type="hidden" name="id" value={r.id} />
                  <Button type="submit" variant="ghost" size="sm" className="text-zinc-400">
                    Arquivar
                  </Button>
                </form>
              )}
            </li>
          ))}
          {!rankings?.length && <li className="py-3 text-zinc-500">Nenhum ranking.</li>}
        </ul>
      </Card>
    </>
  );
}
