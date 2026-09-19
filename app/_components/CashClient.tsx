"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button } from "../_components/ui/button";
import { CardPaymentForm } from "../_components/CardPaymentForm";

type PaymentMethod = "pix" | "card" | null;

type CashData = {
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
  pix?: {
    qrCodeBase64: string | null;
    pixCopyPaste: string | null;
    status: "pending" | "approved";
  };
};

export default function CashClient() {
  const sp = useSearchParams();
  const id = sp.get("id");
  const router = useRouter();

  const [data, setData] = React.useState<CashData | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = React.useState<PaymentMethod>(null);
  const [cardPaymentLoading, setCardPaymentLoading] = React.useState(false);
  const pixRequestedRef = React.useRef(false);

  React.useEffect(() => {
    if (!id) return;
    if (data?.payment?.status === "approved" || data?.pix?.status === "approved") {
      router.replace(`/confirmacao?id=${encodeURIComponent(id)}`);
    }
  }, [data, id, router]);

  React.useEffect(() => {
    if (!id || !data) return;
    if (data.pix?.status === "approved") return;
    if (paymentMethod !== "pix") return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/payments/status?registrationId=${encodeURIComponent(id)}`);
        if (!res.ok) return;

        const json = await res.json();
        if (json.status === "approved") {
          setData((prev) =>
            prev && prev.pix
              ? {
                  ...prev,
                  payment: {
                    ...prev.payment,
                    status: "approved",
                    method: "pix",
                    amount: prev.valor,
                  },
                  pix: {
                    ...prev.pix,
                    status: "approved",
                  },
                }
              : prev
          );
        }
      } catch {
        // sem ruido no polling
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [id, data, paymentMethod]);

  React.useEffect(() => {
    if (!id) {
      setError("Inscrição não encontrada. Volte e faça a inscrição novamente.");
      setLoading(false);
      return;
    }

    (async () => {
      try {
        const res = await fetch(`/api/cash?id=${encodeURIComponent(id)}`);
        const json = await res.json();
        if (!res.ok) throw new Error(json?.error ?? "Erro ao carregar pagamento");
        setData(json);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Erro ao carregar pagamento");
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  React.useEffect(() => {
    if (!id || !data || paymentMethod !== "pix") return;
    if (data.pix) return;

    if (pixRequestedRef.current) return;
    pixRequestedRef.current = true;

    (async () => {
      try {
        const res = await fetch("/api/payments/pix", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ registrationId: id }),
        });

        const json = await res.json().catch(() => ({}));

        if (!res.ok) {
          pixRequestedRef.current = false;
          setError(json?.error ?? "Não foi possível gerar o PIX. Tente novamente.");
          return;
        }

        setData((prev) =>
          prev
            ? {
                ...prev,
                payment: {
                  ...prev.payment,
                  status: json.status ?? "pending",
                  method: "pix",
                  amount: prev.valor,
                },
                pix: {
                  pixCopyPaste: json.pixCopyPaste ?? null,
                  qrCodeBase64: json.qrCodeBase64 ?? null,
                  status: json.status ?? "pending",
                },
              }
            : prev
        );
      } catch {
        pixRequestedRef.current = false;
        setError("Não foi possível gerar o PIX. Verifique sua conexão e tente novamente.");
      }
    })();
  }, [id, data, paymentMethod]);

  const handleCardSubmit = React.useCallback(
    async (formData: {
      token: string;
      paymentMethodId: string;
      issuerId: string;
      cardholderEmail: string;
      installments: number;
    }) => {
      if (!id) return;
      setCardPaymentLoading(true);
      try {
        const res = await fetch("/api/payments/card", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            registrationId: id,
            token: formData.token,
            paymentMethodId: formData.paymentMethodId,
            issuerId: formData.issuerId,
            email: formData.cardholderEmail,
            installments: formData.installments,
          }),
        });
        const result = await res.json();
        if (result.status === "approved") {
          router.push(`/confirmacao?id=${id}`);
        } else {
          alert(result?.error ?? "Erro no pagamento. Tente novamente.");
        }
      } catch {
        alert("Erro no pagamento. Tente novamente.");
      } finally {
        setCardPaymentLoading(false);
      }
    },
    [id, router]
  );

  const valorFormatado = React.useMemo(() => {
    if (!data) return "";
    return data.valor.toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    });
  }, [data]);

  const modalidadesLabel = React.useMemo(() => {
    if (!data) return "";
    const arr = [
      data.mods.gi ? "Gi" : null,
      data.mods.nogi ? "NoGi" : null,
      data.mods.abs ? "Absoluto" : null,
      data.mods.festival ? "Festival" : null,
    ].filter(Boolean);
    return arr.join(", ");
  }, [data]);

  return (
    <div className="relative min-h-screen overflow-hidden bg-black py-10 text-zinc-100 md:py-16">
      <div className="absolute -top-24 left-1/2 h-[520px] w-[520px] -translate-x-1/2 rounded-full bg-red-600/15 blur-3xl" />
      <div className="absolute -bottom-40 right-[-120px] h-[520px] w-[520px] rounded-full bg-red-500/10 blur-3xl" />

      <div className="relative bg-black py-4 text-zinc-100 md:py-8">
        <div className="container mx-auto px-4">
          <div className="mx-auto max-w-xl gap-3">
            <h1 className="mb-2 text-2xl font-bold md:text-3xl">Pagamento da Inscricao</h1>
            <p className="mb-3 text-zinc-400">
              Finalize o pagamento para confirmar sua participacao.
            </p>

            {loading && (
              <div className="mt-6 rounded-2xl border border-zinc-800 bg-zinc-950/70 p-6">
                Carregando...
              </div>
            )}

            {error && (
              <div className="mt-6 rounded-2xl border border-red-900/50 bg-red-950/40 p-6 text-red-200">
                {error}
              </div>
            )}

            {data && (
              <div className="mt-6 space-y-6">
                <div className="rounded-2xl border border-zinc-800 bg-zinc-950/70 p-6">
                  <div className="text-sm text-zinc-400">Atleta</div>
                  <div className="text-lg font-semibold">{data.nome}</div>
                  <div className="text-sm text-zinc-400">{data.wpp}</div>
                  <div className="mt-3 text-sm text-zinc-400">
                    Modalidades: <span className="text-zinc-200">{modalidadesLabel || "-"}</span>
                  </div>
                </div>

                <div className="rounded-2xl border border-zinc-800 bg-zinc-950/70 p-6">
                  <div className="flex justify-between">
                    <span className="text-sm text-zinc-400">Valor:</span>
                    <span className="text-lg font-semibold">{valorFormatado}</span>
                  </div>

                  {!paymentMethod ? (
                    <div className="mt-4 space-y-3 border-t border-zinc-800 pt-4">
                      <p className="text-sm text-zinc-400">Escolha a forma de pagamento:</p>
                      <div className="flex flex-col gap-3 sm:flex-row">
                        <Button
                          className="h-12 flex-1 rounded-xl bg-red-600 hover:bg-red-500"
                          onClick={() => setPaymentMethod("pix")}
                        >
                          PIX
                        </Button>
                        <Button
                          className="h-12 flex-1 rounded-xl bg-zinc-800 text-white hover:bg-zinc-700"
                          onClick={() => setPaymentMethod("card")}
                        >
                          Cartão de Crédito
                        </Button>
                      </div>
                    </div>
                  ) : paymentMethod === "pix" ? (
                    <div className="mt-4 space-y-4 border-t border-zinc-800 pt-4">
                      <div className="flex items-center justify-between">
                        <button
                          type="button"
                          className="inline-flex items-center gap-2 text-sm text-zinc-500 hover:text-zinc-300"
                          onClick={() => setPaymentMethod(null)}
                        >
                          <ArrowLeft className="h-4 w-4 shrink-0" aria-hidden />
                          Trocar forma de pagamento
                        </button>
                      </div>
                      <div className="flex justify-center">
                        {data.pix?.qrCodeBase64 ? (
                          <Image
                            src={`data:image/png;base64,${data.pix.qrCodeBase64}`}
                            alt="QR Code PIX"
                            width={208}
                            height={208}
                            className="rounded-xl bg-white p-2"
                          />
                        ) : (
                          <div className="flex h-52 w-52 items-center justify-center rounded-xl border border-zinc-800 bg-zinc-900 p-4 text-center text-sm text-zinc-500">
                            Aguardando QR Code...
                          </div>
                        )}
                      </div>

                      <div className="flex flex-col gap-2">
                        <span className="mb-2 block text-sm text-zinc-400">PIX Copia e Cola</span>
                        <div className="flex flex-col gap-2 md:flex-row">
                          <code className="w-full min-w-0 break-all rounded-lg border border-zinc-800 bg-black/40 px-3 py-2 text-sm font-mono">
                            <input
                              type="text"
                              value={data.pix?.pixCopyPaste ?? ""}
                              readOnly
                              className="w-full bg-transparent"
                            />
                          </code>
                          <Button
                            className="flex w-full items-center justify-center bg-red-600 hover:bg-black md:w-auto"
                            onClick={() =>
                              data.pix?.pixCopyPaste &&
                              navigator.clipboard.writeText(data.pix.pixCopyPaste)
                            }
                            disabled={!data.pix?.pixCopyPaste}
                          >
                            Copiar
                          </Button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-4 space-y-4 border-t border-zinc-800 pt-4">
                      <div className="flex items-center justify-between">
                        <button
                          type="button"
                          className="inline-flex items-center gap-2 text-sm text-zinc-500 hover:text-zinc-300"
                          onClick={() => setPaymentMethod(null)}
                        >
                          <ArrowLeft className="h-4 w-4 shrink-0" aria-hidden />
                          Trocar forma de pagamento
                        </button>
                      </div>
                      <CardPaymentForm
                        formId="card-form-cash"
                        amount={data.valor}
                        onSubmit={handleCardSubmit}
                        isLoading={cardPaymentLoading}
                      />
                    </div>
                  )}
                </div>

                <div className="rounded-xl border border-zinc-800 bg-black/40 p-4">
                  <p className="text-center text-sm text-zinc-200">
                    Após a confirmação do pagamento, sua inscrição será concluída e a
                    página de confirmação será exibida automaticamente.
                  </p>
                </div>

                <div className="flex items-center justify-center">
                  <Link href="/">
                    <Button className="mb-8 inline-flex items-center gap-2 bg-red-600/10 text-sm text-white transition-colors hover:text-zinc-100">
                      Voltar para o início
                    </Button>
                  </Link>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
