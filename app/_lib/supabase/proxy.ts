import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Renova a sessão e redireciona visitantes anônimos das áreas protegidas.
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const path0 = request.nextUrl.pathname;
  if (process.env.DEMO_MODE === "1") {
    const protectedDemo = path0.startsWith("/t/") || path0.startsWith("/platform") || path0 === "/minhas-arenas";
    if (protectedDemo && !request.cookies.get("demo_uid")) {
      const loginUrl = request.nextUrl.clone();
      loginUrl.pathname = "/entrar";
      loginUrl.search = "";
      return NextResponse.redirect(loginUrl);
    }
    return response;
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return response;

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (list) => {
        for (const { name, value } of list) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of list) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  // getUser() valida o token no Auth server (getSession() não valida).
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const protectedArea =
    path.startsWith("/t/") || path.startsWith("/platform") || path === "/minhas-arenas";

  if (!user && protectedArea) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/entrar";
    loginUrl.search = "";
    return NextResponse.redirect(loginUrl);
  }

  return response;
}
