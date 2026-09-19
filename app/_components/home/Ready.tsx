"use client";

import * as React from "react";
import Link from "next/link";
import { MessageCircleIcon } from "lucide-react";
import { Button } from "../ui/button";

type FAQKey =
  | "evento"
  | "local"
  | "valores"
  | "pagamento"
  | "premiacoes"
  | "categorias"
  | "absoluto"
  | "regras"
  | "imagem"
  | "inscricao";

const faqs: Array<{
  key: FAQKey;
  title: string;
  answer: string;
}> = [
  {
    key: "evento",
    title: "Sobre o Evento",
    answer:
      "Este campeonato foi idealizado para oferecer uma experiência competitiva séria, organizada e inspiradora. A cada luta, o objetivo é valorizar o preparo do atleta e o respeito pelo tatame.",
  },
  {
    key: "local",
    title: "Local do Evento",
    answer:
      "O endereço oficial pode ser atualizado neste bloco sempre que a edição for confirmada. A recomendação é chegar com antecedência para credenciamento, aquecimento e orientações iniciais.",
  },
  {
    key: "valores",
    title: "Valores de Inscrições",
    answer:
      "A inscrição custa R$ 80,00.",
  },
  {
    key: "pagamento",
    title: "Formas de Pagamento",
    answer:
      "O pagamento é realizado por PIX, de forma prática e objetiva. Depois da inscrição, o atleta recebe as instruções para finalizar a etapa e garantir sua vaga.",
  },
  {
    key: "premiacoes",
    title: "Premiações",
    answer:
      "A premiação reconhece desempenho, entrega e mérito esportivo. Os detalhes oficiais de cada edição podem ser ajustados aqui conforme a proposta do campeonato.",
  },
  {
    key: "categorias",
    title: "Categorias",
    answer:
      "As categorias seguem critérios de faixa, idade e peso para manter o chaveamento equilibrado. Isso fortalece disputas mais justas e valoriza o nível técnico do evento.",
  },
  {
    key: "absoluto",
    title: "Absoluto",
    answer:
      "Quando estiver disponível, o Absoluto amplia o desafio para quem busca ir além da própria categoria. As regras e condições podem ser personalizadas conforme a edição.",
  },
  {
    key: "regras",
    title: "Regras",
    answer:
      "O regulamento define pontuação, condutas e orientações do evento. A ideia é garantir competitividade com disciplina, transparência e respeito em todas as áreas da competição.",
  },
  {
    key: "imagem",
    title: "Direito de Imagem",
    answer:
      "A participação no evento pode envolver captação de fotos e vídeos para comunicação oficial do campeonato. Havendo alguma restrição específica, a organização deve ser avisada com antecedência.",
  },
  {
    key: "inscricao",
    title: "Confirmação da Inscrição",
    answer:
      "A inscrição só é considerada concluída após a etapa de pagamento ser confirmada. Depois disso, o atleta segue com mais segurança para a preparação e acompanhamento das informações do evento.",
  },
];

function FAQCard({
  title,
  answer,
  isOpen,
  onToggle,
}: {
  title: string;
  answer: string;
  isOpen: boolean;
  onToggle: () => void;
}) {
  return (
    <div
      className={[
        "group rounded-2xl border border-zinc-800 bg-black/40",
        "transition-colors hover:border-red-500/40 hover:bg-red-500/10",
      ].join(" ")}
    >
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center rounded-2xl p-4 text-left transition-colors focus:outline-none focus:ring-2 focus:ring-red-500/30 group-hover:bg-red-500/10"
        aria-expanded={isOpen}
      >
        <div className="flex w-full items-center justify-between gap-4">
          <div className="flex flex-col">
            <span className="text-base font-semibold text-zinc-100">{title}</span>
          </div>
          <span
            className={[
              "text-base text-zinc-400 transition-transform",
              isOpen ? "rotate-180" : "rotate-0",
            ].join(" ")}
            aria-hidden
          >
            v
          </span>
        </div>
      </button>

      <div
        className={[
          "overflow-hidden px-4 pb-4 transition-all duration-200",
          isOpen ? "max-h-[260px] opacity-100" : "max-h-0 opacity-0",
        ].join(" ")}
      >
        <div className="mt-3 rounded-xl border border-zinc-800 bg-zinc-950 p-4 text-sm leading-relaxed text-zinc-200 transition-colors group-hover:border-red-500/30 group-hover:bg-black/80">
          {answer}
        </div>
      </div>
    </div>
  );
}

export default function Ready() {
  const [openKey, setOpenKey] = React.useState<FAQKey | null>(null);
  const leftColumn = faqs.slice(0, 5);
  const rightColumn = faqs.slice(5);

  return (
    <section className="bg-transparent py-14 sm:py-20">
      <div className="container mx-auto px-4">
        <div className="relative mx-auto max-w-5xl overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950 p-4 shadow-sm sm:p-6">
          <div className="absolute -top-24 left-1/3 h-64 w-64 rounded-full bg-red-600/20 blur-3xl" />
          

          <div className="relative">
            <div className="mb-8 text-center">
              <h2 className="text-2xl font-bold text-zinc-100 md:text-3xl">
                Dúvidas frequentes
              </h2>
            </div>

            <div className="grid gap-4 md:grid-cols-2 md:gap-6">
              <div className="space-y-4">
                {leftColumn.map((item) => {
                  const isOpen = openKey === item.key;

                  return (
                    <FAQCard
                      key={item.key}
                      title={item.title}
                      answer={item.answer}
                      isOpen={isOpen}
                      onToggle={() =>
                        setOpenKey((previous) => (previous === item.key ? null : item.key))
                      }
                    />
                  );
                })}
              </div>

              <div className="space-y-4">
                {rightColumn.map((item) => {
                  const isOpen = openKey === item.key;

                  return (
                    <FAQCard
                      key={item.key}
                      title={item.title}
                      answer={item.answer}
                      isOpen={isOpen}
                      onToggle={() =>
                        setOpenKey((previous) => (previous === item.key ? null : item.key))
                      }
                    />
                  );
                })}
              </div>
            </div>

            <div className="mt-10 text-center text-sm text-zinc-400">
              Se ainda restar alguma dúvida, fale com a organização e receba a orientação
              certa antes de entrar no tatame.
            </div>
          </div>

          <div className="mt-5 flex justify-center gap-4">
            <Button
              asChild
              variant="outline"
              className="mt-3 flex h-12 w-full items-center justify-center rounded-xl border-zinc-700 bg-green-600 text-sm font-medium text-zinc-200 transition-colors hover:bg-green-500 hover:text-white sm:h-14 sm:w-auto sm:bg-black sm:text-base sm:hover:bg-green-600"
            >
              <Link href="https://wa.me/5522999809455" target="_blank" className="mt-3 flex h-12 w-full items-center justify-center rounded-xl border-zinc-700 bg-green-600 text-sm font-medium text-zinc-200 transition-colors hover:bg-green-500 hover:text-white sm:h-14 sm:w-auto sm:bg-black sm:text-base sm:hover:bg-green-600"
>
                <MessageCircleIcon className="h-5 w-5 " />
                Contate a Organização
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
