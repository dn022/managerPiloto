"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import { Button } from "../ui/button";
import {
  BookOpenText,
  ChevronDown,
  GitBranch,
  LockKeyhole,
  MessageCircleIcon,
  Trophy,
} from "lucide-react";

const VIDEOS = [
  "/vid/hero.mp4",
  "/vid/aquecimento.mp4",
  "/vid/evento.mp4",
  "/vid/luta6.mp4",
  "/vid/luta7.mp4",
];

export default function HeroSection() {
  const [currentIndex, setCurrentIndex] = useState(0);

  const handleEnded = useCallback(() => {
    setCurrentIndex((prev) => (prev + 1) % VIDEOS.length);
  }, []);

  return (
    <section
      id="home"
      className="relative flex h-svh w-full items-center justify-center overflow-hidden"
    >
      {/* Vídeo de fundo */}
      <video
        key={currentIndex}
        src={VIDEOS[currentIndex]}
        autoPlay
        muted
        playsInline
        preload="auto"
        onEnded={handleEnded}
        className="absolute inset-0 h-full w-full object-cover"
        aria-hidden="true"
      />

      {/* Camadas de sobreposição */}
      <div className="absolute inset-0 bg-black/55" />
      <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-black/50 to-black" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(220,38,38,0.22),transparent_55%)]" />
      <div className="absolute inset-0 opacity-[0.05] [background-image:radial-gradient(circle_at_1px_1px,white_1px,transparent_1px)] [background-size:24px_24px]" />

      {/* Conteúdo */}
      <div className="relative z-10 mx-auto flex h-full w-full max-w-4xl flex-col items-center justify-center px-5 py-6 text-center text-zinc-100">

        {/* Badge */}
        <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-zinc-700/80 bg-zinc-900/60 px-3 py-1.5 backdrop-blur">
          <Trophy className="h-3.5 w-3.5 text-red-500" />
          <span className="text-xs font-medium text-zinc-200 sm:text-sm">
            Campeonato · Black Belt BJJ
          </span>
          <span className="rounded-full bg-red-500/20 px-2 py-0.5 text-[10px] font-semibold text-red-300 sm:text-xs">
            2026
          </span>
        </div>

        {/* Título */}
        <h1 className="mb-3 text-2xl font-extrabold leading-tight tracking-tight drop-shadow-2xl sm:text-4xl md:text-5xl">
          Onde a disciplina encontra{" "}<br/>
          <span className="text-red-500">o desafio</span>
          {" "}e cada atleta entra para{" "}
          <span className="text-red-400">marcar seu nome.</span>
        </h1>

        {/* Subtítulo */}
        <p className="mx-auto mb-4 hidden max-w-xl text-sm leading-6 text-zinc-300 drop-shadow sm:block sm:text-base md:text-lg">
          Este campeonato reúne competição, respeito e superação em um
          ambiente que valoriza o atleta do aquecimento ao pódium.
        </p>

        {/* CTAs principais */}
        <div className="mb-3 flex w-full flex-col items-center justify-center gap-2 sm:flex-row sm:gap-3">
          <div className="relative w-full sm:w-auto">
            <span className="absolute inset-0 animate-ping rounded-xl bg-red-500 opacity-40 [animation-duration:1.5s]" />
            <Button
              asChild
              className="relative h-11 w-full rounded-xl bg-red-600 px-7 text-sm font-bold text-white shadow-[0_14px_34px_rgba(220,38,38,0.45)] transition-all hover:-translate-y-0.5 hover:bg-red-500 sm:w-auto sm:px-8"
            >
              <Link href="/inscricao/cpf">INSCRIÇÃO</Link>
            </Button>
          </div>

          <Button
            asChild
            variant="outline"
            className="h-11 w-full rounded-xl border-emerald-400/50 bg-emerald-600/90 px-7 text-sm font-semibold text-white transition-all hover:-translate-y-0.5 hover:bg-emerald-500 hover:text-white sm:w-auto sm:px-8"
          >
            <Link href="https://wa.me/5522999809455" target="_blank">
              <MessageCircleIcon className="h-4 w-4" />
              Contate a Organização
            </Link>
          </Button>
        </div>

        {/* Links secundários — desktop */}
        <div className="mb-4 hidden flex-wrap items-center justify-center gap-2 sm:flex">
          <Link
            href="/edital_novo.pdf"
            target="_blank"
            className="inline-flex items-center gap-1.5 rounded-full border border-zinc-700 bg-black/40 px-3.5 py-1.5 text-xs text-zinc-300 backdrop-blur transition-all hover:border-zinc-500 hover:text-white"
          >
            <BookOpenText className="h-3 w-3" />
            Edital
          </Link>
          <Link
            href="/chaveamento"
            className="inline-flex items-center gap-1.5 rounded-full border border-zinc-700 bg-black/40 px-3.5 py-1.5 text-xs text-zinc-300 backdrop-blur transition-all hover:border-zinc-500 hover:text-white"
          >
            <GitBranch className="h-3 w-3" />
            Chaveamento
          </Link>
          <Link
            href="/login"
            className="inline-flex items-center gap-1.5 rounded-full border border-zinc-700 bg-black/40 px-3.5 py-1.5 text-xs text-zinc-300 backdrop-blur transition-all hover:border-zinc-500 hover:text-white"
          >
            <LockKeyhole className="h-3 w-3" />
            Área Admin
          </Link>
        </div>

        {/* Links secundários — mobile compacto */}
        <div className="mb-3 flex items-center justify-center gap-3 sm:hidden">
          <Link href="/edital_junho.pdf" target="_blank" className="text-xs text-zinc-400 hover:text-zinc-200">Edital</Link>
          <span className="text-zinc-700">·</span>
          <Link href="/chaveamento" className="text-xs text-zinc-400 hover:text-zinc-200">Chaveamento</Link>
          <span className="text-zinc-700">·</span>
          <Link href="/login" className="text-xs text-zinc-400 hover:text-zinc-200">Admin</Link>
        </div>

        {/* Cards de status */}
        <div className="mb-3 flex items-center justify-center gap-3">
          <div className="rounded-xl border border-white/10 bg-black/50 px-4 py-2 backdrop-blur-sm">
            <div className="text-[9px] uppercase tracking-[0.2em] text-zinc-400">Edição</div>
            <div className="mt-0.5 text-sm font-bold text-white sm:text-base">06 · 2026</div>
          </div>
          <div className="rounded-xl border border-white/10 bg-black/50 px-4 py-2 backdrop-blur-sm">
            <div className="text-[9px] uppercase tracking-[0.2em] text-zinc-400">Status</div>
            <div className="mt-0.5 text-sm font-bold text-white sm:text-base">Inscrições Abertas</div>
          </div>
        </div>

        {/* Indicador de vídeos */}
        <div className="flex items-center justify-center gap-2">
          {VIDEOS.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setCurrentIndex(i)}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                i === currentIndex ? "w-6 bg-red-500" : "w-1.5 bg-zinc-600 hover:bg-zinc-400"
              }`}
              aria-label={`Vídeo ${i + 1}`}
            />
          ))}
        </div>
      </div>

      {/* Seta de scroll */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 animate-bounce text-zinc-500">
        <ChevronDown className="h-5 w-5" />
      </div>
    </section>
  );
}
