import Link from "next/link";

import ArenaBackground from "@/app/_components/ArenaBackground";
import { Button } from "@/app/_components/ui/button";
import { signOut } from "@/app/_lib/actions/authSession";
import { requireTenant } from "@/app/_lib/session";
import { brandColor, logoUrl } from "@/app/_lib/tenant-brand";
import TenantNav, { type NavSection } from "./_components/TenantNav";

const SUBSCRIPTION_WARNING: Record<string, string> = {
  past_due: "Há uma pendência na assinatura desta organização. Regularize para evitar a suspensão.",
  expired: "O período de teste terminou. Fale com o suporte da plataforma para continuar usando.",
  cancelled: "A assinatura desta organização está cancelada.",
};

export default async function TenantLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const ctx = await requireTenant(slug);
  const base = `/t/${ctx.tenant.slug}`;
  const can = (permission: string) => ctx.permissions.includes(permission);

  const sections: NavSection[] = [{ title: null, items: [{ href: base, label: "Dashboard" }] }];

  if (ctx.modules.includes("management")) {
    const items = [
      can("students.read") && { href: `${base}/alunos`, label: "Alunos" },
      can("teachers.read") && { href: `${base}/professores`, label: "Professores" },
      can("sports.read") && { href: `${base}/modalidades`, label: "Modalidades" },
      { href: `${base}/turmas`, label: "Turmas" },
      can("payments.read") && { href: `${base}/mensalidades`, label: "Mensalidades" },
      { href: `${base}/agenda`, label: "Agenda" },
    ].filter((i): i is { href: string; label: string } => Boolean(i));
    sections.push({ title: "Gestão", items });
  }

  if (ctx.modules.includes("championships")) {
    sections.push({
      title: "Campeonatos",
      items: [
        { href: `${base}/campeonatos`, label: "Eventos" },
        ...(can("championships.write") ? [{ href: `${base}/campeonatos/cronometro`, label: "Cronômetro" }] : []),
      ],
    });
  }

  if (ctx.modules.includes("ranking")) {
    sections.push({ title: "Ranking", items: [{ href: `${base}/ranking`, label: "Rankings" }] });
  }

  const adminItems = [
    can("users.read") && { href: `${base}/usuarios`, label: "Usuários" },
    can("tenant.manage") && { href: `${base}/configuracoes`, label: "Configurações" },
    can("tenant.manage") && { href: `${base}/plano`, label: "Plano" },
  ].filter((i): i is { href: string; label: string } => Boolean(i));
  if (adminItems.length) sections.push({ title: "Administração", items: adminItems });

  const warning = SUBSCRIPTION_WARNING[ctx.subscriptionStatus ?? ""];

  const logo = logoUrl(ctx.tenant.logoPath);
  const color = brandColor(ctx.tenant.settings);

  return (
    <div className="arena-shell" style={color ? ({ "--arena-accent": color } as React.CSSProperties) : undefined}>
      <ArenaBackground />
      <div className="arena-content">
      <header
        className="glass sticky top-0 z-20 border-b px-4 py-3 md:px-6 md:py-4"
      >
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <Link href={base} className="flex items-center gap-3 text-lg font-semibold">
            {logo && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logo} alt="" className="h-8 w-auto rounded" />
            )}
            {ctx.tenant.name}
          </Link>
          <form action={signOut}>
            <Button type="submit" variant="ghost" size="sm" className="text-zinc-400">
              Sair
            </Button>
          </form>
        </div>
      </header>
      <div className="mx-auto flex max-w-7xl flex-col gap-5 px-4 py-5 md:flex-row md:gap-8 md:px-6 md:py-8">
        <aside className="sticky top-[57px] z-10 -mx-4 -mt-5 md:top-24 md:mx-0 md:mt-0 md:h-fit md:max-h-[calc(100vh-7rem)] md:w-52 md:shrink-0 md:overflow-y-auto">
          <TenantNav sections={sections} />
        </aside>
        <main className="min-w-0 flex-1">
          {warning && (
            <div className="mb-4 rounded-xl border border-amber-900/50 bg-amber-950/40 px-3 py-2 text-sm text-amber-200">
              {warning}
            </div>
          )}
          {children}
        </main>
      </div>
      </div>
    </div>
  );
}
