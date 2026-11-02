import { Button } from "@/app/_components/ui/button";
import { archiveSport, createSport } from "@/app/_lib/actions/management";
import { requireTenant } from "@/app/_lib/session";
import { createClient } from "@/app/_lib/supabase/server";
import { Card, ErrorBanner, Input, PageHeader, FormToggle } from "../_components/ui";

export default async function ModalidadesPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ erro?: string }>;
}) {
  const { slug } = await params;
  const { erro } = await searchParams;
  const ctx = await requireTenant(slug, "sports.read", "management");
  const canWrite = ctx.permissions.includes("sports.write");

  const supabase = await createClient();
  const { data: sports } = await supabase
    .from("sports")
    .select("id, name")
    .eq("tenant_id", ctx.tenant.id)
    .is("deleted_at", null)
    .order("name");

  return (
    <>
      <PageHeader title="Modalidades" subtitle="Esportes oferecidos pela arena." />
      <ErrorBanner message={erro} />

      {canWrite && (
        <FormToggle title="Nova modalidade">
          <form action={createSport} className="flex gap-3">
            <input type="hidden" name="slug" value={slug} />
            <Input name="name" placeholder="Ex.: Beach Tennis" required />
            <Button type="submit">Adicionar</Button>
          </form>
        </FormToggle>
      )}

      <Card>
        <ul className="divide-y divide-zinc-800 text-sm">
          {(sports ?? []).map((s) => (
            <li key={s.id} className="flex items-center justify-between py-2">
              <span>{s.name}</span>
              {canWrite && (
                <form action={archiveSport}>
                  <input type="hidden" name="slug" value={slug} />
                  <input type="hidden" name="id" value={s.id} />
                  <Button type="submit" variant="ghost" size="sm" className="text-zinc-400">
                    Arquivar
                  </Button>
                </form>
              )}
            </li>
          ))}
          {!sports?.length && <li className="py-2 text-zinc-500">Nenhuma modalidade cadastrada.</li>}
        </ul>
      </Card>
    </>
  );
}
