const AUTH_COOKIE_NAME = "admin_auth";

export function isAuthenticated(): boolean {
  if (typeof window === "undefined") return false;

  const cookies = document.cookie.split(";");
  return cookies.some((cookie) =>
    cookie.trim().startsWith(`${AUTH_COOKIE_NAME}=`)
  );
}

export function logout(): void {
  if (typeof window === "undefined") return;
  document.cookie = `${AUTH_COOKIE_NAME}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
}


export function getAuthToken(): string | null {
  if (typeof window === "undefined") return null;

  const cookies = document.cookie.split(";");
  const authCookie = cookies.find((cookie) =>
    cookie.trim().startsWith(`${AUTH_COOKIE_NAME}=`)
  );

  if (!authCookie) return null;

  return authCookie.split("=")[1]?.trim() || null;
}
