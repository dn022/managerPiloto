// URL pública do logo (bucket `tenant-assets` é público para leitura).
export function logoUrl(logoPath: string | null | undefined) {
  if (logoPath && process.env.DEMO_MODE === "1") return `/demo-assets/${logoPath}`;
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!logoPath || !base) return null;
  return `${base}/storage/v1/object/public/tenant-assets/${logoPath}`;
}

const HEX = /^#[0-9a-fA-F]{6}$/;

export function brandColor(settings: Record<string, string>) {
  const c = settings.primary_color;
  return c && HEX.test(c) ? c : null;
}
