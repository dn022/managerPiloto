import { listParticipantsAdmin } from "@/app/_lib/actions/adminInscricoes";
import CategoriesClient from "@/app/_components/admin/CategoriasClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AdminCategoriasPage() {
  const all = await listParticipantsAdmin();
  const paid = all.filter((participant) => participant.status === "paid");
  return <CategoriesClient all={paid} />;
}
