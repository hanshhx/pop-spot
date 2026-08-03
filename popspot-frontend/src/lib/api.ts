/**
 * API / WebSocket Base URL.
 *
 * env 모듈에서 검증·폴백 처리 후 받아온다. 호출부 (legacy) 호환을 위해 그대로 re-export.
 */
import { env } from './env';
import {
  clearAuthToken,
  getAuthToken,
  getRefreshToken,
  setAuthToken,
  setRefreshToken,
} from './authStorage';

export const API_BASE_URL = env.apiUrl;
export const SOCKET_BASE_URL = env.socketUrl;

const HEADER_AUTHORIZATION = 'Authorization';
const HEADER_CONTENT_TYPE = 'Content-Type';
const CONTENT_TYPE_JSON = 'application/json';
export const AUTH_EXPIRED_EVENT = 'popspot:auth-expired';

/**
 * 관리자 전용 영역 — 권한 없는 일반 사용자가 눌러도 403 이 나오는 게 정상이다.
 * (SecurityConfig: {@code /api/admin/**}, {@code /actuator/**} = {@code hasRole("ADMIN")})
 *
 * <p>여기서 로그아웃시키면 "권한 없음"이 "세션 만료"로 둔갑해 멀쩡한 로그인이 풀린다.
 */
const ADMIN_ONLY_PREFIXES = ['/api/admin/', '/actuator/'] as const;

/**
 * 403 본문이 "권한"이 아니라 "인증 자체가 끝났다"고 말하는 경우에만 매칭.
 *
 * <p>백엔드 403 본문은 {@code {"error":"Forbidden","message":"접근 권한이 없습니다."}} 로 고정이라
 * 이 패턴에 걸리지 않는다(= 권한 문제는 절대 로그아웃되지 않는다).
 */
const SESSION_GONE_BODY_PATTERN = /만료|인증이 필요|expired|unauthorized|invalid[\s_-]?token/i;

/**
 * 만료 처리(토큰 정리 + 이벤트)를 이미 한 번 돌렸는지.
 *
 * <p>탭 하나에서 찜·코스·여권 API 가 동시에 401 을 맞으면 재로그인 안내가 여러 번 뜬다. 요청 시작
 * 시점에 토큰이 살아 있으면 풀어주므로, 재로그인 후의 다음 만료는 다시 안내된다.
 */
let authExpiryHandled = false;

type FetchOptions = RequestInit & { headers?: HeadersInit };

/**
 * 이 응답이 "세션이 끝난 것"인지 "권한이 모자란 것"인지 판정.
 *
 * <p>401 = 무조건 세션 끝. 백엔드는 토큰이 없거나 만료·위조된 경우에만 401 을 준다
 * ({@code JwtAuthenticationFilter}, {@code SecurityConfig#apiUnauthorizedEntryPoint}).
 *
 * <p>403 은 기본적으로 "권한 부족"이라 로그아웃시키지 않는다 — 일반 사용자가 관리자 기능을 호출하는
 * 정상 시나리오가 여기다. 다만 중간 경로(Vercel rewrite · Tailscale Funnel)가 우리 JSON 없이 403 으로
 * 끊는 경우가 있어, <b>본문이 만료를 명시할 때만</b> 예외적으로 세션 만료로 본다. 애매하면 로그아웃시키지
 * 않는 쪽 — 멀쩡한 세션을 끊는 비용이 만료된 세션을 잠깐 더 두는 비용보다 크다.
 *
 * @param endpoint 호출부가 넘긴 원본 경로. apiFetch 의 모든 endpoint 가 {@code /api/} 로 시작한다
 *     (buildUrl 주석 참고)
 */
