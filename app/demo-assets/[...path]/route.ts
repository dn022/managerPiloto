import { demoAssets } from "@/app/_lib/demo/db";

// Serve os arquivos enviados no modo demo (logo). Fora do modo demo não existe.
export async function GET(_req: Request, { params }: { params: Promise<{ path: string[] }> }) {
  if (process.env.DEMO_MODE !== "1") return new Response("Not found", { status: 404 });
  const { path } = await params;
  const asset = demoAssets.get(path.join("/"));
  if (!asset) return new Response("Not found", { status: 404 });
  return new Response(asset.bytes as BodyInit, { headers: { "content-type": asset.type, "cache-control": "no-store" } });
}
