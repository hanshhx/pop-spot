const TOKEN_KEY = 'token';

/**
 * JWT를 탭 세션 범위에만 둔다. 기존 localStorage 토큰은 최초 접근 시 한 번 옮기고 즉시 제거한다.
 * HttpOnly 쿠키로 완전히 전환하기 전까지 XSS 노출 면적을 줄이는 호환 단계다.
 */
export function getAuthToken(): string | null {
  if (typeof window === 'undefined') return null;
  const current = window.sessionStorage.getItem(TOKEN_KEY);
  if (current) return current;

  const legacy = window.localStorage.getItem(TOKEN_KEY);
  if (!legacy) return null;
  window.sessionStorage.setItem(TOKEN_KEY, legacy);
  window.localStorage.removeItem(TOKEN_KEY);
  return legacy;
}

export function setAuthToken(token: string): void {
  if (typeof window === 'undefined') return;
  window.sessionStorage.setItem(TOKEN_KEY, token);
  window.localStorage.removeItem(TOKEN_KEY);
}

export function clearAuthToken(): void {
  if (typeof window === 'undefined') return;
  window.sessionStorage.removeItem(TOKEN_KEY);
  window.localStorage.removeItem(TOKEN_KEY);
}
