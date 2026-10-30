import { Input } from "@/app/_components/ui/input";

export { Input };

export const selectClass =
  "h-10 w-full rounded-md border border-zinc-800 bg-black/40 px-3 text-sm text-zinc-100";

export function PageHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-6">
      <h1 className="text-2xl font-semibold">{title}</h1>
      {subtitle && <p className="mt-1 text-sm text-zinc-400">{subtitle}</p>}
    </div>
  );
}

export function ErrorBanner({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <div className="mb-4 rounded-xl border border-red-900/50 bg-red-950/40 px-3 py-2 text-sm text-red-200">
      {message}
    </div>
  );
}

export function Card({
  title,
  children,
  className = "",
}: {
  title?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-xl border border-zinc-800 bg-zinc-900/60 p-5 ${className}`}>
      {title && <h2 className="mb-4 text-lg font-medium">{title}</h2>}
      {children}
    </section>
  );
}

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1 text-sm">
      <span className="text-zinc-400">{label}</span>
      {children}
    </label>
  );
}

// Formulário de criação recolhido: a lista continua sendo o conteúdo principal da tela.
export function FormToggle({
  title,
  children,
  defaultOpen = false,
}: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  return (
    <details className="arena-toggle mb-6" open={defaultOpen}>
      <summary>
        <span className="arena-toggle-plus" aria-hidden>
          +
        </span>
        {title}
      </summary>
      <div className="arena-toggle-body">{children}</div>
    </details>
  );
}

export function Avatar({ name }: { name: string }) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase();
  return (
    <span className="arena-avatar" aria-hidden>
      {initials}
    </span>
  );
}

type Tone = "info" | "ok" | "warn" | "danger" | "muted";
export function Badge({ tone = "info", children }: { tone?: Tone; children: React.ReactNode }) {
  return <span className={`arena-badge arena-badge-${tone}`}>{children}</span>;
}

// Cor estável por modalidade (mesmo nome, mesma cor em qualquer tela).
export function sportColor(name: string | null | undefined) {
  let h = 0;
  for (const ch of name ?? "") h = (h * 31 + ch.charCodeAt(0)) % 360;
  return `hsl(${(h + 170) % 360} 85% 62%)`;
}