const isSessionGone = (status: number, endpoint: string, body: string): boolean => {
  if (status === 401) return true;
  if (status !== 403) return false;
  if (ADMIN_ONLY_PREFIXES.some((prefix) => endpoint.startsWith(prefix))) return false;
  return SESSION_GONE_BODY_PATTERN.test(body);
};

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

  // 요청을 보낸 시점의 토큰. 응답이 돌아왔을 때 이 값과 현재 토큰이 같을 때만 정리한다 — 응답을
  // 기다리는 사이 사용자가 재로그인했다면 방금 받은 새 토큰을 지워버리면 안 된다.
  const tokenAtRequest = readToken();
  if (tokenAtRequest) authExpiryHandled = false;

  try {
    const response = await fetch(url, {
      ...options,
      headers,
      credentials: 'include',
    });

    if (!response.ok) {
      console.error(`API Error (${response.status}): ${url}`);
      // 서버가 담아준 원인(message)을 콘솔에 그대로 노출 — "400만 보이고 이유를 모르는" 디버깅 공백 제거.
      // 401/403 판정도 같은 본문을 쓴다. clone 한 번만 읽으므로 호출부의 response.json() 은 그대로 산다.
      let body = '';
      try {
        body = await response.clone().text();
        if (body) console.error(`API Error body: ${body.slice(0, 500)}`);
      } catch {
        /* body 읽기 실패는 무시 — 판정은 상태코드/경로만으로 진행 */
      }
      if (
        tokenAtRequest &&
        readToken() === tokenAtRequest &&
        isSessionGone(response.status, endpoint, body)
      ) {
        // 세션이 끝났다고 곧바로 내보내지 않는다. 리프레시 토큰이 있으면 한 번 갱신해 보고,
        // 성공하면 원래 요청을 그대로 다시 보낸다. 관리자 접근 토큰은 30분짜리라 이 과정이
        // 없으면 작업 중에 30분마다 튕긴다.
        const renewed = await tryRefresh(endpoint);
        if (renewed) {
          return apiFetch(endpoint, options);
        }
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
 * 갱신이 동시에 여러 번 일어나지 않게 묶는다.
 *
 * <p>탭 하나에서 여러 API 가 동시에 401 을 맞으면 갱신 요청이 그 수만큼 나간다. 리프레시 토큰은
 * <b>한 번 쓰면 새것으로 바뀌므로</b>(rotation), 동시에 여러 번 보내면 첫 요청만 성공하고 나머지는
 * 이미 없어진 토큰으로 실패해 멀쩡한 세션이 끊긴다.
 */
let refreshInFlight: Promise<boolean> | null = null;

/**
 * 접근 토큰 갱신 시도.
 *
 * @returns 갱신에 성공해 원래 요청을 다시 보낼 수 있으면 true
 */
const tryRefresh = async (endpoint: string): Promise<boolean> => {
  if (typeof window === 'undefined') return false;
  // 갱신 요청 자체가 401 을 맞았다면 리프레시 토큰도 만료된 것이다. 재귀를 끊는다.
  if (endpoint.includes('/auth/refresh')) return false;

  const refreshToken = getRefreshToken();
  if (!refreshToken) return false;

  if (!refreshInFlight) {
    refreshInFlight = (async () => {
      try {
        const res = await apiFetch('/api/v1/auth/refresh', {
          method: 'POST',
          body: JSON.stringify({ refreshToken }),
        });
        if (!res.ok) return false;
        const data = (await res.json()) as { token?: string; refreshToken?: string };
        if (!data.token) return false;
        setAuthToken(data.token);
        if (data.refreshToken) setRefreshToken(data.refreshToken);
        return true;
      } catch {
        return false;
      } finally {
        refreshInFlight = null;
      }
    })();
  }
  return refreshInFlight;
};

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

/**
 * 만료된 인증 정보를 지우고 재로그인 안내 이벤트를 발행.
 *
 * <p>UI 는 건드리지 않는다 — 안내 문구는 이벤트를 받는 AuthGuard 가 기존 notify 유틸로 띄운다.
 * api.ts 는 서버 실행 경로에서도 import 되므로 sweetalert2 를 여기로 끌어오지 않는다.
 */
const clearStaleAuthentication = (): void => {
  if (typeof window === 'undefined') return;
  if (authExpiryHandled) return; // 동시 요청이 함께 401 을 맞아도 안내는 한 번만.
  authExpiryHandled = true;
  clearAuthToken();
  window.localStorage.removeItem('user');
  window.dispatchEvent(new Event(AUTH_EXPIRED_EVENT));
};
