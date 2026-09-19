"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Menu } from "lucide-react";

import { logout } from "@/app/_lib/auth";
import { Button } from "@/app/_components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/app/_components/ui/dropdown-menu";
import { Input } from "@/app/_components/ui/input";

const MAIN_SCORES = [
  { points: 2, description: "Queda | Raspagem | Joelho na Barriga" },
  { points: 3, description: "Passagem de Guarda" },
  { points: 4, description: "Montada | Pegada nas Costas" },
];

type ScoreCardProps = {
  title: string;
  theme: "red" | "blue";
  name: string;
  score: number;
  vantagemCount: number;
  punicaoCount: number;
  onNameChange: (value: string) => void;
  onAddMainScore: (points: number) => void;
  onAdjustVantagem: (delta: number) => void;
  onAdjustPunicao: (delta: number) => void;
};

function ScoreCard({
  title,
  theme,
  name,
  score,
  vantagemCount,
  punicaoCount,
  onNameChange,
  onAddMainScore,
  onAdjustVantagem,
  onAdjustPunicao,
}: ScoreCardProps) {
  const themedCardClass =
    theme === "red"
      ? "border-red-900/40 bg-red-950/20"
      : "border-blue-900/40 bg-blue-950/20";

  const themedScoreClass =
    theme === "red"
      ? "border-red-800/50 bg-red-950/35"
      : "border-blue-800/50 bg-blue-950/35";

  const themedTitleClass = theme === "red" ? "text-red-300" : "text-blue-300";

  return (
    <section className={`rounded-2xl border p-4 md:p-6 ${themedCardClass}`}>
      <div className="mb-4">
        <p className={`text-xs uppercase tracking-[0.24em] ${themedTitleClass}`}>{title}</p>
        <Input
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
          placeholder={`Nome do ${title.toLowerCase()}`}
          className="mt-2 h-10 border-zinc-800 bg-black/40 text-zinc-100 placeholder:text-zinc-500"
        />
      </div>

      <div className={`relative mb-4 min-h-[220px] rounded-2xl border p-4 ${themedScoreClass}`}>
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          <div className="text-[11px] uppercase tracking-[0.18em] text-zinc-400">Pontos</div>
          <div className="text-[73px] font-semibold leading-none text-white md:text-[97px]">{score}</div>
        </div>

        <div className="absolute right-3 top-3 space-y-2">
          <div className="min-w-[98px] rounded-lg border border-zinc-700/70 bg-black/35 px-3 py-2 text-center">
            <div className="text-xs uppercase tracking-[0.14em] text-zinc-400">Vantagem</div>
            <div className="relative top-[1px] text-[34px] font-semibold leading-none text-zinc-100">
              {vantagemCount}
            </div>
          </div>
          <div className="min-w-[98px] rounded-lg border border-zinc-700/70 bg-black/35 px-3 py-2 text-center">
            <div className="text-xs uppercase tracking-[0.14em] text-zinc-400">Punição</div>
            <div className="relative top-[1px] text-[34px] font-semibold leading-none text-zinc-100">
              {punicaoCount}
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-zinc-800 bg-black/30 p-2">
        <div className="grid grid-cols-3 gap-2">
          {MAIN_SCORES.map((action) => (
            <Button
              key={`${title}-${action.points}`}
              type="button"
              variant="outline"
              onClick={() => onAddMainScore(action.points)}
              className="h-16 cursor-pointer flex-col border-zinc-700 bg-zinc-950 px-1 text-zinc-100 hover:bg-white hover:text-black"
            >
              <span className="text-2xl font-semibold leading-none">+{action.points}</span>
              <span className="text-[10px] uppercase tracking-[0.12em]">Pontos</span>
            </Button>
          ))}
        </div>

        <div className="mt-2 grid grid-cols-3 gap-2 text-center">
          {MAIN_SCORES.map((action) => (
            <p key={`${title}-${action.points}-desc`} className="text-[10px] leading-tight text-zinc-400">
              {action.description}
            </p>
          ))}
        </div>

        <div className="mt-2 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm text-zinc-200">Vantagem ({vantagemCount})</span>
            <div className="flex gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => onAdjustVantagem(1)}
                className="h-8 cursor-pointer border-zinc-700 bg-zinc-950 px-3 text-zinc-100 hover:bg-white hover:text-black"
              >
                +1
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => onAdjustVantagem(-1)}
                className="h-8 cursor-pointer border-zinc-700 bg-zinc-950 px-3 text-zinc-100 hover:bg-white hover:text-black"
              >
                -1
              </Button>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-sm text-zinc-200">Punição ({punicaoCount})</span>
            <div className="flex gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => onAdjustPunicao(1)}
                className="h-8 cursor-pointer border-zinc-700 bg-zinc-950 px-3 text-zinc-100 hover:bg-white hover:text-black"
              >
                +1
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => onAdjustPunicao(-1)}
                className="h-8 cursor-pointer border-zinc-700 bg-zinc-950 px-3 text-zinc-100 hover:bg-white hover:text-black"
              >
                -1
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-2 rounded-xl border border-zinc-800 bg-black/30 p-2 text-xs text-zinc-400">
        Vantagem e punição contam apenas para desempate.
      </div>
    </section>
  );
}

