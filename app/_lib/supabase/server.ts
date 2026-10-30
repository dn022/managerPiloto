import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import "server-only";

// Cliente com a sessão do usuário: todas as queries passam pelo RLS.
export async function createClient() {
  // Ler cookies primeiro marca a página como dinâmica (nunca prerenderizada).
  const cookieStore = await cookies();

  // Modo demo (DEMO_MODE=1): banco embutido, sem Supabase.
  if (process.env.DEMO_MODE === "1") {
    const { createDemoClient } = await import("@/app/_lib/demo/client");
    return createDemoClient(cookieStore);
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error(
      "Defina NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY."
    );
  }

  return createServerClient(url, anonKey, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (list) => {
        try {
          for (const { name, value, options } of list) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Chamado de um Server Component: o proxy já renova a sessão.
        }
      },
    },
  });
}
