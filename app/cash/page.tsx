import { Suspense } from "react";
import CashClient from "@/app/_components/CashClient";

export default function CashPage() {
  return (
    <Suspense fallback={<div className="text-zinc-400">Carregando...</div>}>
      <CashClient />
    </Suspense>
  );
}
