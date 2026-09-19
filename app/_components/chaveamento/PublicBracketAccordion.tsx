"use client";

import * as React from "react";
import { ChevronDown } from "lucide-react";

import BracketVisualization from "@/app/_components/chaveamento/BracketVisualization";
import type { Bracket } from "@/app/_lib/chaveamento";

type GroupedBracket = {
  categoryLabel: string;
  brackets: Bracket[];
  athletesCountByBracketId: Record<string, number>;
};

export default function PublicBracketAccordion({ groups }: { groups: GroupedBracket[] }) {
  const [openCategory, setOpenCategory] = React.useState<string | null>(null);

  return (
    <div className="space-y-5">
      {groups.map((group) => {
        const isOpen = openCategory === group.categoryLabel;

        return (
          <section
            key={group.categoryLabel}
            className="rounded-3xl border border-zinc-800 bg-zinc-950/60 p-5 backdrop-blur"
          >
            <button
              type="button"
              onClick={() =>
                setOpenCategory((current) => (current === group.categoryLabel ? null : group.categoryLabel))
              }
              className="flex w-full cursor-pointer items-center justify-between gap-4 text-left"
            >
              <div>
                <div className="text-xs uppercase tracking-[0.3em] text-zinc-500">Categoria</div>
                <div className="mt-1 text-2xl font-semibold text-zinc-50">{group.categoryLabel}</div>
                <div className="mt-2 text-sm text-zinc-400">
                  {group.brackets.length} chave(s) publicada(s)
                </div>
              </div>

              <div
                className={`flex h-11 w-11 items-center justify-center rounded-full border border-zinc-700 bg-zinc-900/70 transition ${
                  isOpen ? "rotate-180" : ""
                }`}
              >
                <ChevronDown className="h-5 w-5" />
              </div>
            </button>

            {isOpen ? (
              <div className="mt-5 space-y-6">
                {group.brackets.map((bracket) => (
                  <section
                    key={bracket.id}
                    className="rounded-3xl border border-zinc-800 bg-zinc-950/55 p-4 md:p-6"
                  >
                    <BracketVisualization
                      bracket={bracket}
                      athletesCount={group.athletesCountByBracketId[bracket.id] ?? 0}
                    />
                  </section>
                ))}
              </div>
            ) : null}
          </section>
        );
      })}
    </div>
  );
}
