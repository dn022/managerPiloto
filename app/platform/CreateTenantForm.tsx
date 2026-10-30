"use client";

import { useActionState } from "react";

import { Button } from "@/app/_components/ui/button";
import { Input } from "@/app/_components/ui/input";
import { createTenant } from "@/app/_lib/actions/platform";

export default function CreateTenantForm({ plans }: { plans: { code: string; name: string }[] }) {
  const [state, action, pending] = useActionState(createTenant, { error: null });

  return (
    <form action={action} className="space-y-3">
      <Input name="name" placeholder="Nome da arena" required />
      <Input name="slug" placeholder="slug (ex.: arena-praia-sul)" required />
      <Input
        name="owner_email"
        type="email"
        placeholder="E-mail do proprietário (já cadastrado)"
        required
      />
      <select
        name="plan"
        defaultValue="completo"
        className="h-10 w-full rounded-md border border-zinc-800 bg-black/40 px-3 text-sm"
      >
        {plans.map((p) => (
          <option key={p.code} value={p.code}>
            {p.name}
          </option>
        ))}
      </select>
      {state.error && <p className="text-sm text-red-300">{state.error}</p>}
      {state.ok && <p className="text-sm text-emerald-300">Arena criada.</p>}
      <Button type="submit" disabled={pending}>
        {pending ? "Criando..." : "Criar arena"}
      </Button>
    </form>
  );
}
