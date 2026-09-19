"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { logout } from "@/app/_lib/auth";
import { Menu } from "lucide-react";

import { Button } from "@/app/_components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/app/_components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/app/_components/ui/table";
import { getCategoryLabel, type ParticipantAdmin } from "@/app/_lib/types";

type Group = {
  academy: string;
  athletes: ParticipantAdmin[];
};

function normalizeAcademy(value?: string | null) {
  const academy = (value ?? "").trim();
  return academy || "Sem academia";
}

function normalizeCategory(value?: string | null) {
  const category = (value ?? "").trim();
  return category ? getCategoryLabel(category as ParticipantAdmin["category"]) : "Sem categoria";
}

function buildAcademyGroups(list: ParticipantAdmin[]): Group[] {
  const byAcademy = new Map<string, ParticipantAdmin[]>();

  for (const athlete of list) {
    const academy = normalizeAcademy(athlete.academy);
    const current = byAcademy.get(academy) ?? [];
    current.push(athlete);
    byAcademy.set(academy, current);
  }

  return Array.from(byAcademy.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([academy, athletes]) => ({
      academy,
      athletes: [...athletes].sort((a, b) => a.full_name.localeCompare(b.full_name)),
    }));
}

export default function CashbackClient({ all }: { all: ParticipantAdmin[] }) {
  const router = useRouter();

  function handleLogout() {
    logout();
    router.push("/");
  }

  const paidParticipants = React.useMemo(
    () => all.filter((p) => (p.status ?? "").toLowerCase() === "paid"),
    [all]
  );

  const CASHBACK_PER_ATHLETE = 10;

  function calculateCashbackValue(athletesCount: number) {
    return athletesCount * CASHBACK_PER_ATHLETE;
  }

  function formatCurrencyBRL(value: number) {
    return value.toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    });
  }

  const academies = React.useMemo(() => {
    const set = new Set(paidParticipants.map((p) => normalizeAcademy(p.academy)));
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [paidParticipants]);

  const [academyFilter, setAcademyFilter] = React.useState<string>("ALL");

  const filtered = React.useMemo(() => {
    if (academyFilter === "ALL") return paidParticipants;
    return paidParticipants.filter((p) => normalizeAcademy(p.academy) === academyFilter);
  }, [paidParticipants, academyFilter]);

  const groups = React.useMemo(() => buildAcademyGroups(filtered), [filtered]);

  return (
    <div className="min-h-screen bg-black text-zinc-100">
      <header className="sticky top-0 z-10 border-b border-zinc-900 bg-black/80 backdrop-blur">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h1 className="text-xl font-semibold">Cashback</h1>
              <p className="text-sm text-zinc-400">
                Inscritos pagos: {paidParticipants.length} • Academias: {academies.length} • Exibidos: {filtered.length}
              </p>
            </div>

            <div className="hidden items-center gap-3 md:flex">
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
                <Link href="/admin/categorias">Categorias</Link>
              </Button>

              <Button
                asChild
                variant="outline"
                className="h-8 rounded-xl border-zinc-800 bg-zinc-950/40 hover:bg-white"
              >
                <Link href="/admin/chaveamento">Chaveamento</Link>
              </Button>

              <Button
                asChild
                variant="outline"
                className="h-8 rounded-xl border-zinc-800 bg-zinc-950/40 hover:bg-white"
              >
                <Link href="/admin/cronometro">Cronometro</Link>
              </Button>

              <Button
                variant="ghost"
                className="cursor-pointer h-9 rounded-xl px-3 text-zinc-300 hover:bg-zinc-900 hover:text-red-700"
                type="button"
                onClick={handleLogout}
              >
                Sair
              </Button>
            </div>

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
                <DropdownMenuContent
                  align="end"
                  className="border-zinc-800 bg-zinc-950 text-zinc-100"
                >
                  <Link href="/admin/painel">
                    <DropdownMenuItem className="cursor-pointer data-highlighted:bg-white">
                      Painel
                    </DropdownMenuItem>
                  </Link>
                  <Link href="/admin/categorias">
                    <DropdownMenuItem className="cursor-pointer data-highlighted:bg-white">
                      Categorias
                    </DropdownMenuItem>
                  </Link>
                  <Link href="/admin/chaveamento">
                    <DropdownMenuItem className="cursor-pointer data-highlighted:bg-white">
                      Chaveamento
                    </DropdownMenuItem>
                  </Link>
                  <Link href="/admin/cronometro">
                    <DropdownMenuItem className="cursor-pointer data-highlighted:bg-white">
                      Cronometro
                    </DropdownMenuItem>
                  </Link>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={handleLogout}
                    className="cursor-pointer hover:text-red-700 data-highlighted:bg-white"
                  >
                    Sair
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto space-y-6 px-4 py-8">
        <section className="rounded-2xl border border-zinc-900 bg-zinc-950/40 p-4">
          <label htmlFor="academy-filter" className="mb-2 block text-xs text-zinc-400">
            Filtrar por academia
          </label>
          <select
            id="academy-filter"
            className="w-full rounded-xl border border-zinc-800 bg-black px-3 py-2 text-zinc-100"
            value={academyFilter}
            onChange={(e) => setAcademyFilter(e.target.value)}
          >
            <option value="ALL">Todas as academias</option>
            {academies.map((academy) => (
              <option key={academy} value={academy}>
                {academy}
              </option>
            ))}
          </select>
        </section>

        <section className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-6">
          {groups.map((group) => {
            const cashbackValue = calculateCashbackValue(group.athletes.length);

            return(
            <div
              key={group.academy}
              className="rounded-2xl border border-zinc-900 bg-zinc-950/40 p-4"
            >
              <div className="text-xs text-zinc-400">Academia</div>
              <div className="mt-1 truncate text-sm font-semibold text-zinc-100">{group.academy}</div>
              <div className="mt-3 text-2xl font-bold text-zinc-100">{group.athletes.length}</div>
              <div className="text-xs text-zinc-500">atleta(s) pago(s)</div>
              <div className="text-xs text-white">Valor Cashback: {formatCurrencyBRL(cashbackValue)}</div>
            </div>
            );
          })}
        </section>

        {groups.length === 0 ? (
          <div className="rounded-2xl border border-zinc-900 bg-zinc-950/40 p-8 text-center text-zinc-400">
            Nenhum atleta pago encontrado para o filtro selecionado.
          </div>
        ) : (
          groups.map((group) => (
            <section
              key={`table:${group.academy}`}
              className="rounded-2xl border border-zinc-900 bg-zinc-950/40 p-6"
            >
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-zinc-100">{group.academy}</h2>
                <span className="text-sm text-zinc-400">{group.athletes.length} atleta(s)</span>
              </div>

              <div className="mt-4 overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-zinc-900">
                      <TableHead className="text-zinc-400">Atleta</TableHead>
                      <TableHead className="text-zinc-400">Idade</TableHead>
                      <TableHead className="text-zinc-400">Faixa</TableHead>
                      <TableHead className="text-zinc-400">Categoria</TableHead>
                      <TableHead className="text-zinc-400">Valor Pago</TableHead>
                      <TableHead className="text-zinc-400">Telefone</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {group.athletes.map((athlete) => (
                      <TableRow key={athlete.id} className="border-zinc-900 hover:bg-zinc-900/20">
                        <TableCell className="font-medium text-zinc-100">{athlete.full_name}</TableCell>
                        <TableCell className="text-zinc-100">{athlete.age}</TableCell>
                        <TableCell className="text-zinc-100">{athlete.belt_color}</TableCell>
                        <TableCell className="text-zinc-100">{normalizeCategory(athlete.category)}</TableCell>
                        <TableCell className="text-zinc-100">
                          {typeof athlete.valor_inscricao === "number"
                            ? formatCurrencyBRL(athlete.valor_inscricao)
                            : "-"}
                        </TableCell>
                        <TableCell className="text-zinc-100">{athlete.phone_number}</TableCell>
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

