"use client";

import Image from "next/image";
import * as React from "react";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Flag,
  MapPin,
  Medal,
  ShieldCheck,
  Sparkles,
  Trophy,
  Users,
  Volume2,
  X,
} from "lucide-react";

const teamStats = [
  {
    value: "10+",
    label: "edições de aprendizado",
    description: "Cada evento soma experiência real em organização, ritmo e cuidado com o atleta.",
  },
  {
    value: "500+",
    label: "histórias vividas",
    description: "Inscrições, chamadas e lutas que transformam preparo em memória de campeonato.",
  },
  {
    value: "10",
    label: "equipes presentes",
    description: "Academias reunidas por um mesmo objetivo: competir com honra e evoluir juntas.",
  },
  {
    value: "98%",
    label: "energia aprovada",
    description: "Público, professores e atletas reconhecem quando o evento respeita o tatame.",
  },
];

type GalleryMedia = {
  src: string;
  type: "image" | "video";
};

const imageItems: GalleryMedia[] = [
  { src: "/img/atle.jpeg", type: "image"},
  { src: "/img/atletas.jpeg", type: "image"},
  { src: "/img/atletas2.jpeg", type: "image"},
  { src: "/img/cinturao.jpeg", type: "image"},
  { src: "/img/luta1.jpeg", type: "image"},
  { src: "/img/luta3.jpeg", type: "image"},
  { src: "/img/luta8.jpeg", type: "image"},
  { src: "/img/WhatsApp%20Image%202026-04-10%20at%2008.49.48%20(1).jpeg", type: "image" },
  { src: "/img/WhatsApp%20Image%202026-04-10%20at%2008.49.48.jpeg", type: "image" },
  { src: "/img/WhatsApp%20Image%202026-04-10%20at%2008.49.49.jpeg", type: "image" },
  { src: "/img/WhatsApp%20Image%202026-04-10%20at%2008.49.55.jpeg", type: "image" },
  { src: "/img/WhatsApp%20Image%202026-04-10%20at%2008.50.02.jpeg", type: "image" },
  { src: "/img/WhatsApp%20Image%202026-04-10%20at%2008.50.13.jpeg", type: "image" },
  { src: "/img/WhatsApp%20Image%202026-04-10%20at%2008.50.23.jpeg", type: "image" },
  { src: "/img/WhatsApp%20Image%202026-04-10%20at%2008.50.31.jpeg", type: "image" },
  { src: "/img/WhatsApp%20Image%202026-04-10%20at%2008.58.41.jpeg", type: "image" },
  { src: "/img/WhatsApp%20Image%202026-04-10%20at%2008.58.47.jpeg", type: "image" },
];

const videoItems: GalleryMedia[] = [
  { src: "/vid/aquecimento.mp4", type: "video"},
  { src: "/vid/evento.mp4", type: "video"},
  { src: "/vid/hero.mp4", type: "video"},
  { src: "/vid/luta6.mp4", type: "video"},
  { src: "/vid/luta7.mp4", type: "video"},
  { src: "/vid/WhatsApp%20Video%202026-04-10%20at%2008.49.53.mp4", type: "video" },
  { src: "/vid/WhatsApp%20Video%202026-04-10%20at%2008.49.58.mp4", type: "video" },
  { src: "/vid/WhatsApp%20Video%202026-04-10%20at%2008.50.03.mp4", type: "video" },
  { src: "/vid/WhatsApp%20Video%202026-04-10%20at%2008.50.10.mp4", type: "video" },
  { src: "/vid/WhatsApp%20Video%202026-04-10%20at%2008.50.11.mp4", type: "video" },
  { src: "/vid/WhatsApp%20Video%202026-04-10%20at%2008.50.28.mp4", type: "video" },
];

const nextEventHighlights = [
  {
    icon: CalendarDays,
    title: "Data oficial",
    subtitle: "16/08",
    description: "Data oficial do próximo campeonato de Jiu-Jitsu",
  },
  {
    icon: MapPin,
    title: "Local",
    subtitle: "Escola Paineira",
    description: "R. São Pedro - Balneário, São Pedro da Aldeia - RJ, 28940-000",
  },
  {
    icon: Medal,
    title: "Categorias",
    description: "Divisões organizadas para valorizar técnica, equilíbrio e merecimento em cada chave.",
  },
  {
    icon: ShieldCheck,
    title: "Estrutura",
    description: "Credenciamento, chamadas e suporte pensados para deixar o foco onde importa: na luta.",
  },
];

