"use client";

import { isFinanceiroAuthenticated } from "@/app/_lib/authFinanceiro";
import { useRouter } from "next/navigation";
import { useEffect, useSyncExternalStore } from "react";

interface FinanceiroProtectedProps {
  children: React.ReactNode;
}

export default function FinanceiroProtected({ children }: FinanceiroProtectedProps) {
  const router = useRouter();
  const hydrated = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );
  const authed = hydrated ? isFinanceiroAuthenticated() : false;

  useEffect(() => {
    if (hydrated && !authed) {
      router.replace("/financeiro/login");
    }
  }, [authed, hydrated, router]);

  if (!hydrated || !authed) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black">
        <div className="text-zinc-400">Verificando autenticação...</div>
      </div>
    );
  }

  return <>{children}</>;
}
