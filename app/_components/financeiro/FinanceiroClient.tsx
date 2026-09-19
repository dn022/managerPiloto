"use client";

import * as React from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
} from "recharts";
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Users,
  AlertCircle,
  Plus,
  Trash2,
  X,
  LogOut,
  ChevronUp,
} from "lucide-react";
import { Button } from "@/app/_components/ui/button";
import { Input } from "@/app/_components/ui/input";
import { Label } from "@/app/_components/ui/label";
import { logoutFinanceiro } from "@/app/_lib/authFinanceiro";
import { useRouter } from "next/navigation";
import type { ParticipantAdmin } from "@/app/_lib/types";
import type { Custo } from "@/app/_lib/actions/custos";

const CATEGORIAS_CUSTO = [
  "Geral",
  "Infraestrutura",
  "Marketing",
  "Premiação",
  "Alimentação",
  "Transporte",
  "Equipe",
  "Outros",
];

const PIE_COLORS = ["#10b981", "#3b82f6", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899"];

function fmt(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

function fmtDate(dateStr: string) {
  const [y, m, d] = dateStr.split("-");
  return `${d}/${m}/${y}`;
}

function getMonthKey(dateStr: string) {
  const d = new Date(dateStr + "T12:00:00");
  return `${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

interface Props {
  athletes: ParticipantAdmin[];
  initialCustos: Custo[];
}

export default function FinanceiroClient({ athletes, initialCustos }: Props) {
  const router = useRouter();
  const [custos, setCustos] = React.useState<Custo[]>(initialCustos);
  const [loading, setLoading] = React.useState(false);
  const [formError, setFormError] = React.useState<string | null>(null);

  // Modal atletas por valor
  const [modalValor, setModalValor] = React.useState<number | null>(null);

  // Formulário novo custo
  const [novoDescricao, setNovoDescricao] = React.useState("");
  const [novoValor, setNovoValor] = React.useState("");
  const [novoData, setNovoData] = React.useState(
    new Date().toISOString().split("T")[0]
  );
  const [novoCategoria, setNovoCategoria] = React.useState("Geral");
  const [showFormCusto, setShowFormCusto] = React.useState(false);

  const paidAthletes = athletes.filter((a) => a.status === "paid");
  const pendingAthletes = athletes.filter((a) => a.status !== "paid");

  // Receita total (apenas pagos, usando valor_inscricao)
  const totalReceita = paidAthletes.reduce(
    (acc, a) => acc + (a.valor_inscricao ?? 0),
    0
  );

  // Total custos
  const totalCustos = custos.reduce((acc, c) => acc + Number(c.valor), 0);

  // Saldo
  const saldo = totalReceita - totalCustos;

  // Atletas por valor de inscrição (apenas pagos)
  const porValor = React.useMemo(() => {
    const map = new Map<number, ParticipantAdmin[]>();
    for (const a of paidAthletes) {
      const v = a.valor_inscricao ?? 0;
      if (!map.has(v)) map.set(v, []);
      map.get(v)!.push(a);
    }
    return Array.from(map.entries())
      .sort((a, b) => b[0] - a[0])
      .map(([valor, list]) => ({ valor, lista: list, total: valor * list.length }));
  }, [paidAthletes]);

  // Atletas no modal
  const atletasModal = modalValor !== null
    ? paidAthletes.filter((a) => (a.valor_inscricao ?? 0) === modalValor)
    : [];

  // Breakdown por modalidade
  const soGi = paidAthletes.filter((a) => a.mod_gi && !a.mod_nogi && !a.mod_abs).length;
  const soNogi = paidAthletes.filter((a) => !a.mod_gi && a.mod_nogi && !a.mod_abs).length;
  const soFestival = paidAthletes.filter((a) => a.festival).length;
  const combinados = paidAthletes.filter(
    (a) => !a.festival && [a.mod_gi, a.mod_nogi, a.mod_abs].filter(Boolean).length > 1
  ).length;

  const pieModalidade = [
    { name: "GI", value: soGi },
    { name: "NOGI", value: soNogi },
    { name: "Festival", value: soFestival },
    { name: "Combinados", value: combinados },
  ].filter((d) => d.value > 0);

  // Dados para gráfico mensal
  const monthlyData = React.useMemo(() => {
    const map = new Map<string, { receita: number; custo: number }>();

    for (const a of paidAthletes) {
      if (!a.created_at) continue;
      const key = getMonthKey(a.created_at);
      const entry = map.get(key) ?? { receita: 0, custo: 0 };
      entry.receita += a.valor_inscricao ?? 0;
      map.set(key, entry);
    }

    for (const c of custos) {
      const key = getMonthKey(c.data);
      const entry = map.get(key) ?? { receita: 0, custo: 0 };
      entry.custo += Number(c.valor);
      map.set(key, entry);
    }

    return Array.from(map.entries())
      .sort((a, b) => {
        const [ma, ya] = a[0].split("/").map(Number);
        const [mb, yb] = b[0].split("/").map(Number);
        return ya !== yb ? ya - yb : ma - mb;
      })
      .map(([mes, val]) => ({
        mes,
        Receita: val.receita,
        Custos: val.custo,
        Saldo: val.receita - val.custo,
      }));
  }, [paidAthletes, custos]);

  // Custos por categoria para pie
  const custosPorCategoria = React.useMemo(() => {
    const map = new Map<string, number>();
    for (const c of custos) {
      map.set(c.categoria, (map.get(c.categoria) ?? 0) + Number(c.valor));
    }
    return Array.from(map.entries()).map(([name, value]) => ({ name, value }));
  }, [custos]);

  async function handleAddCusto(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    const valorNum = parseFloat(novoValor.replace(",", "."));
    if (!novoDescricao.trim()) return setFormError("Informe a descrição.");
    if (isNaN(valorNum) || valorNum <= 0) return setFormError("Valor inválido.");
    if (!novoData) return setFormError("Informe a data.");

    setLoading(true);
    try {
      const res = await fetch("/api/financeiro/custos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          descricao: novoDescricao.trim(),
          valor: valorNum,
          data: novoData,
          categoria: novoCategoria,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erro ao criar custo");
      setCustos((prev) => [data.custo, ...prev]);
      setNovoDescricao("");
      setNovoValor("");
      setNovoData(new Date().toISOString().split("T")[0]);
      setNovoCategoria("Geral");
      setShowFormCusto(false);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Erro desconhecido");
    } finally {
      setLoading(false);
    }
  }

  async function handleDeleteCusto(id: string) {
    try {
      await fetch(`/api/financeiro/custos/${id}`, { method: "DELETE" });
      setCustos((prev) => prev.filter((c) => c.id !== id));
    } catch {
      // silently ignore
    }
  }

  function handleLogout() {
    logoutFinanceiro();
    router.replace("/financeiro/login");
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      {/* Header */}
      <header className="border-b border-zinc-800 bg-zinc-900 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-emerald-600 p-2 rounded-lg">
              <DollarSign className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">Painel Financeiro</h1>
              <p className="text-xs text-zinc-400">Bruno Carvalho JJ</p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleLogout}
            className="text-zinc-400 hover:text-white hover:bg-zinc-800"
          >
            <LogOut className="h-4 w-4 mr-2" />
            Sair
          </Button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8 space-y-10">

        {/* Cards de resumo */}
        <section>
          <h2 className="text-lg font-semibold text-zinc-300 mb-4">Resumo Geral</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <SummaryCard
              icon={<TrendingUp className="h-5 w-5 text-emerald-400" />}
              label="Total de Entradas"
              value={fmt(totalReceita)}
              sub={`${paidAthletes.length} atletas pagos`}
              color="emerald"
            />
            <SummaryCard
              icon={<TrendingDown className="h-5 w-5 text-red-400" />}
              label="Total de Custos"
              value={fmt(totalCustos)}
              sub={`${custos.length} lançamentos`}
              color="red"
            />
            <SummaryCard
              icon={
                saldo >= 0
                  ? <DollarSign className="h-5 w-5 text-blue-400" />
                  : <AlertCircle className="h-5 w-5 text-orange-400" />
              }
              label="Saldo Líquido"
              value={fmt(saldo)}
              sub={saldo >= 0 ? "Positivo" : "Negativo"}
              color={saldo >= 0 ? "blue" : "orange"}
            />
            <SummaryCard
              icon={<Users className="h-5 w-5 text-zinc-400" />}
              label="Total de Atletas"
              value={String(athletes.length)}
              sub={`${pendingAthletes.length} pendentes`}
              color="zinc"
            />
          </div>
        </section>

        {/* Receitas por valor */}
        <section>
          <h2 className="text-lg font-semibold text-zinc-300 mb-4">Receitas por Valor de Inscrição</h2>
          {porValor.length === 0 ? (
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 text-center text-zinc-500">
              Nenhum pagamento confirmado ainda.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {porValor.map(({ valor, lista, total }) => (
                <div
                  key={valor}
                  className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 flex flex-col gap-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-2xl font-bold text-emerald-400">{fmt(valor)}</span>
                    <span className="text-sm text-zinc-400 bg-zinc-800 px-2 py-0.5 rounded-full">
                      {lista.length} atleta{lista.length !== 1 ? "s" : ""}
                    </span>
                  </div>
                  <div className="text-sm text-zinc-400">
                    Total arrecadado: <span className="text-white font-medium">{fmt(total)}</span>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="mt-1 border-zinc-700 text-zinc-300 hover:bg-zinc-800 hover:text-white"
                    onClick={() => setModalValor(valor)}
                  >
                    Ver atletas
                  </Button>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Gráfico mensal */}
        <section>
          <h2 className="text-lg font-semibold text-zinc-300 mb-4">Fluxo Financeiro por Mês</h2>
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
            {monthlyData.length === 0 ? (
              <p className="text-center text-zinc-500">Sem dados suficientes para exibir.</p>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={monthlyData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#3f3f46" />
                  <XAxis dataKey="mes" stroke="#71717a" tick={{ fill: "#a1a1aa" }} />
                  <YAxis
                    stroke="#71717a"
                    tick={{ fill: "#a1a1aa" }}
                    tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`}
                  />
                  <Tooltip
                    contentStyle={{ background: "#18181b", border: "1px solid #3f3f46", borderRadius: 8 }}
                    labelStyle={{ color: "#e4e4e7" }}
                    formatter={(value) => fmt(Number(value))}
                  />
                  <Legend wrapperStyle={{ color: "#a1a1aa" }} />
                  <Bar dataKey="Receita" fill="#10b981" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Custos" fill="#ef4444" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Saldo" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </section>

        {/* Gráficos de pizza */}
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Por modalidade */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
            <h2 className="text-lg font-semibold text-zinc-300 mb-4">Atletas Pagos por Modalidade</h2>
            {pieModalidade.length === 0 ? (
              <p className="text-center text-zinc-500 py-8">Sem dados.</p>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={pieModalidade}
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    dataKey="value"
                    label={({ name, value }) => `${name}: ${value}`}
                    labelLine={false}
                  >
                    {pieModalidade.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ background: "#18181b", border: "1px solid #3f3f46", borderRadius: 8 }}
                    formatter={(v: unknown) => [`${v} atletas`]}
                  />
                  <Legend wrapperStyle={{ color: "#a1a1aa" }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Custos por categoria */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
            <h2 className="text-lg font-semibold text-zinc-300 mb-4">Custos por Categoria</h2>
            {custosPorCategoria.length === 0 ? (
              <p className="text-center text-zinc-500 py-8">Nenhum custo lançado.</p>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={custosPorCategoria}
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    dataKey="value"
                    label={({ name }) => name}
                    labelLine={false}
                  >
                    {custosPorCategoria.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ background: "#18181b", border: "1px solid #3f3f46", borderRadius: 8 }}
                    formatter={(v: unknown) => [fmt(Number(v))]}
                  />
                  <Legend wrapperStyle={{ color: "#a1a1aa" }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </section>

        {/* Informações adicionais */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <InfoCard title="Status de Pagamento">
            <InfoRow label="Pagos" value={String(paidAthletes.length)} dot="emerald" />
            <InfoRow label="Pendentes" value={String(pendingAthletes.length)} dot="yellow" />
            <InfoRow label="Total" value={String(athletes.length)} dot="zinc" />
          </InfoCard>

          <InfoCard title="Receita por Modalidade">
            {[
              { label: "GI", count: paidAthletes.filter((a) => a.mod_gi).length },
              { label: "NOGI", count: paidAthletes.filter((a) => a.mod_nogi).length },
              { label: "ABS", count: paidAthletes.filter((a) => a.mod_abs).length },
              { label: "Festival", count: paidAthletes.filter((a) => a.festival).length },
            ]
              .filter((m) => m.count > 0)
              .map((m) => (
                <InfoRow key={m.label} label={m.label} value={`${m.count} atletas`} dot="blue" />
              ))}
          </InfoCard>

          <InfoCard title="Top 5 Academias (pagos)">
            {(() => {
              const map = new Map<string, number>();
              for (const a of paidAthletes) {
                const ac = a.academy ?? "Sem academia";
                map.set(ac, (map.get(ac) ?? 0) + 1);
              }
              return Array.from(map.entries())
                .sort((a, b) => b[1] - a[1])
                .slice(0, 5)
                .map(([name, count]) => (
                  <InfoRow key={name} label={name} value={`${count}`} dot="purple" />
                ));
            })()}
          </InfoCard>
        </section>

        {/* Lançamento de custos */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-zinc-300">Lançamento de Custos</h2>
            <Button
              size="sm"
              onClick={() => setShowFormCusto((v) => !v)}
              className="bg-emerald-600 hover:bg-emerald-500 text-white"
            >
              {showFormCusto ? (
                <><ChevronUp className="h-4 w-4 mr-1" /> Fechar</>
              ) : (
                <><Plus className="h-4 w-4 mr-1" /> Novo Custo</>
              )}
            </Button>
          </div>

          {showFormCusto && (
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 mb-4">
              <form onSubmit={handleAddCusto} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="lg:col-span-2 space-y-1.5">
                  <Label className="text-zinc-300">Descrição</Label>
                  <Input
                    placeholder="Ex: Aluguel do ginásio"
                    value={novoDescricao}
                    onChange={(e) => setNovoDescricao(e.target.value)}
                    className="bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-zinc-300">Valor (R$)</Label>
                  <Input
                    placeholder="0,00"
                    value={novoValor}
                    onChange={(e) => setNovoValor(e.target.value)}
                    className="bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-zinc-300">Data</Label>
                  <Input
                    type="date"
                    value={novoData}
                    onChange={(e) => setNovoData(e.target.value)}
                    className="bg-zinc-800 border-zinc-700 text-white"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-zinc-300">Categoria</Label>
                  <select
                    value={novoCategoria}
                    onChange={(e) => setNovoCategoria(e.target.value)}
                    className="w-full h-10 rounded-md border border-zinc-700 bg-zinc-800 text-white px-3 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  >
                    {CATEGORIAS_CUSTO.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
                <div className="lg:col-span-4 flex items-center gap-3">
                  {formError && (
                    <p className="text-sm text-red-400 flex-1">{formError}</p>
                  )}
                  <Button
                    type="submit"
                    disabled={loading}
                    className="ml-auto bg-emerald-600 hover:bg-emerald-500 text-white"
                  >
                    {loading ? "Salvando..." : "Salvar Custo"}
                  </Button>
                </div>
              </form>
            </div>
          )}

          <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
            {custos.length === 0 ? (
              <div className="p-8 text-center text-zinc-500">
                Nenhum custo lançado ainda. Clique em &quot;Novo Custo&quot; para adicionar.
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-800 text-zinc-400 text-left">
                    <th className="px-4 py-3 font-medium">Data</th>
                    <th className="px-4 py-3 font-medium">Descrição</th>
                    <th className="px-4 py-3 font-medium">Categoria</th>
                    <th className="px-4 py-3 font-medium text-right">Valor</th>
                    <th className="px-4 py-3 font-medium text-center">Ação</th>
                  </tr>
                </thead>
                <tbody>
                  {custos.map((c, i) => (
                    <tr
                      key={c.id}
                      className={`border-b border-zinc-800/50 hover:bg-zinc-800/40 transition-colors ${
                        i % 2 === 0 ? "" : "bg-zinc-900/50"
                      }`}
                    >
                      <td className="px-4 py-3 text-zinc-400 whitespace-nowrap">{fmtDate(c.data)}</td>
                      <td className="px-4 py-3 text-zinc-100">{c.descricao}</td>
                      <td className="px-4 py-3">
                        <span className="bg-zinc-800 text-zinc-300 text-xs px-2 py-0.5 rounded-full">
                          {c.categoria}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-red-400 font-medium text-right whitespace-nowrap">
                        {fmt(Number(c.valor))}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => handleDeleteCusto(c.id)}
                          className="text-zinc-500 hover:text-red-400 transition-colors p-1 rounded"
                          title="Remover custo"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t border-zinc-700 bg-zinc-800/50">
                    <td colSpan={3} className="px-4 py-3 text-zinc-300 font-medium">Total de Custos</td>
                    <td className="px-4 py-3 text-red-400 font-bold text-right">{fmt(totalCustos)}</td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            )}
          </div>
        </section>
      </main>

      {/* Modal atletas por valor */}
      {modalValor !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-zinc-900 border border-zinc-700 rounded-2xl w-full max-w-lg max-h-[80vh] flex flex-col shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
              <div>
                <h3 className="text-lg font-semibold text-white">
                  Atletas — Inscrição {fmt(modalValor)}
                </h3>
                <p className="text-sm text-zinc-400">{atletasModal.length} atleta{atletasModal.length !== 1 ? "s" : ""}</p>
              </div>
              <button
                onClick={() => setModalValor(null)}
                className="text-zinc-400 hover:text-white p-1 rounded transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="overflow-y-auto flex-1 px-6 py-4 space-y-2">
              {atletasModal.map((a) => (
                <div
                  key={a.id}
                  className="flex items-center justify-between bg-zinc-800 rounded-lg px-4 py-3"
                >
                  <div>
                    <p className="text-sm font-medium text-white">{a.full_name}</p>
                    <p className="text-xs text-zinc-400">
                      {a.academy ?? "Sem academia"} · {a.belt_color}
                    </p>
                  </div>
                  <span className="text-xs bg-emerald-900/50 text-emerald-400 px-2 py-0.5 rounded-full font-medium">
                    Pago
                  </span>
                </div>
              ))}
            </div>
            <div className="px-6 py-4 border-t border-zinc-800">
              <p className="text-sm text-zinc-400 text-center">
                Total arrecadado neste valor:{" "}
                <span className="text-emerald-400 font-medium">{fmt(modalValor * atletasModal.length)}</span>
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Componentes auxiliares ──────────────────────────────────────────────────

function SummaryCard({
  icon,
  label,
  value,
  sub,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub: string;
  color: string;
}) {
  const borderMap: Record<string, string> = {
    emerald: "border-emerald-500/30",
    red: "border-red-500/30",
    blue: "border-blue-500/30",
    orange: "border-orange-500/30",
    zinc: "border-zinc-600",
  };
  return (
    <div className={`bg-zinc-900 border ${borderMap[color] ?? "border-zinc-800"} rounded-xl p-5`}>
      <div className="flex items-center gap-2 mb-3">
        {icon}
        <span className="text-sm text-zinc-400">{label}</span>
      </div>
      <p className="text-2xl font-bold text-white">{value}</p>
      <p className="text-xs text-zinc-500 mt-1">{sub}</p>
    </div>
  );
}

function InfoCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
      <h3 className="text-sm font-semibold text-zinc-400 mb-3">{title}</h3>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function InfoRow({ label, value, dot }: { label: string; value: string; dot: string }) {
  const dotMap: Record<string, string> = {
    emerald: "bg-emerald-500",
    yellow: "bg-yellow-500",
    zinc: "bg-zinc-500",
    blue: "bg-blue-500",
    purple: "bg-purple-500",
  };
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="flex items-center gap-2 text-zinc-300">
        <span className={`h-1.5 w-1.5 rounded-full ${dotMap[dot] ?? "bg-zinc-500"}`} />
        {label}
      </span>
      <span className="text-white font-medium">{value}</span>
    </div>
  );
}
