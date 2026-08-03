const TOKEN_KEY = 'token';
const REFRESH_KEY = 'refreshToken';

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
  // 접근 토큰만 지우고 리프레시를 남기면 로그아웃이 되지 않는다 — 다음 요청이 곧바로 갱신한다.
  window.sessionStorage.removeItem(REFRESH_KEY);
}

/**
 * 리프레시 토큰 — 접근 토큰이 만료됐을 때 조용히 새것을 받아 오는 데 쓴다.
 *
 * <p>접근 토큰과 <b>같은 자리</b>(sessionStorage)에 둔다. localStorage 에 두면 탭을 닫아도 남아
 * XSS 노출 면적이 넓어지는데, 그건 접근 토큰을 sessionStorage 로 옮긴 이유와 정면으로 어긋난다.
 * 대신 탭을 닫으면 다시 로그인해야 한다 — 관리자 도구로서는 그편이 맞다.
 */
export function getRefreshToken(): string | null {
  if (typeof window === 'undefined') return null;
  return window.sessionStorage.getItem(REFRESH_KEY);
}

export function setRefreshToken(token: string): void {
  if (typeof window === 'undefined') return;
  window.sessionStorage.setItem(REFRESH_KEY, token);
}

export function clearRefreshToken(): void {
  if (typeof window === 'undefined') return;
  window.sessionStorage.removeItem(REFRESH_KEY);
}
