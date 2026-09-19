"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { getCategoryLabel } from "@/app/_lib/types";
import { Button } from "@/app/_components/ui/button";

type ConfirmationData = {
  id: string;
  nome: string;
  cpf: string;
  faixa: string;
  categoria: string | null;
  peso: number | null;
  wpp: string;
  valor: number;
  mods: { gi: boolean; nogi: boolean; abs: boolean; festival: boolean };
  payment: {
    status: string | null;
    method: "pix" | "credit_card" | null;
    amount: number | null;
    createdAt: string | null;
  };
  status: "paid" | "pending";
};

function formatCurrencyBRL(value: number | null | undefined) {
  return (value ?? 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function getPaymentMethodLabel(method: ConfirmationData["payment"]["method"]) {
  if (method === "pix") return "PIX";
  if (method === "credit_card") return "Cartão de Crédito";
  return "-";
}

export function PaymentConfirmationClient() {
  const searchParams = useSearchParams();
  const id = searchParams.get("id");
  const [data, setData] = React.useState<ConfirmationData | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!id) {
      setError("Inscrição não encontrada.");
      setLoading(false);
      return;
    }

    (async () => {
      try {
        const res = await fetch(`/api/cash?id=${encodeURIComponent(id)}`);
        const json = await res.json();

        if (!res.ok) {
          throw new Error(json?.error ?? "Erro ao carregar confirmação");
        }

        setData(json);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erro ao carregar confirmação");
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  const modalidades = React.useMemo(() => {
    if (!data) return "-";

    return [
      data.mods.gi ? "Gi" : null,
      data.mods.nogi ? "NoGi" : null,
      data.mods.abs ? "Absoluto" : null,
      data.mods.festival ? "Festival" : null,
    ]
      .filter(Boolean)
      .join(", ");
  }, [data]);

  return (
    <div className="relative min-h-screen overflow-hidden bg-black px-4 py-10 text-zinc-100">
      <div className="absolute -top-24 left-1/2 h-[520px] w-[520px] -translate-x-1/2 rounded-full bg-red-600/15 blur-3xl" />
      <div className="absolute -bottom-40 right-[-120px] h-[520px] w-[520px] rounded-full bg-red-500/10 blur-3xl" />

      <div className="relative mx-auto w-full max-w-3xl">
        <div className="rounded-2xl border border-zinc-800 bg-zinc-950/70 p-6 shadow-sm backdrop-blur sm:p-8">
          <div className="mb-6">
            <h1 className="text-3xl font-semibold text-white">Pagamento confirmado</h1>
            <p className="mt-2 text-zinc-400">
              Sua inscrição foi localizada com sucesso. Confira abaixo todos os dados
              registrados.
            </p>
          </div>

          {loading && (
            <div className="rounded-xl border border-zinc-800 bg-black/30 p-4 text-zinc-300">
              Carregando confirmação...
            </div>
          )}

          {error && (
            <div className="rounded-xl border border-red-900/50 bg-red-950/40 p-4 text-red-200">
              {error}
            </div>
          )}

          {data && (
            <div className="space-y-6">
              <div className="rounded-2xl border border-green-700/40 bg-green-950/20 p-4 text-green-200">
                Pagamento aprovado e inscrição confirmada.
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-2xl border border-zinc-800 bg-black/30 p-4">
                  <div className="text-sm text-zinc-400">Nome</div>
                  <div className="mt-1 text-lg font-semibold text-white">{data.nome}</div>
                </div>
                <div className="rounded-2xl border border-zinc-800 bg-black/30 p-4">
                  <div className="text-sm text-zinc-400">CPF</div>
                  <div className="mt-1 text-lg font-semibold text-white">{data.cpf}</div>
                </div>
                <div className="rounded-2xl border border-zinc-800 bg-black/30 p-4">
                  <div className="text-sm text-zinc-400">Faixa</div>
                  <div className="mt-1 text-lg font-semibold text-white">{data.faixa}</div>
                </div>
                <div className="rounded-2xl border border-zinc-800 bg-black/30 p-4">
                  <div className="text-sm text-zinc-400">Categoria</div>
                  <div className="mt-1 text-lg font-semibold text-white">
                    {getCategoryLabel(data.categoria)}
                  </div>
                </div>
                <div className="rounded-2xl border border-zinc-800 bg-black/30 p-4">
                  <div className="text-sm text-zinc-400">Peso</div>
                  <div className="mt-1 text-lg font-semibold text-white">
                    {data.peso ?? "-"}
                  </div>
                </div>
                <div className="rounded-2xl border border-zinc-800 bg-black/30 p-4">
                  <div className="text-sm text-zinc-400">Telefone</div>
                  <div className="mt-1 text-lg font-semibold text-white">{data.wpp}</div>
                </div>
                <div className="rounded-2xl border border-zinc-800 bg-black/30 p-4 md:col-span-2">
                  <div className="text-sm text-zinc-400">Modalidades</div>
                  <div className="mt-1 text-lg font-semibold text-white">{modalidades || "-"}</div>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <div className="rounded-2xl border border-zinc-800 bg-black/30 p-4">
                  <div className="text-sm text-zinc-400">Valor da inscrição</div>
                  <div className="mt-1 text-lg font-semibold text-white">
                    {formatCurrencyBRL(data.valor)}
                  </div>
                </div>
                <div className="rounded-2xl border border-zinc-800 bg-black/30 p-4">
                  <div className="text-sm text-zinc-400">Valor pago</div>
                  <div className="mt-1 text-lg font-semibold text-white">
                    {formatCurrencyBRL(data.payment.amount)}
                  </div>
                </div>
                <div className="rounded-2xl border border-zinc-800 bg-black/30 p-4">
                  <div className="text-sm text-zinc-400">Forma de pagamento</div>
                  <div className="mt-1 text-lg font-semibold text-white">
                    {getPaymentMethodLabel(data.payment.method)}
                  </div>
                </div>
              </div>

              <div className="flex justify-center pt-2">
                <Link href="/">
                  <Button className="rounded-xl bg-red-600 px-8 hover:bg-red-500">
                    Voltar para a pagina principal
                  </Button>
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