const eventDetails = [
  { icon: Clock3, label: "Inscrições", value: "Fácil inscrição e chaveamento automático de acordo com idade e peso." },
  { icon: Users, label: "Ambiente", value: "Um encontro entre atletas, famílias, equipes e quem respeita o esporte." },
  { icon: Trophy, label: "Premiação", value: "Reconhecimento para quem sobe no tatame disposto a dar o melhor." },
  { icon: Flag, label: "Organização", value: "Uma equipe comprometida com seriedade, ritmo e boa experiência." },
];

const sponsors = [
  { name: "Vereador Zezinho", tag: "Apoio Cultural", image: "/pat/patrocinador_01.jpg" },
  { name: "LanchesBar", tag: "Lanches - Petiscos - Bebidas", image: "/pat/patrocinador_02.jpeg" },
  { name: "RR Variedades", tag: "Bazar e Papelaria", image: "/pat/patrocinador_03.jpeg" },
  { name: "Studio - Andreza Bronze", tag: "Studio de Beleza", image: "/pat/patrocinador_04.png" },
  // { name: "Estrutura do Evento", tag: "Montagem, arena, áudio ou operação local", initials: "EE" },
];

function buildAlternatingGallery(images: GalleryMedia[], videos: GalleryMedia[]) {
  const totalPairs = Math.max(images.length, videos.length);
  const mixed: GalleryMedia[] = [];

  for (let index = 0; index < totalPairs; index += 1) {
    mixed.push(images[index % images.length]);
    mixed.push(videos[index % videos.length]);
  }

  return mixed;
}

function chunkGallery<T>(items: T[], size: number) {
  const chunks: T[][] = [];

  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }

  return chunks;
}

