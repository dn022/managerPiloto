import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Gestão esportiva",
  description: "Gestão de turmas, mensalidades, ranking e campeonatos para arenas e escolas esportivas.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-br" suppressHydrationWarning>
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
