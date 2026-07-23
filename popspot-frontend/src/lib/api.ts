/**
 * API / WebSocket Base URL.
 *
 * env 모듈에서 검증·폴백 처리 후 받아온다. 호출부 (legacy) 호환을 위해 그대로 re-export.
 */
import { env } from './env';
import { clearAuthToken, getAuthToken } from './authStorage';

export const API_BASE_URL = env.apiUrl;
export const SOCKET_BASE_URL = env.socketUrl;

const HEADER_AUTHORIZATION = 'Authorization';
const HEADER_CONTENT_TYPE = 'Content-Type';
const CONTENT_TYPE_JSON = 'application/json';
export const AUTH_EXPIRED_EVENT = 'popspot:auth-expired';

type FetchOptions = RequestInit & { headers?: HeadersInit };

/**
 * 인증 토큰 + 도메인 자동 부착 fetch 래퍼.
 *
 * <p>주요 동작:
 * <ul>
 *   <li>상대 경로 → API_BASE_URL 자동 prefix
 *   <li>localStorage 토큰 → `Authorization: Bearer ...` 자동 부착
 *   <li>FormData 전송 시 Content-Type 헤더 제거 (브라우저가 boundary 포함해 자동 설정하도록)
 *   <li>{@code credentials: 'include'} — 도메인이 달라도 쿠키/인증 정보 유지
 * </ul>
 */
export const apiFetch = async (endpoint: string, options: FetchOptions = {}): Promise<Response> => {
  const url = buildUrl(endpoint, options);
  const headers = buildHeaders(options, url);

  try {
    const response = await fetch(url, {
      ...options,
      headers,
      credentials: 'include',
    });

    if (!response.ok) {
      console.error(`API Error (${response.status}): ${url}`);
      // 서버가 담아준 원인(message)을 콘솔에 그대로 노출 — "400만 보이고 이유를 모르는" 디버깅 공백 제거.
      try {
        const text = await response.clone().text();
        if (text) console.error(`API Error body: ${text.slice(0, 500)}`);
      } catch {
        /* body 읽기 실패는 무시 */
      }
      if (response.status === 401 && readToken()) {
        clearStaleAuthentication();
      }
    }
    return response;
  } catch (error) {
    console.error(`Network Error: ${url}`, error);
    throw error;
  }
};

/* ============================== 내부 헬퍼 ============================== */

/**
 * 브라우저에서도 절대 URL(백엔드 직접 호출)을 반드시 유지해야 하는 경로.
 *
 * <p>업로드 2종 — 백엔드 {@code buildPublicUrl()} 이 요청 호스트를 반사해 응답 URL 을 만든다.
 * 프록시를 경유하면 {@code https://popspot.co.kr/uploads/...} 가 생성되는데 이 경로에는 리라이트가
 * 없어 404 다. 특히 아바타는 그 값이 users.picture 에 영구 저장되므로 코드 롤백으로 복구되지 않는다.
 * 덤으로 프록시 본문 크기 한도도 함께 피한다.
 *
 * <p>관리자 장시간 작업 2종 — 외부 API 를 최대 150회 직렬 호출한다. 엣지 게이트웨이 타임아웃에
 * 걸리면 UI 만 실패로 뜨고 백엔드 작업은 계속 돌아 재실행 중복이 생긴다.
 */
const FORCE_ABSOLUTE_PREFIXES = [
  '/api/v1/users/me/avatar',
  '/api/chat/upload',
  '/api/admin/popups/backfill-photos',
  '/api/admin/popups/dedupe',
] as const;

/**
 * 요청 URL 결정.
 *
 * <p>브라우저에서는 상대 경로를 그대로 둬서 next.config 의 {@code /api/:path*} 리라이트(동일 출처)를
 * 타게 한다. 백엔드로 가는 별도 TLS 핸드셰이크(≈190ms)와 CORS preflight 가 사라지고, 페이지를 받아온
 * 커넥션을 그대로 재사용한다. apiFetch 의 모든 endpoint 가 {@code /api/} 로 시작함을 전수 확인했다.
 *
 * <p>서버(SSR/ISR/route handler)에서는 상대 경로를 fetch 할 수 없으므로 절대 URL 을 유지한다.
 * 현재 apiFetch 를 부르는 서버 실행 경로는 없지만, 향후 추가될 때 조용히 깨지지 않도록 둔다.
 */
const buildUrl = (endpoint: string, options: FetchOptions = {}): string => {
  if (endpoint.startsWith('http')) return endpoint;
  if (typeof window === 'undefined') return `${API_BASE_URL}${endpoint}`;
  // FormData = 업로드. 응답 URL 이 요청 호스트를 반사하므로 프록시를 태우면 안 된다.
  if (options.body instanceof FormData) return `${API_BASE_URL}${endpoint}`;
  if (FORCE_ABSOLUTE_PREFIXES.some((p) => endpoint.startsWith(p)))
    return `${API_BASE_URL}${endpoint}`;
  return endpoint;
};

/**
 * 우리 백엔드(API_BASE_URL) 로 가는 요청인지 판정.
 *
 * <p>상대 경로이거나 API_BASE_URL 로 시작하면 신뢰. 그 외 절대 URL(서드파티)에는 토큰을 절대
 * 싣지 않는다 — 외부 도메인으로 Authorization 헤더가 새는 것을 차단.
 */
const isSameOrigin = (url: string): boolean =>
  !/^https?:\/\//i.test(url) || url.startsWith(API_BASE_URL);

const buildHeaders = (options: FetchOptions, url: string): Record<string, string> => {
  const headers: Record<string, string> = { [HEADER_CONTENT_TYPE]: CONTENT_TYPE_JSON };

  const token = readToken();
  if (token && isSameOrigin(url)) headers[HEADER_AUTHORIZATION] = `Bearer ${token}`;

  Object.assign(headers, options.headers as Record<string, string> | undefined);

  // FormData 는 브라우저가 multipart boundary 를 자동 생성해야 하므로 직접 지정한 Content-Type 을 비운다.
  if (options.body instanceof FormData) {
    delete headers[HEADER_CONTENT_TYPE];
  }
  return headers;
};

const readToken = (): string | null => {
  return getAuthToken();
};

const clearStaleAuthentication = (): void => {
  if (typeof window === 'undefined') return;
  clearAuthToken();
  window.localStorage.removeItem('user');
  window.dispatchEvent(new Event(AUTH_EXPIRED_EVENT));
};
