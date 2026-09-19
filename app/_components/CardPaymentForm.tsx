"use client";

import * as React from "react";
import { CardPayment, initMercadoPago } from "@mercadopago/sdk-react";

type CardPaymentFormProps = {
  formId: string;
  amount: number;
  onSubmit: (formData: {
    token: string;
    paymentMethodId: string;
    issuerId: string;
    cardholderEmail: string;
    installments: number;
  }) => Promise<void>;
  isLoading?: boolean;
};

const mpInitRef = { current: false };

export function CardPaymentForm({
  formId,
  amount,
  onSubmit,
  isLoading = false,
}: CardPaymentFormProps) {
  const publicKey = process.env.NEXT_PUBLIC_MP_PUBLIC_KEY;

  React.useEffect(() => {
    if (!publicKey) return;
    if (mpInitRef.current) return;
    mpInitRef.current = true;
    initMercadoPago(publicKey);
  }, [publicKey]);

  const handleSubmit = React.useCallback(
    async (param: {
      token: string;
      issuer_id: string;
      payment_method_id: string;
      installments: number;
      payer: { email?: string };
    }) => {
      if (param.installments > 3) {
        throw new Error("Parcelamento permitido apenas até 3x.");
      }
      await onSubmit({
        token: param.token,
        paymentMethodId: param.payment_method_id,
        issuerId: param.issuer_id,
        cardholderEmail: param.payer?.email ?? "",
        installments: param.installments,
      });
    },
    [onSubmit]
  );

  if (!publicKey) {
    return (
      <div className="rounded-xl border border-red-900/50 bg-red-950/40 p-4 text-red-200 text-sm">
        Chave pública do Mercado Pago não configurada. Adicione NEXT_PUBLIC_MP_PUBLIC_KEY no .env.local
      </div>
    );
  }

  return (
    <CardPayment
      id={`${formId}-container`}
      initialization={{ amount }}
      customization={{
        paymentMethods: { maxInstallments: 3 },
        visual: {
          style: { theme: "dark" },
          customVariables: {
            formBackgroundColor: "#18181b",
            baseColor: "#dc2626",
            outlinePrimaryColor: "#52525b",
            inputBackgroundColor: "#09090b",
          },
        },
      }}
      locale="pt-BR"
      onSubmit={handleSubmit}
      onError={(err) => console.error("CardPayment error:", err)}
    />
  );
}