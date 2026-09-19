const FINANCEIRO_COOKIE_NAME = "financeiro_auth";

export function isFinanceiroAuthenticated(): boolean {
  if (typeof window === "undefined") return false;

  const cookies = document.cookie.split(";");
  return cookies.some((cookie) =>
    cookie.trim().startsWith(`${FINANCEIRO_COOKIE_NAME}=`)
  );
}

export function logoutFinanceiro(): void {
  if (typeof window === "undefined") return;
  document.cookie = `${FINANCEIRO_COOKIE_NAME}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
}
