import { createClient } from "@supabase/supabase-js";
import "server-only";

export function supabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !service) {
    throw new Error(
      "Variáveis de ambiente do Supabase não configuradas. Certifique-se de que NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY estão definidas."
    );
  }
  
  return createClient(url, service, {
    auth: { persistSession: false },
  });
}