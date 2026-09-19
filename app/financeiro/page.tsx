import FinanceiroProtected from "@/app/_components/FinanceiroProtected";
import FinanceiroClient from "@/app/_components/financeiro/FinanceiroClient";
import { listParticipantsAdmin } from "@/app/_lib/actions/adminInscricoes";
import { listCustos } from "@/app/_lib/actions/custos";

export default async function FinanceiroPage() {
  const [athletes, custos] = await Promise.all([
    listParticipantsAdmin(),
    listCustos(),
  ]);

  return (
    <FinanceiroProtected>
      <FinanceiroClient athletes={athletes} initialCustos={custos} />
    </FinanceiroProtected>
  );
}
