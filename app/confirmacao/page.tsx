import { Suspense } from "react";
import { PaymentConfirmationClient } from "@/app/_components/PaymentConfirmationClient";

export default function ConfirmacaoPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-black text-zinc-100">
          Carregando...
        </div>
      }
    >
      <PaymentConfirmationClient />
    </Suspense>
  );
}
