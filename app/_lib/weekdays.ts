export const WEEKDAYS = [
  "Domingo",
  "Segunda",
  "Terça",
  "Quarta",
  "Quinta",
  "Sexta",
  "Sábado",
] as const;

// Ordem de exibição: segunda a domingo.
export const WEEKDAY_ORDER = [1, 2, 3, 4, 5, 6, 0] as const;

export const hhmm = (time: string) => time.slice(0, 5);

export const brl = (cents: number) =>
  (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
