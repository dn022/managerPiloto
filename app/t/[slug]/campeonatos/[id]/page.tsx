import { notFound } from "next/navigation";

import { Button } from "@/app/_components/ui/button";
import {
  addCategory,
  removeCategory,
  removePointsRule,
  setPointsRule,
  updateChampionship,
} from "@/app/_lib/actions/championships";
import { CHAMPIONSHIP_STATUS_LABEL } from "@/app/_lib/championship-labels";
import { requireTenant } from "@/app/_lib/session";
import { createClient } from "@/app/_lib/supabase/server";
import { Card, ErrorBanner, Field, Input, selectClass } from "../../_components/ui";
import ChampionshipHeader from "../_components/ChampionshipHeader";

export default async function CampeonatoPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string; id: string }>;
  searchParams: Promise<{ erro?: string }>;
}) {
  const { slug, id } = await params;
  const { erro } = await searchParams;
  const ctx = await requireTenant(slug, undefined, "championships");
  const canWrite = ctx.permissions.includes("championships.write");
  const hasRanking = ctx.modules.includes("ranking");

  const supabase = await createClient();
  const { data: champ } = await supabase
    .from("championships")
    .select("id, name, status, event_date, location, ranking_id")
    .eq("tenant_id", ctx.tenant.id)
    .eq("id", id)
    .maybeSingle();
  if (!champ) notFound();

  const [{ data: categories }, { data: rules }, { data: rankings }] = await Promise.all([
    supabase
      .from("championship_categories")
      .select("id, name, gender, min_age, max_age, min_weight_kg, max_weight_kg, level")
      .eq("championship_id", id)
      .order("name"),
    supabase.from("championship_points_rules").select("placement, points").eq("championship_id", id).order("placement"),
    hasRanking
      ? supabase.from("rankings").select("id, name, season").eq("tenant_id", ctx.tenant.id).eq("status", "active").order("name")
      : Promise.resolve({ data: [] as { id: string; name: string; season: string }[] }),
  ]);

  const range = (min: number | null, max: number | null, unit: string) =>
    min === null && max === null ? null : `${min ?? "…"}–${max ?? "…"}${unit}`;

  return (
    <>
      <ChampionshipHeader
        slug={slug}
        id={id}
        name={champ.name}
        status={champ.status}
        eventDate={champ.event_date}
        active=""
        canSeeFinance={ctx.permissions.includes("payments.read")}
      />
      <ErrorBanner message={erro} />

      <div className="grid gap-6 lg:grid-cols-2">
        {canWrite && (
          <Card title="Situação e ranking">
            <form action={updateChampionship} className="space-y-3">
              <input type="hidden" name="slug" value={slug} />
              <input type="hidden" name="id" value={id} />
              <Field label="Situação">
                <select name="status" defaultValue={champ.status} className={selectClass}>
                  {Object.entries(CHAMPIONSHIP_STATUS_LABEL).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
              </Field>
              {hasRanking ? (
                <Field label="Gerar pontos para o ranking (opcional)">
                  <select name="ranking_id" defaultValue={champ.ranking_id ?? ""} className={selectClass}>
                    <option value="">Não vincular</option>
                    {(rankings ?? []).map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name} · {r.season}
                      </option>
                    ))}
                  </select>
                </Field>
              ) : (
                <input type="hidden" name="ranking_id" value={champ.ranking_id ?? ""} />
              )}
              <Button type="submit">Salvar</Button>
            </form>
          </Card>
        )}

        {hasRanking && champ.ranking_id && (
          <Card title="Pontos por colocação">
            <ul className="mb-4 divide-y divide-zinc-800 text-sm">
              {(rules ?? []).map((r) => (
                <li key={r.placement} className="flex items-center justify-between py-2">
                  <span>
                    {r.placement}º lugar · <strong>{r.points} pts</strong>
                  </span>
                  {canWrite && (
                    <form action={removePointsRule}>
                      <input type="hidden" name="slug" value={slug} />
                      <input type="hidden" name="championship_id" value={id} />
                      <input type="hidden" name="placement" value={r.placement} />
                      <Button type="submit" variant="ghost" size="sm" className="text-zinc-400">
                        Remover
                      </Button>
                    </form>
                  )}
                </li>
              ))}
              {!rules?.length && <li className="py-2 text-zinc-500">Nenhuma regra de pontos.</li>}
            </ul>
            {canWrite && (
              <form action={setPointsRule} className="flex items-end gap-2">
                <input type="hidden" name="slug" value={slug} />
                <input type="hidden" name="championship_id" value={id} />
                <Field label="Colocação">
                  <Input name="placement" type="number" min={1} required className="w-24" />
                </Field>
                <Field label="Pontos">
                  <Input name="points" type="number" required className="w-28" />
                </Field>
                <Button type="submit" variant="secondary">
                  Salvar regra
                </Button>
              </form>
            )}
          </Card>
        )}
      </div>

      <Card title="Categorias" className="mt-6">
        <ul className="mb-4 divide-y divide-zinc-800 text-sm">
          {(categories ?? []).map((c) => (
            <li key={c.id} className="flex items-center justify-between py-2">
              <div>
                <div>{c.name}</div>
                <div className="text-xs text-zinc-500">
                  {[
                    c.gender === "M" ? "Masculino" : c.gender === "F" ? "Feminino" : null,
                    range(c.min_age, c.max_age, " anos"),
                    range(c.min_weight_kg, c.max_weight_kg, " kg"),
                    c.level,
                  ]
                    .filter(Boolean)
                    .join(" · ") || "sem restrições"}
                </div>
              </div>
              {canWrite && (
                <form action={removeCategory}>
                  <input type="hidden" name="slug" value={slug} />
                  <input type="hidden" name="championship_id" value={id} />
                  <input type="hidden" name="id" value={c.id} />
                  <Button type="submit" variant="ghost" size="sm" className="text-zinc-400">
                    Remover
                  </Button>
                </form>
              )}
            </li>
          ))}
          {!categories?.length && <li className="py-2 text-zinc-500">Nenhuma categoria configurada.</li>}
        </ul>

        {canWrite && (
          <form action={addCategory} className="grid gap-3 sm:grid-cols-4">
            <input type="hidden" name="slug" value={slug} />
            <input type="hidden" name="championship_id" value={id} />
            <div className="sm:col-span-2">
              <Field label="Nome">
                <Input name="name" placeholder="Ex.: Adulto Masculino Iniciante" required />
              </Field>
            </div>
            <Field label="Sexo">
              <select name="gender" className={selectClass} defaultValue="">
                <option value="">Qualquer</option>
                <option value="M">Masculino</option>
                <option value="F">Feminino</option>
              </select>
            </Field>
            <Field label="Nível / classe">
              <Input name="level" placeholder="Ex.: Iniciante" />
            </Field>
            <Field label="Idade mín.">
              <Input name="min_age" type="number" min={0} />
            </Field>
            <Field label="Idade máx.">
              <Input name="max_age" type="number" min={0} />
            </Field>
            <Field label="Peso mín. (kg)">
              <Input name="min_weight_kg" inputMode="decimal" />
            </Field>
            <Field label="Peso máx. (kg)">
              <Input name="max_weight_kg" inputMode="decimal" />
            </Field>
            <div className="sm:col-span-4">
              <Button type="submit" variant="secondary">
                Adicionar categoria
              </Button>
            </div>
          </form>
        )}
      </Card>
    </>
  );
}