export default function HomeShowcase() {
  const galleryItems = React.useMemo(
    () => buildAlternatingGallery(imageItems, videoItems),
    []
  );
  const [currentPage, setCurrentPage] = React.useState(0);
  const visibleGalleryItems = React.useMemo(() => {
    if (galleryItems.length === 0) {
      return [];
    }

    return Array.from({ length: Math.min(4, galleryItems.length) }, (_, index) => {
      return galleryItems[(currentPage + index) % galleryItems.length];
    });
  }, [currentPage, galleryItems]);
  const [selectedItem, setSelectedItem] = React.useState<GalleryMedia | null>(null);
  const modalVideoRef = React.useRef<HTMLVideoElement>(null);

  React.useEffect(() => {
    if (galleryItems.length <= 4) {
      return undefined;
    }

    const interval = window.setInterval(() => {
      setCurrentPage((page) => (page + 1) % galleryItems.length);
    }, 5000);

    return () => window.clearInterval(interval);
  }, [galleryItems.length]);

  React.useEffect(() => {
    if (!selectedItem) {
      document.body.style.overflow = "";
      return undefined;
    }

    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = "";
    };
  }, [selectedItem]);

  React.useEffect(() => {
    if (selectedItem?.type !== "video" || !modalVideoRef.current) {
      return;
    }

    modalVideoRef.current.currentTime = 0;
    modalVideoRef.current.muted = false;
    void modalVideoRef.current.play();
  }, [selectedItem]);

  const goToPrevious = () => {
    setCurrentPage((page) => (page - 1 + galleryItems.length) % galleryItems.length);
  };

  const goToNext = () => {
    setCurrentPage((page) => (page + 1) % galleryItems.length);
  };

  return (
    <>
      <section className="bg-transparent py-14 sm:py-20">
        <div className="container mx-auto px-4">
          <div className="grid gap-8 lg:grid-cols-[1.15fr_0.85fr]">
            <div className="rounded-[2rem] border border-zinc-800 bg-zinc-950/75 p-5 shadow-[0_0_0_1px_rgba(255,255,255,0.02)] sm:p-8">
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-red-500/20 bg-red-500/10 px-4 py-2 text-sm font-medium text-red-100">
                <Sparkles className="h-4 w-4" />
                Black Belt BJJ
              </div>

              <h2 className="max-w-2xl text-2xl font-bold tracking-tight text-white sm:text-3xl md:text-4xl">
                Um campeonato marcante nasce de detalhes bem feitos e de respeito por quem compete.
              </h2>

              <p className="mt-4 max-w-2xl text-sm leading-7 text-zinc-300 sm:mt-5 sm:text-base">
                Evento com presença, clareza e verdade do início ao fim. Profissionais e atletas, com informações objetivas em mãos, campeonato com identidade forte, a BlackBelt BJJ é um convite real para viver uma grande aventura dentro do tatame.
              </p>

              <div className="mt-6 grid gap-3 sm:mt-8 sm:grid-cols-2 sm:gap-4">
                {teamStats.map((item) => (
                  <div
                    key={item.label}
                    className="rounded-3xl border border-zinc-800 bg-black/60 p-4 transition-colors hover:border-red-500/40 hover:bg-red-500/5 sm:p-5"
                  >
                    <div className="text-2xl font-bold text-red-500 sm:text-3xl">{item.value}</div>
                    <div className="mt-2 text-xs font-semibold uppercase tracking-[0.18em] text-zinc-200 sm:text-sm">
                      {item.label}
                    </div>
                    <p className="mt-3 text-sm leading-6 text-zinc-400">{item.description}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="relative overflow-hidden rounded-[2rem] border border-zinc-800 bg-zinc-950">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(220,38,38,0.22),transparent_50%)]" />
              <Image
                src="https://commons.wikimedia.org/wiki/Special:FilePath/Lucas%20Leite%202009%20BJJ%20Championships.jpg"
                alt="Atletas em luta de jiu-jitsu"
                width={1200}
                height={1520}
                unoptimized
                className="h-full min-h-[360px] w-full object-cover opacity-45 sm:min-h-[520px]"
              />
              <div className="absolute inset-0 bg-linear-to-t from-black via-black/70 to-black/10" />

              <div className="absolute inset-x-0 bottom-0 p-4 sm:p-8">
                <div className="max-w-md rounded-[1.75rem] border border-white/10 bg-black/65 p-5 backdrop-blur-sm sm:p-6">
                  <div className="text-sm font-semibold uppercase tracking-[0.22em] text-red-300">
                    Espírito da competição
                  </div>
                  <p className="mt-3 text-xl font-semibold text-white sm:mt-4 sm:text-2xl">
                    Mais do que um torneio, um dia para testar preparo, caráter e vontade de vencer.
                  </p>
                  <p className="mt-4 text-sm leading-6 text-zinc-300">
                    Campeonato pensado para reunir atletas para uma competição justa. O tatame chama quem se prepara.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-transparent py-14 sm:py-20">
        <div className="container mx-auto px-4">
          <div className="mb-10 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <div className="text-sm font-semibold uppercase tracking-[0.24em] text-red-300">
                Galeria
              </div>
              <h2 className="mt-3 text-2xl font-bold text-white sm:text-3xl md:text-4xl">
                Imagens e vídeos que traduzem a intensidade de quem vive o jiu-jitsu de verdade.
              </h2>
            </div>
          </div>

          <div className="relative">
            <button
              type="button"
              onClick={goToPrevious}
              className="absolute -left-8 top-1/2 z-10 inline-flex h-10 w-10 -translate-y-1/2 items-center justify-center text-red-500 transition hover:text-red-400 sm:-left-12 sm:h-12 sm:w-12"
              aria-label="Pagina anterior da galeria"
            >
              <ChevronLeft className="h-10 w-10 cursor-pointer" />
            </button>

            <button
              type="button"
              onClick={goToNext}
              className="absolute -right-8 top-1/2 z-10 inline-flex h-10 w-10 -translate-y-1/2 items-center justify-center text-red-500 transition hover:text-red-400 sm:-right-12 sm:h-12 sm:w-12"
              aria-label="Proxima pagina da galeria"
            >
              <ChevronRight className="h-10 w-10 cursor-pointer" />
            </button>

            <div className="overflow-hidden rounded-[2rem] border border-zinc-800 bg-zinc-950/70 p-4 sm:p-5 md:p-6">
              <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
              {visibleGalleryItems.map((item, index) => (
                <button
                  key={`${item.type}-${item.src}-${index}`}
                  type="button"
                  onClick={() => setSelectedItem(item)}
                  className="group relative h-52 overflow-hidden rounded-[1.25rem] border border-zinc-800 bg-black text-left sm:h-64 lg:h-72"
                >
                  {item.type === "image" ? (
                    <Image
                      src={item.src}
                      alt="Imagem da galeria"
                      fill
                      unoptimized
                      sizes="(max-width: 640px) 50vw, (max-width: 1280px) 50vw, 25vw"
                      className="object-cover transition duration-500 group-hover:scale-105 group-hover:opacity-75"
                    />
                  ) : (
                    <video
                      src={item.src}
                      autoPlay
                      muted
                      loop
                      playsInline
                      preload="metadata"
                      className="h-full w-full object-cover transition duration-500 group-hover:scale-105 group-hover:opacity-75"
                      aria-label="Video da galeria"
                    />
                  )}
                </button>
              ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-transparent py-14 sm:py-20">
        <div className="container mx-auto px-4">
          <div className="grid gap-8 xl:grid-cols-[0.95fr_1.05fr]">
            <div className="rounded-[2rem] border border-zinc-800 bg-zinc-950/80 p-5 sm:p-8">
              <div className="text-sm font-semibold uppercase tracking-[0.24em] text-red-300">
                Próximo campeonato
              </div>
              <h2 className="mt-3 text-2xl font-bold text-white sm:text-3xl md:text-4xl">
                Informações principais do próximo campeonato que será realizado pela Equipe Black Belt Eventos - BJJ.
              </h2>
              <p className="mt-4 max-w-xl text-sm text-zinc-400 sm:text-base">
                Campeonato de Jiu-Jitsu, dedicado a crianças e adultos, mulheres e homens, de todas as idades.
              </p>

              <div className="mt-8 space-y-4">
                {eventDetails.map((item) => {
                  const Icon = item.icon;

                  return (
                    <div
                      key={item.label}
                      className="flex items-start gap-3 rounded-3xl border border-zinc-800 bg-black/60 p-4 transition-colors hover:border-red-500/40 hover:bg-red-500/5 sm:gap-4"
                    >
                      <div className="rounded-2xl bg-red-500/15 p-3 text-red-200">
                        <Icon className="h-5 w-5" />
                      </div>
                      <div>
                        <div className="text-sm font-semibold uppercase tracking-[0.16em] text-zinc-200">
                          {item.label}
                        </div>
                        <p className="mt-2 text-sm leading-6 text-zinc-400">{item.value}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {nextEventHighlights.map((item) => {
                const Icon = item.icon;

                return (
                  <article
                    key={item.title}
                    className="rounded-[1.75rem] border border-zinc-800 bg-zinc-950/70 p-5 transition-colors hover:border-red-500/40 hover:bg-red-500/5 sm:p-6"
                  >
                    <div className="inline-flex rounded-2xl bg-red-500/15 p-3 text-red-200">
                      <Icon className="h-5 w-5" />
                    </div>
                    <h3 className="mt-5 text-xl font-semibold text-white">{item.title}</h3>
                    <h3 className="text-2xl font-semibold text-white">{item.subtitle}</h3>
                    <p className="mt-3 text-sm leading-6 text-zinc-400">{item.description}</p>
                  </article>
                );
              })}

              <article className="overflow-hidden rounded-[1.75rem] border border-zinc-800 bg-zinc-950 sm:col-span-2">
                <div className="grid gap-0 md:grid-cols-[1fr_0.9fr]">
                  <div className="p-5 sm:p-6 md:p-8">
                    <div className="text-sm font-semibold uppercase tracking-[0.24em] text-red-300">
                      Mensagem central
                    </div>
                    <h3 className="mt-3 text-xl font-semibold text-white sm:text-2xl">
                      Cada inscrição representa uma escolha: entrar preparado para competir em alto nível.
                    </h3>
                    <p className="mt-4 max-w-xl text-sm leading-7 text-zinc-400">
                      Inscrições: R$ 80,00.
                    </p>
                  </div>

                  <div className="relative hidden min-h-[280px] md:block">
                    <Image
                      src="https://commons.wikimedia.org/wiki/Special:FilePath/IBJJF%20World%20No%20Gi%20Championship%202019.jpg"
                      alt="Atletas durante campeonato de jiu-jitsu"
                      fill
                      unoptimized
                      sizes="(max-width: 768px) 100vw, 40vw"
                      className="object-cover opacity-60"
                    />
                    <div className="absolute inset-0 bg-linear-to-l from-black/20 via-black/35 to-black" />
                  </div>
                </div>
              </article>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-transparent py-14 sm:py-20">
        <div className="container mx-auto px-4">
          <div className="mb-10 text-center">
            <div className="text-sm font-semibold uppercase tracking-[0.24em] text-red-300">
              Patrocinadores
            </div>
            <h2 className="mt-3 text-2xl font-bold text-white sm:text-3xl md:text-4xl">
              Marcas que caminham ao lado de um evento construído com seriedade.
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-sm text-zinc-400 sm:text-base">
              Os apoiadores não entram apenas como exposição. Eles fortalecem uma experiência
              que valoriza atleta, equipe, público e a imagem do campeonato.
            </p>
          </div>

          <div className="mx-auto grid max-w-6xl grid-cols-1 gap-5 px-0 pb-2 sm:grid-cols-2 sm:gap-6 lg:grid-cols-4">
            {sponsors.map((sponsor) => (
              <article
                key={sponsor.name}
                className="flex min-h-[320px] w-full flex-col items-center justify-start rounded-[1.75rem] border border-zinc-800 bg-zinc-950/75 p-6 text-center transition-colors hover:border-red-500/40 hover:bg-red-500/5 sm:p-7 lg:min-h-[360px]"
              >
                <div className="mx-auto flex h-32 w-full items-center justify-center overflow-hidden rounded-[1.5rem] border border-red-500/20 bg-white p-4 sm:h-36 lg:h-40">
                  <Image
                    src={sponsor.image}
                    alt={`Logo ${sponsor.name}`}
                    width={640}
                    height={360}
                    className="h-full w-full object-contain"
                  />
                </div>
                <h3 className="mt-6 text-2xl font-semibold leading-tight text-white sm:text-[1.7rem]">
                  {sponsor.name}
                </h3>
                <p className="mt-3 text-base leading-6 text-zinc-400">{sponsor.tag}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {selectedItem ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm"
          onClick={() => setSelectedItem(null)}
        >
          <button
            type="button"
            onClick={() => setSelectedItem(null)}
            className="absolute right-4 top-4 inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/15 bg-black/60 text-white transition hover:bg-black"
            aria-label="Fechar visualização"
          >
            <X className="h-5 w-5" />
          </button>

          <div
            className="relative flex max-h-[90vh] w-full max-w-5xl items-center justify-center overflow-hidden rounded-[2rem] border border-zinc-800 bg-zinc-950 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            {selectedItem.type === "image" ? (
              <div className="relative h-[80vh] w-full">
                <Image
                  src={selectedItem.src}
                  alt="Imagem ampliada da galeria"
                  fill
                  unoptimized
                  sizes="90vw"
                  className="object-contain"
                />
              </div>
            ) : (
              <div className="w-full">
                <video
                  ref={modalVideoRef}
                  key={selectedItem.src}
                  src={selectedItem.src}
                  controls
                  autoPlay
                  playsInline
                  preload="auto"
                  className="max-h-[80vh] w-full bg-black object-contain"
                  aria-label="Video ampliado da galeria"
                />
                <div className="flex items-center gap-2 border-t border-white/10 bg-black/70 px-4 py-3 text-sm text-zinc-200">
                  <Volume2 className="h-4 w-4 text-red-300" />
                  Áudio ativado ao abrir o vídeo.
                </div>
              </div>
            )}
          </div>
        </div>
      ) : null}
    </>
  );
}
