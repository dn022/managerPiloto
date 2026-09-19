"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Input } from "@/app/_components/ui/input";
import { Button } from "@/app/_components/ui/button";
import { getCategoryLabel } from "@/app/_lib/types";

type Participante = {
  id: string;
  nome: string;
  cpf: string;
  faixa: string;
  categoria?: string | null;
  peso?: number | null;
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

function getPaymentMethodLabel(method: Participante["payment"]["method"]) {
  if (method === "pix") return "PIX";
  if (method === "credit_card") return "Cartão de Crédito";
  return "-";
}

export default function CheckCpfPage() {
  const router = useRouter();

  const [cpf, setCpf] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [participante, setParticipante] = React.useState<Participante | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const normalizedCpf = cpf.replace(/\D/g, "");

  async function handleCheckCpf() {
    setLoading(true);
    setError(null);
    setParticipante(null);

    try {
      const res = await fetch("/api/participantes/by-cpf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cpf: normalizedCpf }),
      });

      if (!res.ok) throw new Error("Erro ao consultar CPF");

      const data: Participante | null = await res.json();

      if (!data?.id) {
        window.location.href = `/inscricao?cpf=${encodeURIComponent(normalizedCpf)}`;
        return;
      }

      setParticipante(data);
    } catch {
      setError("Erro ao consultar CPF.");
    } finally {
      setLoading(false);
    }
  }

  function goToPayment() {
    if (!participante) return;
    router.push(`/cash?id=${encodeURIComponent(participante.id)}`);
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-black px-4 py-10 text-zinc-100">
      <div className="absolute -top-24 left-1/2 h-[520px] w-[520px] -translate-x-1/2 rounded-full bg-red-600/15 blur-3xl" />
      <div className="absolute -bottom-40 right-[-120px] h-[520px] w-[520px] rounded-full bg-red-500/10 blur-3xl" />

      <div className="relative mx-auto w-full max-w-lg">
        <div className="rounded-2xl border border-zinc-800 bg-zinc-950/70 p-6 shadow-sm backdrop-blur">
          {!participante ? (
            <>
              <h1 className="mb-2 text-3xl font-semibold">Verificação de inscrição</h1>
              <p className="mb-6 text-zinc-400">
                Informe o CPF do atleta para localizar a inscrição e seguir para a próxima etapa.
              </p>

              <Input
                placeholder="CPF do atleta"
                value={cpf}
                onChange={(e) => setCpf(e.target.value)}
                className="mb-4 rounded-xl border-zinc-800 bg-black/40"
              />

              {error && (
                <div className="mb-3 rounded-xl border border-red-900/50 bg-red-950/40 px-3 py-2 text-sm text-red-200">
                  {error}
                </div>
              )}

              <Button
                className="h-12 w-full rounded-xl bg-red-600 hover:bg-red-500"
                disabled={loading || normalizedCpf.length !== 11}
                onClick={handleCheckCpf}
              >
                {loading ? "Consultando..." : "Continuar"}
              </Button>
            </>
          ) : (
            <>
              <h2 className="mb-4 text-2xl font-semibold">Dados da inscrição</h2>

              <div className="space-y-2 text-sm text-zinc-300">
                <p>
                  <strong>Nome:</strong> {participante.nome}
                </p>
                <p>
                  <strong>CPF:</strong> {participante.cpf}
                </p>
                <p>
                  <strong>Faixa:</strong> {participante.faixa}
                </p>
                <p>
                  <strong>Categoria:</strong> {getCategoryLabel((participante.categoria as never) ?? null)}
                </p>
                <p>
                  <strong>Peso:</strong> {participante.peso ?? "-"}
                </p>
                <p>
                  <strong>Telefone:</strong> {participante.wpp}
                </p>
                <p>
                  <strong>Modalidades:</strong>{" "}
                  {[
                    participante.mods.gi ? "Gi" : null,
                    participante.mods.nogi ? "NoGi" : null,
                    participante.mods.abs ? "Absoluto" : null,
                    participante.mods.festival ? "Festival" : null,
                  ]
                    .filter(Boolean)
                    .join(", ")}
                </p>
                <p>
                  <strong>Status:</strong> {participante.status === "paid" ? "PAGO" : "PENDENTE"}
                </p>
              </div>

              {participante.status === "paid" ? (
                <>
                  <div className="mt-5 rounded-xl bg-green-900/30 p-3 text-sm text-green-300">
                    Esta inscrição já foi paga e está confirmada.
                  </div>
                  <div className="mt-4 space-y-2 rounded-xl border border-zinc-800 bg-black/30 p-4 text-sm text-zinc-300">
                    <p>
                      <strong>Valor pago:</strong> {formatCurrencyBRL(participante.payment.amount)}
                    </p>
                    <p>
                      <strong>Forma de pagamento:</strong>{" "}
                      {getPaymentMethodLabel(participante.payment.method)}
                    </p>
                  </div>
                </>
              ) : (
                <Button
                  className="mt-6 h-12 w-full rounded-xl bg-red-600 hover:bg-red-500"
                  onClick={goToPayment}
                >
                  Pagar Inscrição
                </Button>
              )}
            </>
          )}

          <div className="mt-6 flex justify-center">
            <Link href="/">
              <Button className="bg-red-600/10 text-white hover:bg-red-600/20">
                Voltar para o início
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
