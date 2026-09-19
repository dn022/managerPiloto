"use client";

import * as React from "react";
import Link from "next/link";

import type { BeltColor, ParticipantAdmin } from "@/app/_lib/types";
import { beltDotClasses, beltLabel, getCategoryLabel } from "@/app/_lib/types";
import { useRouter } from "next/navigation";
import { logout } from "@/app/_lib/auth";
import { Button } from "@/app/_components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/app/_components/ui/table";
import { Input } from "@/app/_components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/app/_components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import { Menu } from "lucide-react";

type Group = {
  key: string;
  title: string;
  athletes: ParticipantAdmin[];
};

function round1(n: number) {
  return Math.round(n * 10) / 10;
}

function normalizeCategory(cat?: string | null) {
  const c = (cat ?? "").trim();
  return c ? getCategoryLabel(c as ParticipantAdmin["category"]) : "Sem categoria";
}

function buildGroupsByCategory(list: ParticipantAdmin[]): Group[] {
  const byCategory = new Map<string, ParticipantAdmin[]>();

  for (const p of list) {
    const category = normalizeCategory(p.category);
    const current = byCategory.get(category) ?? [];
    current.push(p);
    byCategory.set(category, current);
  }

  return Array.from(byCategory.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([category, athletes]) => ({
      key: `cat:${category}`,
      title: category,
      athletes: [...athletes].sort((a, b) => a.full_name.localeCompare(b.full_name)),
    }));
}

function buildCategoryCards(list: ParticipantAdmin[]) {
  const map = new Map<string, number>();

  for (const p of list) {
    const category = normalizeCategory(p.category);
    map.set(category, (map.get(category) ?? 0) + 1);
  }

  return Array.from(map.entries())
    .map(([category, count]) => ({ category, count }))
    .sort((a, b) => b.count - a.count);
}

