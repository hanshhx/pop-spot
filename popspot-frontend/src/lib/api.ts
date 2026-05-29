/**
 * API / WebSocket Base URL.
 *
 * env 모듈에서 검증·폴백 처리 후 받아온다. 호출부 (legacy) 호환을 위해 그대로 re-export.
 */
import { env } from './env';

export const API_BASE_URL = env.apiUrl;
export const SOCKET_BASE_URL = env.socketUrl;

const TOKEN_STORAGE_KEY = 'token';
const HEADER_AUTHORIZATION = 'Authorization';
const HEADER_CONTENT_TYPE = 'Content-Type';
const CONTENT_TYPE_JSON = 'application/json';

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
  const url = buildUrl(endpoint);
  const headers = buildHeaders(options, url);

  try {
    const response = await fetch(url, {
      ...options,
      headers,
      credentials: 'include',
    });

    if (!response.ok) {
      console.error(`API Error (${response.status}): ${url}`);
    }
    return response;
  } catch (error) {
    console.error(`Network Error: ${url}`, error);
    throw error;
  }
};

/* ============================== 내부 헬퍼 ============================== */

const buildUrl = (endpoint: string): string =>
  endpoint.startsWith('http') ? endpoint : `${API_BASE_URL}${endpoint}`;

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
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(TOKEN_STORAGE_KEY);
};
