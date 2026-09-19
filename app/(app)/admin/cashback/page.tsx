import { listParticipantsAdmin } from "@/app/_lib/actions/adminInscricoes";
import CashbackClient from "@/app/_components/admin/CashbackClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AdminCashbackPage() {
  const all = await listParticipantsAdmin();
  return <CashbackClient all={all} />;
}

