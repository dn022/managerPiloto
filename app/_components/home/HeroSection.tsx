import Link from "next/link";
import { Button } from "../ui/button";

export default function HeroSection() {
  return (
    <section className="mx-auto flex min-h-[70vh] w-full max-w-4xl flex-col items-center justify-center gap-6 px-4 py-20 text-center">
      <h1 className="text-4xl font-semibold text-zinc-50 sm:text-5xl">Gestão esportiva</h1>
      <p className="max-w-xl text-base text-zinc-400 sm:text-lg">
        Alunos, turmas, mensalidades, campeonatos e ranking da sua arena em um só lugar.
      </p>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <Link href="/entrar">
          <Button className="h-12 rounded-xl px-6">Entrar</Button>
        </Link>
      </div>
    </section>
  );
}
