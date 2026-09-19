"use client";

import { isAuthenticated } from "@/app/_lib/auth";
import { useRouter } from "next/navigation";
import { useEffect, useSyncExternalStore } from "react";

interface AdminProtectedProps {
  children: React.ReactNode;
}

export default function AdminProtected({ children }: AdminProtectedProps) {
  const router = useRouter();
  const hydrated = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );
  const authed = hydrated ? isAuthenticated() : false;

  useEffect(() => {
    if (hydrated && !authed) {
      router.replace("/");
    }
  }, [authed, hydrated, router]);

  if (!hydrated || !authed) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-muted-foreground">Verificando autenticacao...</div>
      </div>
    );
  }

  return <>{children}</>;
}
