import { requireTenant } from "@/app/_lib/session";
import CronometroClient from "./CronometroClient";

export default async function CronometroPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  await requireTenant(slug, undefined, "championships");
  return <CronometroClient />;
}
