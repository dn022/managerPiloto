import { notFound } from "next/navigation";
import { getLinkByToken, getParticipantesByToken } from "@/app/_lib/actions/adminLinks";
import LinkInscricaoClient from "./LinkInscricaoClient";

export const dynamic = "force-dynamic";

export default async function LinkPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const [link, participantes] = await Promise.all([
    getLinkByToken(token),
    getParticipantesByToken(token),
  ]);

  if (!link) {
    notFound();
  }

  return <LinkInscricaoClient link={link} initialParticipantes={participantes} />;
}