function formatTime(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export default function CronometroClient() {
  const router = useRouter();

  const [durationMinutes, setDurationMinutes] = React.useState<number>(5);
  const [remainingSeconds, setRemainingSeconds] = React.useState<number>(5 * 60);
  const [running, setRunning] = React.useState(false);

  const [athleteAName, setAthleteAName] = React.useState("");
  const [athleteBName, setAthleteBName] = React.useState("");
  const [athleteAScore, setAthleteAScore] = React.useState(0);
  const [athleteBScore, setAthleteBScore] = React.useState(0);
  const [athleteAVantagens, setAthleteAVantagens] = React.useState(0);
  const [athleteBVantagens, setAthleteBVantagens] = React.useState(0);
  const [athleteAPunicoes, setAthleteAPunicoes] = React.useState(0);
  const [athleteBPunicoes, setAthleteBPunicoes] = React.useState(0);

  React.useEffect(() => {
    if (!running) return;

    const interval = window.setInterval(() => {
      setRemainingSeconds((current) => {
        if (current <= 1) {
          window.clearInterval(interval);
          setRunning(false);
          return 0;
        }

        return current - 1;
      });
    }, 1000);

    return () => window.clearInterval(interval);
  }, [running]);

  function handleLogout() {
    logout();
    router.push("/");
  }

  function handleDurationChange(value: string) {
    const nextDuration = Number(value);
    if (!Number.isFinite(nextDuration) || nextDuration < 1 || nextDuration > 10) return;

    setDurationMinutes(nextDuration);
    setRemainingSeconds(nextDuration * 60);
    setRunning(false);
  }

  function handleToggleTimer() {
    if (remainingSeconds === 0) {
      setRemainingSeconds(durationMinutes * 60);
      setRunning(true);
      return;
    }

    setRunning((current) => !current);
  }

  function handleResetTimer() {
    setRunning(false);
    setRemainingSeconds(durationMinutes * 60);
  }

  function handleResetScoreboard() {
    setAthleteAScore(0);
    setAthleteBScore(0);
    setAthleteAVantagens(0);
    setAthleteBVantagens(0);
    setAthleteAPunicoes(0);
    setAthleteBPunicoes(0);
  }

  function handleResetAll() {
    handleResetTimer();
    handleResetScoreboard();
  }

  return (
    <div className="min-h-screen bg-black text-zinc-100">
      <header className="sticky top-0 z-10 border-b border-zinc-900 bg-black/80 backdrop-blur">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h1 className="text-xl font-semibold">Cronômetro</h1>
              <p className="text-sm text-zinc-400">Controle de tempo e pontuação da luta</p>
            </div>

            <div className="hidden items-center gap-3 md:flex">
              <Button
                asChild
                variant="outline"
                className="h-8 rounded-xl border-zinc-800 bg-zinc-950/40 hover:bg-white"
              >
                <Link href="/admin/painel">Painel</Link>
              </Button>

              <Button
                asChild
                variant="outline"
                className="h-8 rounded-xl border-zinc-800 bg-zinc-950/40 hover:bg-white"
              >
                <Link href="/admin/categorias">Categorias</Link>
              </Button>

              <Button
                asChild
                variant="outline"
                className="h-8 rounded-xl border-zinc-800 bg-zinc-950/40 hover:bg-white"
              >
                <Link href="/admin/chaveamento">Chaveamento</Link>
              </Button>

              <Button
                asChild
                variant="outline"
                className="h-8 rounded-xl border-zinc-800 bg-zinc-950/40 hover:bg-white"
              >
                <Link href="/admin/cashback">Cashback</Link>
              </Button>

              <Button
                asChild
                variant="outline"
                className="h-8 rounded-xl border-zinc-200 bg-white text-black hover:bg-zinc-200"
              >
                <Link href="/admin/cronometro">Cronometro</Link>
              </Button>

              <Button
                variant="ghost"
                className="cursor-pointer h-9 rounded-xl px-3 text-zinc-300 hover:bg-zinc-900 hover:text-red-700"
                type="button"
                onClick={handleLogout}
              >
                Sair
              </Button>
            </div>

            <div className="md:hidden">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    className="cursor-pointer h-9 w-9 rounded-xl p-0 text-zinc-300 hover:bg-zinc-900 hover:text-zinc-100"
                  >
                    <Menu className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="end"
                  className="border-zinc-800 bg-zinc-950 text-zinc-100"
                >
                  <Link href="/admin/painel">
                    <DropdownMenuItem className="cursor-pointer data-highlighted:bg-white">
                      Painel
                    </DropdownMenuItem>
                  </Link>
                  <Link href="/admin/categorias">
                    <DropdownMenuItem className="cursor-pointer data-highlighted:bg-white">
                      Categorias
                    </DropdownMenuItem>
                  </Link>
                  <Link href="/admin/chaveamento">
                    <DropdownMenuItem className="cursor-pointer data-highlighted:bg-white">
                      Chaveamento
                    </DropdownMenuItem>
                  </Link>
                  <Link href="/admin/cashback">
                    <DropdownMenuItem className="cursor-pointer data-highlighted:bg-white">
                      Cashback
                    </DropdownMenuItem>
                  </Link>
                  <Link href="/admin/cronometro">
                    <DropdownMenuItem className="cursor-pointer data-highlighted:bg-white">
                      Cronômetro
                    </DropdownMenuItem>
                  </Link>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={handleLogout}
                    className="cursor-pointer hover:text-red-700 data-highlighted:bg-white"
                  >
                    Sair
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-10">
        <div className="grid gap-4 xl:grid-cols-[360px_1fr]">
          <div className="space-y-4 xl:sticky xl:top-24 xl:self-start">
            <section className="rounded-2xl border border-zinc-900 bg-zinc-950/40 p-4 md:p-6">
              <div className="space-y-12">
                <div>
                  <label
                    htmlFor="duration"
                    className="mb-2 block text-xs uppercase tracking-[0.2em] text-zinc-500"
                  >
                    Duração
                  </label>
                  <select
                    id="duration"
                    value={durationMinutes}
                    onChange={(e) => handleDurationChange(e.target.value)}
                    className="h-10 w-full rounded-xl border border-zinc-800 bg-black px-3 text-zinc-100"
                  >
                    {Array.from({ length: 10 }, (_, index) => {
                      const minute = index + 1;
                      return (
                        <option key={minute} value={minute}>
                          {minute} {minute === 1 ? "minuto" : "minutos"}
                        </option>
                      );
                    })}
                  </select>
                </div>

                <div className="rounded-2xl border border-zinc-800 bg-black/40 p-4 text-center md:p-5">
                  <div className="text-xs uppercase tracking-[0.2em] text-zinc-500">Tempo restante</div>
                  <div className="text-5xl font-semibold tabular-nums text-white md:text-6xl">
                    {formatTime(remainingSeconds)}
                  </div>
                  {remainingSeconds === 0 ? (
                    <div className="mt-1 text-sm text-red-400">Tempo encerrado</div>
                  ) : null}
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <Button
                    type="button"
                    onClick={handleToggleTimer}
                    className="h-10 cursor-pointer bg-white text-black hover:bg-zinc-200"
                  >
                    {running ? "Pausar" : "Iniciar"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleResetTimer}
                    className="h-10 cursor-pointer border-zinc-800 bg-zinc-950/40 text-zinc-100 hover:bg-white hover:text-black"
                  >
                    Reiniciar
                  </Button>
                </div>
              </div>
            </section>

            <section className="rounded-2xl border border-zinc-900 bg-zinc-950/40 p-4 md:p-6">
              <div className="text-sm text-zinc-400">
              Placar:{" "}
                <span className="rounded-md border border-red-900/50 bg-red-950/40 px-2 py-0.5 font-medium text-red-200">
                  {athleteAName || "Atleta 1"}
                </span>{" "}
                <span className="text-zinc-500">
                  ({athleteAScore}) V:{athleteAVantagens} P:{athleteAPunicoes}
                </span>{" "}
                x{" "}
                <span className="rounded-md border border-blue-900/50 bg-blue-950/40 px-2 py-0.5 font-medium text-blue-200">
                  {athleteBName || "Atleta 2"}
                </span>{" "}
                <span className="text-zinc-500">
                  ({athleteBScore}) V:{athleteBVantagens} P:{athleteBPunicoes}
                </span>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleResetScoreboard}
                  className="h-10 cursor-pointer border-zinc-800 bg-zinc-950/40 text-zinc-100 hover:bg-white hover:text-black"
                >
                  Zerar placar
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleResetAll}
                  className="h-10 cursor-pointer border-zinc-800 bg-zinc-950/40 text-zinc-100 hover:bg-white hover:text-black"
                >
                  Reiniciar luta
                </Button>
              </div>
            </section>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <ScoreCard
              title="Atleta 1"
              theme="red"
              name={athleteAName}
              score={athleteAScore}
              vantagemCount={athleteAVantagens}
              punicaoCount={athleteAPunicoes}
              onNameChange={setAthleteAName}
              onAddMainScore={(points) => setAthleteAScore((current) => current + points)}
              onAdjustVantagem={(delta) =>
                setAthleteAVantagens((current) => Math.max(0, current + delta))
              }
              onAdjustPunicao={(delta) =>
                setAthleteAPunicoes((current) => Math.max(0, current + delta))
              }
            />
            <ScoreCard
              title="Atleta 2"
              theme="blue"
              name={athleteBName}
              score={athleteBScore}
              vantagemCount={athleteBVantagens}
              punicaoCount={athleteBPunicoes}
              onNameChange={setAthleteBName}
              onAddMainScore={(points) => setAthleteBScore((current) => current + points)}
              onAdjustVantagem={(delta) =>
                setAthleteBVantagens((current) => Math.max(0, current + delta))
              }
              onAdjustPunicao={(delta) =>
                setAthleteBPunicoes((current) => Math.max(0, current + delta))
              }
            />
          </div>
        </div>
      </main>
    </div>
  );
}
