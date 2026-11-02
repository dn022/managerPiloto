import Link from "next/link";

import { CHAMPIONSHIP_STATUS_LABEL } from "@/app/_lib/championship-labels";
import { PageHeader } from "../../_components/ui";

const TABS = [
  { path: "", label: "Visão geral" },
  { path: "/inscricoes", label: "Inscrições" },
  { path: "/chaves", label: "Chaves" },
  { path: "/resultados", label: "Resultados" },
  { path: "/despesas", label: "Despesas", finance: true },
];

export default function ChampionshipHeader({
  slug,
  id,
  name,
  status,
  eventDate,
  active,
  canSeeFinance,
}: {
  slug: string;
  id: string;
  name: string;
  status: string;
  eventDate: string | null;
  active: string;
  canSeeFinance: boolean;
}) {
  const base = `/t/${slug}/campeonatos/${id}`;
  return (
    <>
      <Link href={`/t/${slug}/campeonatos`} className="mb-4 inline-block text-sm text-zinc-400 hover:text-zinc-100">
        ← Campeonatos
      </Link>
      <PageHeader
        title={name}
        subtitle={`${CHAMPIONSHIP_STATUS_LABEL[status]}${eventDate ? ` · ${eventDate}` : ""}`}
      />
      <div className="mb-6 flex flex-wrap gap-2 border-b border-zinc-800 pb-3 text-sm">
        {TABS.filter((t) => !t.finance || canSeeFinance).map((t) => (
          <Link
            key={t.path}
            href={`${base}${t.path}`}
            className={`rounded-lg px-3 py-1.5 ${
              active === t.path ? "bg-zinc-800 text-white" : "text-zinc-400 hover:bg-zinc-900"
            }`}
          >
            {t.label}
          </Link>
        ))}
      </div>
    </>
  );
}
