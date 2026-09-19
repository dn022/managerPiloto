import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Carvalho BJJ",
  description:
    "Campeonato de Jiu-Jitsu com inscrição, informações oficiais e comunicação preparada para cada edição.",
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
