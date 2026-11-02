import Link from "next/link";
import { notFound } from "next/navigation";

import { Button } from "@/app/_components/ui/button";
import { addCategory, addEntry, addPoints, deactivateEntry } from "@/app/_lib/actions/ranking";
import { requireTenant } from "@/app/_lib/session";
import { createClient } from "@/app/_lib/supabase/server";
import { Card, ErrorBanner, Field, Input, PageHeader, selectClass } from "../../_components/ui";

type Standing = {
  entry_id: string;
  category_id: string | null;
  name: string;
  total_points: number;
  events_count: number;
  position: number;
};

type PointEvent = {
  id: string;
  entry_id: string;
  points: number;
  reason: string;
  source_type: string;
  created_at: string;
};

export default async function RankingDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string; id: string }>;
  searchParams: Promise<{ erro?: string; historico?: string }>;
}) {
  const { slug, id } = await params;
  const { erro, historico } = await searchParams;
  const ctx = await requireTenant(slug, undefined, "ranking");
  const canWrite = ctx.permissions.includes("rankings.write");

  const supabase = await createClient();
  const { data: ranking } = await supabase
    .from("rankings")
    .select("id, name, season, status")
    .eq("tenant_id", ctx.tenant.id)
    .eq("id", id)
    .maybeSingle();
  if (!ranking) notFound();

  const [{ data: categories }, { data: standings }, { data: students }, { data: events }] = await Promise.all([
    supabase.from("ranking_categories").select("id, name").eq("ranking_id", id).order("name"),
    supabase
      .from("ranking_standings")
      .select("entry_id, category_id, name, total_points, events_count, position")
      .eq("ranking_id", id)
      .order("position")
      .order("name"),
    canWrite
      ? supabase
          .from("students")
          .select("id, name")
          .eq("tenant_id", ctx.tenant.id)
          .eq("status", "active")
          .is("deleted_at", null)
          .order("name")
          .limit(500)
      : Promise.resolve({ data: [] as { id: string; name: string }[] }),
    historico
      ? supabase
          .from("ranking_point_events")
          .select("id, entry_id, points, reason, source_type, created_at")
          .eq("entry_id", historico)
          .order("created_at", { ascending: false })
      : Promise.resolve({ data: [] as PointEvent[] }),
  ]);

  const rows = (standings ?? []) as Standing[];
  const groups = [
    ...(categories ?? []).map((c) => ({ id: c.id as string | null, name: c.name })),
    ...(rows.some((r) => r.category_id === null) ? [{ id: null, name: "Sem categoria" }] : []),
  ];
  const active = ranking.status === "active";

  return (
    <>
      <Link href={`/t/${slug}/ranking`} className="mb-4 inline-block text-sm text-zinc-400 hover:text-zinc-100">
        ← Rankings
      </Link>
      <PageHeader title={ranking.name} subtitle={`Temporada ${ranking.season}${active ? "" : " · arquivado"}`} />
      <ErrorBanner message={erro} />

      <div className="space-y-6">
        {groups.map((g) => {
          const list = rows.filter((r) => r.category_id === g.id);
          return (
            <Card key={g.id ?? "none"} title={g.name}>
              <ol className="divide-y divide-zinc-800 text-sm">
                {list.map((r) => (
                  <li key={r.entry_id} className="flex items-center justify-between gap-3 py-2">
                    <div className="flex items-center gap-3">
                      <span className="w-6 text-right text-zinc-500">{r.position}º</span>
                      <Link
                        href={`/t/${slug}/ranking/${id}?historico=${r.entry_id}`}
                        className="hover:underline"
                      >
                        {r.name}
                      </Link>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-medium">{r.total_points} pts</span>
                      {canWrite && active && (
                        <form action={deactivateEntry}>
                          <input type="hidden" name="slug" value={slug} />
                          <input type="hidden" name="ranking_id" value={id} />
                          <input type="hidden" name="id" value={r.entry_id} />
                          <Button type="submit" variant="ghost" size="sm" className="text-zinc-400">
                            Remover
                          </Button>
                        </form>
                      )}
                    </div>
                  </li>
                ))}
                {!list.length && <li className="py-2 text-zinc-500">Sem participantes.</li>}
              </ol>
            </Card>
          );
        })}
        {!groups.length && <p className="text-sm text-zinc-500">Crie uma categoria e adicione participantes.</p>}

        {historico && (
          <Card title="Histórico de pontos">
            <ul className="divide-y divide-zinc-800 text-sm">
              {((events ?? []) as PointEvent[]).map((e) => (
                <li key={e.id} className="flex justify-between py-2">
                  <span>
                    {e.reason}
                    <span className="ml-2 text-xs text-zinc-500">
                      {new Date(e.created_at).toLocaleDateString("pt-BR")}
                      {e.source_type === "championship" ? " · campeonato" : ""}
                    </span>
                  </span>
                  <span className={e.points > 0 ? "text-emerald-300" : "text-red-300"}>
                    {e.points > 0 ? "+" : ""}
                    {e.points}
                  </span>
                </li>
              ))}
              {!events?.length && <li className="py-2 text-zinc-500">Sem lançamentos.</li>}
            </ul>
          </Card>
        )}

        {canWrite && active && (
          <div className="grid gap-6 lg:grid-cols-3">
            <Card title="Nova categoria">
              <form action={addCategory} className="flex gap-2">
                <input type="hidden" name="slug" value={slug} />
                <input type="hidden" name="ranking_id" value={id} />
                <Input name="name" placeholder="Ex.: Adulto" required />
                <Button type="submit">Criar</Button>
              </form>
            </Card>

            <Card title="Adicionar participante">
              <form action={addEntry} className="space-y-3">
                <input type="hidden" name="slug" value={slug} />
                <input type="hidden" name="ranking_id" value={id} />
                <Field label="Aluno da arena">
                  <select name="student_id" className={selectClass} defaultValue="">
                    <option value="">Atleta externo (digitar nome)</option>
                    {(students ?? []).map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Nome (atleta externo)">
                  <Input name="name" />
                </Field>
                <Field label="Categoria">
                  <select name="category_id" className={selectClass} defaultValue="">
                    <option value="">Sem categoria</option>
                    {(categories ?? []).map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </Field>
                <Button type="submit">Adicionar</Button>
              </form>
            </Card>

            <Card title="Lançar pontos">
              <form action={addPoints} className="space-y-3">
                <input type="hidden" name="slug" value={slug} />
                <input type="hidden" name="ranking_id" value={id} />
                <Field label="Participante">
                  <select name="entry_id" required className={selectClass}>
                    {rows.map((r) => (
                      <option key={r.entry_id} value={r.entry_id}>
                        {r.name}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Pontos (negativo para descontar)">
                  <Input name="points" type="number" step={1} required />
                </Field>
                <Field label="Motivo">
                  <Input name="reason" placeholder="Ex.: Campeão do torneio X" required />
                </Field>
                <Button type="submit" disabled={!rows.length}>
                  Lançar
                </Button>
              </form>
            </Card>
          </div>
        )}
      </div>
    </>
  );
}
