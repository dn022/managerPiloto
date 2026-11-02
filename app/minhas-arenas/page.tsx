import Link from "next/link";
import { redirect } from "next/navigation";

import ArenaBackground from "@/app/_components/ArenaBackground";
import { Button } from "@/app/_components/ui/button";
import { signOut } from "@/app/_lib/actions/authSession";
import { isPlatformAdmin, requireUser } from "@/app/_lib/session";
import { createClient } from "@/app/_lib/supabase/server";

export default async function MinhasArenasPage() {
  const user = await requireUser();
  const supabase = await createClient();

  const [{ data: memberships }, platformAdmin] = await Promise.all([
    supabase
      .from("memberships")
      .select("tenants(name, slug)")
      .eq("user_id", user.id)
      .eq("status", "active"),
    isPlatformAdmin(),
  ]);

  const tenants = (memberships ?? [])
    .map((m) => (Array.isArray(m.tenants) ? m.tenants[0] : m.tenants))
    .filter((t): t is { name: string; slug: string } => Boolean(t));

  if (tenants.length === 1 && !platformAdmin) redirect(`/t/${tenants[0].slug}`);

  return (
    <div className="arena-shell">
      <ArenaBackground />
      <div className="arena-content mx-auto max-w-lg px-4 py-10">
      <h1 className="mb-6 text-2xl font-semibold">Minhas arenas</h1>

      <div className="space-y-3">
        {tenants.map((t) => (
          <Link
            key={t.slug}
            href={`/t/${t.slug}`}
            className="block rounded-xl border border-zinc-800 bg-zinc-900/60 p-4 hover:bg-zinc-900"
          >
            {t.name}
          </Link>
        ))}
        {tenants.length === 0 && (
          <p className="text-sm text-zinc-400">Você ainda não pertence a nenhuma arena.</p>
        )}
        {platformAdmin && (
          <Link
            href="/platform"
            className="block rounded-xl border border-zinc-700 p-4 text-zinc-300 hover:bg-zinc-900"
          >
            Administração da plataforma
          </Link>
        )}
      </div>

      <form action={signOut} className="mt-8">
        <Button type="submit" variant="ghost" className="text-zinc-400">
          Sair
        </Button>
      </form>
      </div>
    </div>
  );
}
