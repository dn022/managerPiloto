"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";

import { Button } from "@/app/_components/ui/button";
import { Input } from "@/app/_components/ui/input";
import { Label } from "@/app/_components/ui/label";
import { ArrowLeft, DollarSign } from "lucide-react";
import Image from "next/image";

export default function FinanceiroLogin() {
  const router = useRouter();
  const [password, setPassword] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const res = await fetch("/api/financeiro/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      setError(data?.error ?? "Senha inválida.");
      setLoading(false);
      return;
    }

    router.push("/financeiro");
  }

  return (
    <div className="min-h-screen bg-black text-zinc-100 flex items-center justify-center px-4 py-10 relative overflow-hidden">
      <div className="absolute -top-24 left-1/2 h-[520px] w-[520px] -translate-x-1/2 rounded-full bg-emerald-600/15 blur-3xl" />
      <div className="absolute -bottom-40 right-[-120px] h-[520px] w-[520px] rounded-full bg-emerald-500/10 blur-3xl" />

      <div className="relative w-full max-w-md">
        <Link
          className="inline-flex items-center gap-2 text-lg text-zinc-400 hover:text-zinc-100 mb-8 transition-colors"
          href="/"
        >
          <ArrowLeft className="h-5 w-5" />
          Voltar para o início
        </Link>

        <div className="bg-card border border-border rounded-2xl shadow-sm p-8">
          <div className="mb-6 text-center">
            <div className="mx-auto p-3 rounded-xl w-fit mb-4">
              <Image alt="logo" src="/logo-black-belt-jj.png" width={250} height={100} quality={100} />
            </div>

            <div className="flex items-center justify-center gap-2 mb-2">
              <DollarSign className="h-6 w-6 text-emerald-500" />
              <h3 className="text-2xl font-semibold text-black">
                Área Financeira
              </h3>
            </div>
            <p className="text-lg text-zinc-400 mt-1">
              Digite a senha para acessar o painel financeiro
            </p>
          </div>

          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-2 mb-2">
              <Label className="text-xl text-black" htmlFor="password">
                Senha
              </Label>
              <Input
                id="password"
                type="password"
                placeholder="Digite a senha"
                className="rounded-xl bg-white border-zinc-800 text-black placeholder:text-zinc-500 focus-visible:ring-emerald-500/30"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            {error && (
              <div className="rounded-xl border border-red-900/50 bg-red-950/30 px-3 py-2 text-sm text-red-300">
                {error}
              </div>
            )}

            <Button
              className="cursor-pointer text-lg w-full rounded-xl h-12 bg-emerald-600 hover:bg-emerald-500"
              type="submit"
              disabled={loading}
            >
              {loading ? "Entrando..." : "Entrar"}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
