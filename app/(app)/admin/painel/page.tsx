import { listParticipantsAdmin } from "@/app/_lib/actions/adminInscricoes";
import { listLinks } from "@/app/_lib/actions/adminLinks";
import AdminInscricoesClient from "../../../_components/admin/AdminInscricoesClient";

export const dynamic = "force-dynamic";

export default async function AdminInscricoesPage() {
  const [participants, links] = await Promise.all([
    listParticipantsAdmin(),
    listLinks(),
  ]);
  return <AdminInscricoesClient initialParticipants={participants} initialLinks={links} />;
}
