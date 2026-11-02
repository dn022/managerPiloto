import { redirect } from "next/navigation";

import ArenaBackground from "@/app/_components/ArenaBackground";
import { getUser } from "@/app/_lib/session";
import { DEMO_ACCOUNTS } from "@/app/_lib/demo/seed";
import LoginForm from "./LoginForm";

export default async function EntrarPage() {
  if (await getUser()) redirect("/minhas-arenas");

  return (
    <div className="arena-shell flex items-center justify-center px-4">
      <ArenaBackground />
      <div className="arena-content w-full max-w-sm rounded-2xl border border-zinc-800 bg-zinc-900/60 p-8">
        <h1 className="text-2xl font-semibold">Entrar</h1>
        <p className="mb-6 mt-1 text-sm text-zinc-400">Acesse sua arena.</p>
        <LoginForm />
        {process.env.DEMO_MODE === "1" && (
          <div className="mt-6 border-t border-zinc-800 pt-4 text-xs text-zinc-400">
            <p className="mb-2 font-medium text-zinc-300">Modo demo — qualquer senha funciona</p>
            <ul className="space-y-1">
              {DEMO_ACCOUNTS.map((a) => (
                <li key={a.email}>
                  <span className="text-zinc-200">{a.email}</span> · {a.note}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
