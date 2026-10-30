"use client";

import { useActionState } from "react";

import { Button } from "@/app/_components/ui/button";
import { Input } from "@/app/_components/ui/input";
import { signIn } from "@/app/_lib/actions/authSession";

export default function LoginForm() {
  const [state, action, pending] = useActionState(signIn, { error: null });

  return (
    <form action={action} className="space-y-4">
      <Input name="email" type="email" placeholder="E-mail" autoComplete="email" required />
      <Input
        name="password"
        type="password"
        placeholder="Senha"
        autoComplete="current-password"
        required
      />
      {state.error && (
        <div className="rounded-xl border border-red-900/50 bg-red-950/40 px-3 py-2 text-sm text-red-200">
          {state.error}
        </div>
      )}
      <Button type="submit" disabled={pending} className="h-12 w-full rounded-xl">
        {pending ? "Entrando..." : "Entrar"}
      </Button>
    </form>
  );
}
