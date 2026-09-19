import { Suspense } from "react";
import ChaveamentoClient from "@/app/_components/admin/ChaveamentoClient";

function LoadingState() {
  return (
    <div className="min-h-screen bg-black text-zinc-100">
      <div className="container mx-auto px-4 py-8">
        <div className="rounded-2xl border border-zinc-900 bg-zinc-950/40 p-8 text-center text-zinc-400">
          Carregando chaveamento...
        </div>
      </div>
    </div>
  );
}

export default function ChaveamentoPage() {
  return (
    <Suspense fallback={<LoadingState />}>
      <ChaveamentoClient />
    </Suspense>
  );
}