export default function CategoriesClient({ all }: { all: ParticipantAdmin[] }) {
  const router = useRouter();

  function handleLogout() {
    logout();
    router.push("/");
  }

  const [filterCategory, setFilterCategory] = React.useState<string>("ALL");
  const [filterMinWeight, setFilterMinWeight] = React.useState<string>("");
  const [filterMaxWeight, setFilterMaxWeight] = React.useState<string>("");
  const [filterBelt, setFilterBelt] = React.useState<string>("ALL");
  const [filterMinAge, setFilterMinAge] = React.useState<string>("");
  const [filterMaxAge, setFilterMaxAge] = React.useState<string>("");

  // Segurança extra: mantém a página sempre com inscritos pagos.
  const paidParticipants = React.useMemo(
    () => all.filter((p) => (p.status ?? "").toLowerCase() === "paid"),
    [all]
  );

  const uniqueCategories = React.useMemo(() => {
    const cats = new Set(paidParticipants.map((p) => normalizeCategory(p.category)));
    return Array.from(cats).sort();
  }, [paidParticipants]);

  const uniqueBelts = React.useMemo(() => {
    const order: BeltColor[] = [
      "CINZA",
      "AMARELA",
      "LARANJA",
      "VERDE",
      "BRANCA",
      "AZUL",
      "ROXA",
      "MARROM",
      "PRETA",
    ];
    const present = new Set(paidParticipants.map((p) => p.belt_color));
    return order.filter((belt) => present.has(belt));
  }, [paidParticipants]);

  const filteredList = React.useMemo(() => {
    return paidParticipants.filter((p) => {
      if (filterCategory !== "ALL" && normalizeCategory(p.category) !== filterCategory) {
        return false;
      }

      const minWeight = filterMinWeight ? Number(filterMinWeight) : undefined;
      const maxWeight = filterMaxWeight ? Number(filterMaxWeight) : undefined;
      const weight = p.weight_kg;

      if (minWeight !== undefined && !Number.isNaN(minWeight)) {
        if (weight === null || weight < minWeight) return false;
      }

      if (maxWeight !== undefined && !Number.isNaN(maxWeight)) {
        if (weight === null || weight > maxWeight) return false;
      }

      if (filterBelt !== "ALL" && p.belt_color !== filterBelt) {
        return false;
      }

      const minAge = filterMinAge ? Number(filterMinAge) : undefined;
      const maxAge = filterMaxAge ? Number(filterMaxAge) : undefined;

      if (minAge !== undefined && !Number.isNaN(minAge) && p.age < minAge) {
        return false;
      }

      if (maxAge !== undefined && !Number.isNaN(maxAge) && p.age > maxAge) {
        return false;
      }

      return true;
    });
  }, [
    paidParticipants,
    filterCategory,
    filterMinWeight,
    filterMaxWeight,
    filterBelt,
    filterMinAge,
    filterMaxAge,
  ]);

  const groups = React.useMemo(() => buildGroupsByCategory(filteredList), [filteredList]);
  const categoryCards = React.useMemo(() => buildCategoryCards(filteredList), [filteredList]);

  return (
    <div className="min-h-screen bg-black text-zinc-100">
      <header className="sticky top-0 z-10 border-b border-zinc-900 bg-black/80 backdrop-blur">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h1 className="text-xl font-semibold">Categorias</h1>
              <p className="text-sm text-zinc-400">
                Inscritos pagos: {paidParticipants.length} • Exibidos: {filteredList.length} •
                Categorias: {groups.length}
              </p>
            </div>

            <div className="hidden md:flex items-center gap-3">
              <Button
                asChild
                variant="outline"
                className="h-8 rounded-xl border-zinc-800 bg-zinc-950/40 hover:bg-white"
              >
                <Link href="/admin/painel">Painel</Link>
              </Button>

              <Button
                asChild
                variant="outline"
                className="h-8 rounded-xl border-zinc-800 bg-zinc-950/40 hover:bg-white"
              >
                <Link href="/admin/chaveamento">Chaveamento</Link>
              </Button>

              <Link href="/admin/cashback">
                  <Button
                    variant="outline"
                    className="cursor-pointer h-9 rounded-xl px-3 border-zinc-800 bg-transparent text-zinc-100 hover:bg-white hover:text-black"
                  >
                    Cashback
                  </Button>
                </Link>

              <Link href="/admin/cronometro">
                  <Button
                    variant="outline"
                    className="cursor-pointer h-9 rounded-xl px-3 border-zinc-800 bg-transparent text-zinc-100 hover:bg-white hover:text-black"
                  >
                    Cronometro
                  </Button>
                </Link>

              <Button
                variant="ghost"
                className="cursor-pointer h-9 rounded-xl px-3 text-zinc-300 hover:text-red-700 hover:bg-zinc-900"
                type="button"
                onClick={handleLogout}
              >
                Sair
              </Button>
            </div>

            {/* Mobile dropdown menu */}
            <div className="md:hidden">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      className="cursor-pointer h-9 w-9 rounded-xl p-0 text-zinc-300 hover:bg-zinc-900 hover:text-zinc-100"
                    >
                      <Menu className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="border-zinc-800 bg-zinc-950 text-zinc-100">
                    <Link href="/admin/painel"><DropdownMenuItem className="cursor-pointer data-highlighted:bg-white">Painel</DropdownMenuItem></Link>
                    <Link href="/admin/chaveamento"><DropdownMenuItem className="cursor-pointer data-highlighted:bg-white">Chaveamento</DropdownMenuItem></Link>
                    <Link href="/admin/cashback"><DropdownMenuItem className="cursor-pointer data-highlighted:bg-white">Cashback</DropdownMenuItem></Link>
                    <Link href="/admin/cronometro"><DropdownMenuItem className="cursor-pointer data-highlighted:bg-white">Cronometro</DropdownMenuItem></Link>
                    <DropdownMenuSeparator />
                    <Link href="/"><DropdownMenuItem className="cursor-pointer hover:text-red-700 data-highlighted:bg-white">Sair</DropdownMenuItem></Link>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
          </div>
        </div>
      </header>


      <main className="container mx-auto px-4 py-8">
        <div className="mb-8 grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-6">
          {categoryCards.map((card) => (
            <div
              key={card.category}
              className="rounded-2xl border border-zinc-900 bg-zinc-950/40 p-4"
            >
              <div className="text-xs text-zinc-400">Categoria</div>
              <div className="mt-1 text-sm font-semibold text-zinc-100 truncate">
                {card.category}
              </div>
              <div className="mt-3 text-2xl font-bold text-zinc-100">{card.count}</div>
              <div className="text-xs text-zinc-500">inscrito(s)</div>
            </div>
          ))}
        </div>

        <div className="mb-8 flex flex-wrap items-end justify-start gap-4 rounded-2xl border border-zinc-900 bg-zinc-950/40 p-4 md:justify-center">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-zinc-400">Categoria</label>
            <Select value={filterCategory} onValueChange={setFilterCategory}>
              <SelectTrigger className="w-full sm:w-[180px] border-zinc-800 bg-black/40 text-zinc-100">
                <SelectValue placeholder="Todas" />
              </SelectTrigger>
              <SelectContent className="border-zinc-800 bg-zinc-950 text-zinc-100">
                <SelectItem value="ALL">Todas</SelectItem>
                {uniqueCategories.map((category) => (
                  <SelectItem key={category} value={category}>
                    {category}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-zinc-400">Peso (kg)</label>
            <div className="flex items-center gap-2">
              <Input
                placeholder="Min"
                type="number"
                className="w-[72px] sm:w-[80px] border-zinc-800 bg-black/40 text-zinc-100 placeholder:text-zinc-600"
                value={filterMinWeight}
                onChange={(e) => setFilterMinWeight(e.target.value)}
              />
              <span className="text-zinc-500">-</span>
              <Input
                placeholder="Max"
                type="number"
                className="w-[72px] sm:w-[80px] border-zinc-800 bg-black/40 text-zinc-100 placeholder:text-zinc-600"
                value={filterMaxWeight}
                onChange={(e) => setFilterMaxWeight(e.target.value)}
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-zinc-400">Faixa</label>
            <Select value={filterBelt} onValueChange={setFilterBelt}>
              <SelectTrigger className="w-full sm:w-[160px] border-zinc-800 bg-black/40 text-zinc-100">
                <SelectValue placeholder="Todas" />
              </SelectTrigger>
              <SelectContent className="border-zinc-800 bg-zinc-950 text-zinc-100">
                <SelectItem value="ALL">Todas</SelectItem>
                {uniqueBelts.map((belt) => (
                  <SelectItem key={belt} value={belt}>
                    {beltLabel[belt]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-zinc-400">Idade</label>
            <div className="flex items-center gap-2">
              <Input
                placeholder="Min"
                type="number"
                className="w-[64px] sm:w-[70px] border-zinc-800 bg-black/40 text-zinc-100 placeholder:text-zinc-600"
                value={filterMinAge}
                onChange={(e) => setFilterMinAge(e.target.value)}
              />
              <span className="text-zinc-500">-</span>
              <Input
                placeholder="Max"
                type="number"
                className="w-[64px] sm:w-[70px] border-zinc-800 bg-black/40 text-zinc-100 placeholder:text-zinc-600"
                value={filterMaxAge}
                onChange={(e) => setFilterMaxAge(e.target.value)}
              />
            </div>
          </div>
        </div>

        {groups.length === 0 ? (
          <div className="rounded-2xl border border-zinc-900 bg-zinc-950/40 p-8 text-center text-zinc-400">
            Nenhuma inscrição paga encontrada com os filtros atuais.
          </div>
        ) : (
          groups.map((group) => (
            <section
              key={group.key}
              className="rounded-2xl border border-zinc-900 bg-zinc-950/40 p-6 mb-6"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-zinc-100">{group.title}</h3>
                <span className="text-sm text-zinc-400">
                  {group.athletes.length} atleta(s)
                </span>
              </div>

              <div className="mt-4 overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-zinc-900">
                      <TableHead className="text-zinc-400">Atleta</TableHead>
                      <TableHead className="text-zinc-400">Idade</TableHead>
                      <TableHead className="text-zinc-400">Peso</TableHead>
                      <TableHead className="text-zinc-400">Faixa</TableHead>
                      <TableHead className="text-zinc-400">Categoria</TableHead>
                      <TableHead className="text-zinc-400">Academia</TableHead>
                    </TableRow>
                  </TableHeader>

                  <TableBody>
                    {group.athletes.map((p) => (
                      <TableRow key={p.id} className="border-zinc-900 hover:bg-zinc-900/20">
                        <TableCell className="py-4">
                          <div className="font-medium text-zinc-100">{p.full_name}</div>
                          <div className="text-sm text-zinc-400">{p.phone_number}</div>
                        </TableCell>

                        <TableCell className="text-zinc-100">{p.age}</TableCell>

                        <TableCell className="text-zinc-100">
                          {p.weight_kg === null ? "-" : `${round1(p.weight_kg)} kg`}
                        </TableCell>

                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span
                              className={[
                                "h-3.5 w-3.5 rounded-full border",
                                beltDotClasses[p.belt_color],
                              ].join(" ")}
                              aria-hidden
                            />
                            <span className="text-zinc-100">{beltLabel[p.belt_color]}</span>
                          </div>
                        </TableCell>

                        <TableCell className="text-zinc-100">{normalizeCategory(p.category)}</TableCell>

                        <TableCell className="text-zinc-100">{p.academy ?? "-"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </section>
          ))
        )}
      </main>
    </div>
  );
}
