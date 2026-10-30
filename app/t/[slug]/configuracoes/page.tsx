import { Button } from "@/app/_components/ui/button";
import { removeLogo, updateOrganization, uploadLogo } from "@/app/_lib/actions/settings";
import { requireTenant } from "@/app/_lib/session";
import { brandColor, logoUrl } from "@/app/_lib/tenant-brand";
import { Card, ErrorBanner, Field, Input, PageHeader } from "../_components/ui";

export default async function ConfiguracoesPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ erro?: string; ok?: string }>;
}) {
  const { slug } = await params;
  const { erro, ok } = await searchParams;
  const { tenant } = await requireTenant(slug, "tenant.manage");
  const s = tenant.settings;
  const logo = logoUrl(tenant.logoPath);

  return (
    <>
      <PageHeader title="Configurações" subtitle="Dados e identidade visual da organização." />
      <ErrorBanner message={erro} />
      {ok !== undefined && (
        <div className="mb-4 rounded-xl border border-emerald-900/50 bg-emerald-950/40 px-3 py-2 text-sm text-emerald-200">
          Alterações salvas.
        </div>
      )}

      <div className="space-y-6">
        <Card title="Organização">
          <form action={updateOrganization} className="grid gap-3 sm:grid-cols-2">
            <input type="hidden" name="slug" value={slug} />
            <Field label="Nome">
              <Input name="name" defaultValue={tenant.name} required maxLength={120} />
            </Field>
            <Field label="Cor principal">
              <input
                type="color"
                name="primary_color"
                defaultValue={brandColor(s) ?? "#10b981"}
                className="h-10 w-full rounded-md border border-zinc-800 bg-black/40 p-1"
              />
            </Field>
            <Field label="Telefone">
              <Input name="phone" defaultValue={s.phone ?? ""} maxLength={200} />
            </Field>
            <Field label="WhatsApp">
              <Input name="whatsapp" defaultValue={s.whatsapp ?? ""} maxLength={200} />
            </Field>
            <Field label="Instagram">
              <Input name="instagram" defaultValue={s.instagram ?? ""} maxLength={200} />
            </Field>
            <Field label="Site">
              <Input name="website" defaultValue={s.website ?? ""} maxLength={200} />
            </Field>
            <div className="sm:col-span-2">
              <Field label="Endereço">
                <Input name="address" defaultValue={s.address ?? ""} maxLength={200} />
              </Field>
            </div>
            <div className="sm:col-span-2">
              <Button type="submit">Salvar</Button>
            </div>
          </form>
        </Card>

        <Card title="Logo">
          {logo && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logo} alt={`Logo de ${tenant.name}`} className="mb-4 h-20 w-auto rounded-md bg-black/40 p-2" />
          )}
          <form action={uploadLogo} className="flex flex-wrap items-end gap-3">
            <input type="hidden" name="slug" value={slug} />
            <Field label="Imagem (PNG, JPG ou WebP, até 1 MB)">
              <input
                type="file"
                name="logo"
                accept="image/png,image/jpeg,image/webp"
                required
                className="block text-sm text-zinc-300"
              />
            </Field>
            <Button type="submit">Enviar logo</Button>
          </form>
          {logo && (
            <form action={removeLogo} className="mt-3">
              <input type="hidden" name="slug" value={slug} />
              <Button type="submit" variant="ghost" size="sm" className="text-zinc-400">
                Remover logo
              </Button>
            </form>
          )}
        </Card>
      </div>
    </>
  );
}
