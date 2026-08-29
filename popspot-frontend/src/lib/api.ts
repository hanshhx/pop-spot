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
import {
  getServiceAvailability,
  serviceUnavailableResponse,
  setServiceAvailability,
} from './serviceAvailability';

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

/**
 * 게이트웨이가 잠깐 백엔드를 못 잡을 때 나오는 상태코드.
 *
 * <p>백엔드는 집 VM 이고 Tailscale Funnel 을 거쳐 나간다. 터널이 순간적으로 원본을 못 잡으면
 * <b>수십 ms 만에</b> 502 가 돌아온다 — 백엔드가 느린 게 아니라 연결 자체가 안 된 것이라 응답이
 * 빠르다. 이건 애플리케이션 오류가 아니라 경로 문제라서, 잠깐 뒤 다시 보내면 대개 붙는다.
 */
const GATEWAY_STATUSES = new Set([502, 503, 504]);

/**
 * 재시도 간격.
 *
 * <p>두 번이었다가 늘렸다. 2026-08-10 에 실측하니 <b>세 번에 한 번</b>이 502 였다 —
 * popspot.co.kr 을 통해 20번 불러 7번 실패. 같은 시각에 백엔드 공개 주소를 직접 20번 불렀을
 * 때는 전부 200 이었으니, 죽는 곳은 백엔드가 아니라 Vercel 이 백엔드로 넘기는 구간이다
 * (X-Vercel-Error: DNS_HOSTNAME_EMPTY / DNS_HOSTNAME_NOT_FOUND).
 *
 * <p>세 번 시도로는 0.35³ ≈ 4%가 그대로 실패한다. 화면 하나가 API 를 여덟 개쯤 부르니 사실상
 * 매번 어딘가는 비어 보인다. 실제로 "새로고침을 해야 지도가 보인다" 는 신고가 그것이었다 —
 * 캐시 문제가 아니라 다시 보내니까 붙은 것이었다.
 *
 * <p>다섯 번이면 0.35⁵ ≈ 0.5% 다. 게이트웨이 502 는 수십 ms 만에 돌아오므로 늘려도 기다림은
 * 거의 늘지 않는다. 진짜로 백엔드가 죽었을 때만 5초 남짓 붙잡히는데, 그 경우는 빈 화면보다
 * 오류 표시가 낫다.
 *
 * <p><b>근본 해결은 아니다.</b> 넘기는 구간을 고쳐야 하고, 이건 그때까지의 가림막이다.
 */
const RETRY_DELAYS_MS = [200, 600, 1500, 3000] as const;

/**
 * 재시도 시각을 흩뜨린다.
 *
 * <p>화면 하나가 지도·목록·혼잡도·찜·티커를 <b>동시에</b> 부른다. 다 같이 502 를 받고 다 같이
 * 300ms 뒤에 다시 보내면, 같은 순간에 같은 구간을 다시 때려 또 같이 실패하기 쉽다. 조금씩
 * 어긋나게 해서 그 한 덩어리를 푼다.
 */
const jittered = (ms: number) => ms + Math.floor(Math.random() * ms * 0.4);

/** 응답이 없어도 안전하게 다시 보낼 수 있는 메서드. */
const IDEMPOTENT_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * <b>요청이 백엔드에 닿기도 전에</b> Vercel 이 포기했음을 뜻하는 오류.
 *
 * <p>Vercel 은 실패 이유를 {@code X-Vercel-Error} 헤더로 알려준다. 값이 {@code DNS_HOSTNAME_*} 이면
 * 넘길 주소를 풀지 못한 것이라, 요청은 <b>엣지 밖으로 나간 적이 없다</b>.
 *
 * <p>이 구분이 중요한 이유는 POST 때문이다. 보통 POST 는 다시 보내지 않는다 — "서버는 처리했는데
 * 응답만 못 돌아온" 502 에서 찜·제보가 두 개 만들어지기 때문이다. 하지만 DNS 단계에서 죽은 요청은
 * 서버가 본 적이 없으니 중복될 것이 없다. <b>로그인이 세 번, 네 번 만에 되던 것</b>이 정확히 이
 * 경우였다 — GET 은 이미 재시도로 가려져 있었고 POST 만 맨몸이었다.
 */
const NOT_DELIVERED_ERRORS = /^DNS_HOSTNAME_/i;

/**
 * 이 응답은 "백엔드가 못 받았다" 가 증명되는가.
 *
 * <p>증명되지 않으면 false 다 — 애매하면 다시 보내지 않는 쪽이 안전하다.
 */
const provablyNotDelivered = (response: Response): boolean =>
  NOT_DELIVERED_ERRORS.test(response.headers.get('x-vercel-error') ?? '');

/**
 * 요청 하나가 끝나기를 기다리는 최대 시간.
 *
 * <p>이게 없으면 터널이 붙잡고 놓지 않을 때 화면이 <b>영원히 로딩</b>이다. 사용자는 무엇이
 * 잘못됐는지 알 수 없고 새로고침만 반복한다. 끊어서 catch 로 보내면 최소한 오류 처리가 돈다.
 */
const REQUEST_TIMEOUT_MS = 12_000;

/**
 * 재시도를 포함한 전체 마감.
 *
 * <p>한 번의 타임아웃(12초)보다는 넉넉하되, 사람이 "고장 났나" 싶어지기 전에는 끝나야 한다.
 * 게이트웨이 502 는 수십 ms 만에 돌아오므로 실제로는 이 한도에 닿지 않는다 — 터널이 연결을
 * 붙잡는 드문 경우에만 걸린다.
 */
const TOTAL_RETRY_BUDGET_MS = 20_000;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

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
  // 장애가 이미 확인된 탭에서는 같은 502를 만드는 요청을 더 보내지 않는다.
  // 상태 확인 라우트는 apiFetch를 사용하지 않으므로 복구 감지는 계속 작동한다.
  if (typeof window !== 'undefined' && getServiceAvailability() === 'unavailable') {
    return serviceUnavailableResponse();
  }

  const url = buildUrl(endpoint, options);
  const headers = buildHeaders(options, url);

  // 요청을 보낸 시점의 토큰. 응답이 돌아왔을 때 이 값과 현재 토큰이 같을 때만 정리한다 — 응답을
  // 기다리는 사이 사용자가 재로그인했다면 방금 받은 새 토큰을 지워버리면 안 된다.
  const tokenAtRequest = readToken();
  if (tokenAtRequest) authExpiryHandled = false;

  try {
    const response = await fetchWithRetry(url, options, headers);

    if (typeof window !== 'undefined') {
      if (GATEWAY_STATUSES.has(response.status)) {
        setServiceAvailability('unavailable');
      } else if (response.status < 500) {
        // 2xx·4xx는 백엔드까지 연결됐다는 증거다. 500은 Vercel 프록시가
        // 만들 수도 있으므로, 전용 health 확인이 내린 장애 판정을 덮지 않는다.
        setServiceAvailability('available');
      }
    }

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
    // 직행이 네트워크 단계에서 죽었다면, 이 브라우저는 ts.net 을 못 쓴다는 뜻이다(차단·DNS).
    // 백엔드가 죽은 게 아니라 우리 경로가 막힌 것이므로 장애로 기록하지 않는다 — 여기서
    // setServiceAvailability('unavailable') 를 부르면 멀쩡한 서버를 두고 배너가 뜨고 탭이 잠긴다.
    if (typeof window !== 'undefined' && !options.signal?.aborted && isDirectBackendUrl(url)) {
      directBackendUsable = false;
      console.warn(`백엔드 직행이 막혀 리라이트로 되돌립니다: ${endpoint}`);
      // 막힌 요청은 한 바이트도 나가지 않아 서버가 본 적이 없다. 다만 그것이 증명되는 것은
      // 전송 전에 죽었을 때뿐이고 브라우저는 그 둘을 구분해 주지 않는다. 그래서 멱등 메서드만
      // 자동으로 다시 보내고, 나머지는 판정만 남긴다 — 다음 요청부터 리라이트를 탄다.
      if (IDEMPOTENT_METHODS.has((options.method ?? 'GET').toUpperCase())) {
        return apiFetch(endpoint, options);
      }
      throw error;
    }
    if (typeof window !== 'undefined' && !options.signal?.aborted) {
      setServiceAvailability('unavailable');
    }
    console.error(`Network Error: ${url}`, error);
    throw error;
  }
};

/* ============================== 내부 헬퍼 ============================== */

/**
 * 게이트웨이 순간 장애를 흡수하는 fetch.
 *
 * <p><b>왜 필요한가.</b> 로그인·목록이 가끔 502 로 실패한다는 신고가 있었고, 실측해 보니
 * {@code /api/map/markers} 가 <b>12ms 만에</b> 502 를 돌려줬다. 그 속도는 백엔드가 느린 게 아니라
 * Funnel 이 원본에 연결조차 못 했다는 뜻이다. 잠깐 뒤 다시 보내면 붙는 종류의 실패다.
 *
 * <p><b>GET 계열만 다시 보낸다.</b> POST 를 재시도하면 "서버는 처리했는데 응답만 못 돌아온" 502
 * 에서 같은 것이 두 번 만들어진다. 찜·코스·제보가 중복되는 편이 502 한 번보다 나쁘다.
 *
 * <p><b>타임아웃을 함께 건다.</b> 재시도만 넣고 타임아웃이 없으면, 터널이 연결을 붙잡고 놓지 않는
 * 경우 첫 시도에서 영원히 멈춰 재시도까지 가지도 못한다. 호출부가 자기 signal 을 넘겼으면 그것을
 * 존중하고 타임아웃을 걸지 않는다 — 취소 주체가 둘이 되면 원인을 구분할 수 없다.
 */
const fetchWithRetry = async (
  url: string,
  options: FetchOptions,
  headers: HeadersInit,
): Promise<Response> => {
  const method = (options.method ?? 'GET').toUpperCase();
  const canRetry = IDEMPOTENT_METHODS.has(method);

  /*
   * 전체 마감 시각.
   *
   * 시도 횟수를 늘리면서 필요해졌다. 게이트웨이 502 는 수십 ms 만에 돌아오니 다섯 번을 돌아도
   * 순식간이지만, 터널이 연결을 붙잡는 경우에는 시도마다 타임아웃(12초)을 다 쓴다. 그러면
   * 최악이 12×5 + 대기 5.3 ≈ 65초다. 그렇게 오래 도는 화면은 고장 난 것과 같다.
   *
   * 그래서 횟수와 별개로 전체 시간을 묶는다. 남은 시간이 없으면 마지막 응답을 그대로 돌려준다.
   */
  const deadline = Date.now() + TOTAL_RETRY_BUDGET_MS;
  const outOfTime = () => Date.now() >= deadline;

  let lastError: unknown;
  for (let attempt = 0; ; attempt++) {
    if (
      attempt > 0 &&
      typeof window !== 'undefined' &&
      getServiceAvailability() === 'unavailable'
    ) {
      return serviceUnavailableResponse();
    }
    try {
      const response = await fetch(url, {
        ...options,
        headers,
        credentials: 'include',
        signal: options.signal ?? AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      if (!GATEWAY_STATUSES.has(response.status)) return response;
      // 멱등 메서드가 아니어도, 백엔드가 받은 적이 없음이 증명되면 다시 보낸다.
      if (!canRetry && !provablyNotDelivered(response)) return response;
      if (attempt >= RETRY_DELAYS_MS.length || outOfTime()) return response;
      console.warn(
        `게이트웨이 ${response.status} — ${RETRY_DELAYS_MS[attempt]}ms 뒤 재시도 (${attempt + 1}/${RETRY_DELAYS_MS.length}): ${url}`,
      );
    } catch (error) {
      // 네트워크 끊김·타임아웃도 같은 취급. 다만 호출부가 명시적으로 취소한 것은 재시도하지 않는다.
      if (options.signal?.aborted) throw error;
      lastError = error;
      if (!canRetry || attempt >= RETRY_DELAYS_MS.length || outOfTime()) throw error;
      console.warn(
        `요청 실패 — ${RETRY_DELAYS_MS[attempt]}ms 뒤 재시도 (${attempt + 1}/${RETRY_DELAYS_MS.length}): ${url}`,
      );
    }
    await sleep(jittered(RETRY_DELAYS_MS[attempt]));
    void lastError;
  }
};

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
 * 리라이트를 건너뛰고 백엔드를 직접 부를 출처.
 *
 * <p>여기에 있는 호스트에서만 직접 호출로 돌린다. 백엔드의 {@code app.allowed-origins} 가 허용하는
 * 출처와 <b>정확히 같아야</b> 하기 때문이다 — 프리뷰 배포({@code *.vercel.app})나 로컬은 허용 목록에
 * 없어서 직접 부르면 CORS 로 전부 막힌다. 실측으로 확인한 값만 넣는다(2026-08-28: 이 출처로
 * {@code Access-Control-Allow-Origin: https://popspot.co.kr} 와 preflight 200 을 받았다).
 */
const DIRECT_BACKEND_HOSTS = new Set(['popspot.co.kr']);

/**
 * 이 요청을 백엔드로 직접 보낼 것인가.
 *
 * <p><b>왜 이런 것이 생겼나.</b> 운영에서 브라우저가 {@code /api/*} 를 부르면 Vercel 엣지가
 * {@code rewrites()} 로 백엔드에 넘긴다. 그런데 <b>Vercel 의 리졸버가 백엔드 호스트명(ts.net)을
 * 못 푼다.</b> 실측(2026-08-28): popspot.co.kr 경유 12번 중 10번이 502 였고 실패는 전부
 * {@code X-Vercel-Error: DNS_HOSTNAME_EMPTY / DNS_HOSTNAME_NOT_FOUND} 였다. 같은 시각 같은
 * 백엔드를 브라우저와 같은 자격으로 직접 부르면 <b>5번 중 5번 200</b>, 응답 0.19초였다.
 * 즉 백엔드도 터널도 멀쩡하고, 못 푸는 것은 Vercel 하나다.
 *
 * <p>브라우저는 이 이름을 잘 푼다. 그래서 엣지를 빼면 문제가 사라진다. 이미 부분적으로 그러고
 * 있기도 하다 — 업로드 2종은 {@link FORCE_ABSOLUTE_PREFIXES} 로, 채팅 소켓은
 * {@code wss://*.ts.net} 으로 원래 직접 붙는다.
 *
 * <p><b>공짜는 아니다.</b> 동일 출처를 버리므로 TLS 핸드셰이크와 preflight 가 늘고(백엔드가
 * {@code Access-Control-Max-Age: 3600} 을 주므로 preflight 는 한 시간에 한 번이다), 사용자
 * 네트워크가 ts.net 을 막으면 그 사용자는 사이트 전체를 잃는다(전에는 채팅·업로드만 잃었다).
 * 리라이트가 83% 실패하는 상태보다는 낫지만, <b>이건 임시 우회다.</b> 백엔드를 Vercel 이 잘 푸는
 * 이름으로 옮기면 되돌려야 한다.
 *
 * <p><b>지금은 꺼져 있다.</b> 리라이트가 무너졌을 때 급히 켰던 우회로이고, 그 자리는 이제
 * {@code app/api/[...path]/route.ts} 프록시가 맡는다. 프록시는 동일 출처라 아래 두 대가를 치르지
 * 않는다.
 *
 * <ul>
 *   <li><b>레이트리밋.</b> 직행은 {@code proxy.ts} 미들웨어를 건너뛰어 서명된 {@code x-edge-ip} 가
 *       빠진다. 그러면 백엔드가 IP 를 {@code remoteAddr} 로 강등해 <b>전 사용자가 바구니 하나</b>를
 *       공유한다(인증메일 시간당 5회가 전체 합산이 된다).
 *   <li><b>도달성.</b> 어떤 브라우저는 ts.net 을 통째로 막는다.
 * </ul>
 *
 * <p>켜는 법(비상용): Vercel 환경변수 {@code NEXT_PUBLIC_API_DIRECT=1} 후 재배포. 프록시가
 * 통째로 고장 났는데 백엔드는 멀쩡할 때만 쓴다 — 코드 수정 없이 경로를 갈아탈 수 있다.
 */
export const shouldUseDirectBackend = (hostname: string, enableFlag?: string): boolean =>
  enableFlag === '1' && DIRECT_BACKEND_HOSTS.has(hostname);

/**
 * 이 브라우저에서 직행이 실제로 통하는가.
 *
 * <p><b>이건 빌드 시점에 정할 수 없는 값이다.</b> 답이 사용자마다 다르기 때문이다. 어떤 사용자는
 * 엣지 리라이트가 83% 실패하고(Vercel 이 ts.net 을 못 푼다), 어떤 사용자는 브라우저·확장·회사
 * 네트워크가 ts.net 을 통째로 막는다. 실제로 확인 중에 후자를 만났다 — 교차 출처 자체는 멀쩡한데
 * ({@code protomaps.github.io} 는 응답이 왔다) ts.net 만 {@code ERR_BLOCKED_BY_CLIENT} 로
 * 죽었고, CORS 를 건너뛰는 {@code mode:'no-cors'} 조차 실패했다(전송 0바이트).
 *
 * <p>그래서 낙관적으로 시작하고, 한 번 막히면 그 세션 동안 리라이트로 되돌린다. 판정은 로그인보다
 * 훨씬 먼저 끝난다 — 화면 하나가 GET 을 여러 개 부르므로, 사람이 로그인 버튼을 누를 때쯤이면
 * 이 값은 이미 정해져 있다.
 */
let directBackendUsable = true;

/** 테스트가 세션 판정을 되돌릴 때만 쓴다. */
export function resetDirectBackendForTest(): void {
  directBackendUsable = true;
}

const directBackendEnabled = (): boolean =>
  directBackendUsable &&
  typeof window !== 'undefined' &&
  shouldUseDirectBackend(window.location.hostname, process.env.NEXT_PUBLIC_API_DIRECT);

/** 이 URL 이 백엔드 직행인가(= 리라이트로 되돌릴 여지가 있는가). */
const isDirectBackendUrl = (url: string): boolean =>
  directBackendUsable && !!API_BASE_URL && url.startsWith(API_BASE_URL);

/**
 * 요청 URL 결정.
 *
 * <p>기본은 상대 경로다. next.config 의 {@code /api/:path*} 리라이트(동일 출처)를 타면 백엔드로 가는
 * 별도 TLS 핸드셰이크(≈190ms)와 CORS preflight 가 사라지고, 페이지를 받아온 커넥션을 그대로
 * 재사용한다. apiFetch 의 모든 endpoint 가 {@code /api/} 로 시작함을 전수 확인했다.
 *
 * <p>다만 그 리라이트가 지금 운영에서 깨져 있어({@link directBackendEnabled} 참고) 운영 출처에서는
 * 절대 URL 로 우회한다.
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
  if (directBackendEnabled()) return `${API_BASE_URL}${endpoint}`;
  return endpoint;
};

/**
 * {@link apiFetch} 를 거치지 않고 직접 {@code fetch} 하는 곳이 쓸 주소 헬퍼.
 *
 * <p>티커·혼잡도·방문기록은 인증도 재시도도 필요 없어서 순수 {@code fetch} 를 쓴다. 그래도 주소를
 * 고르는 규칙만은 같아야 한다 — 안 그러면 이 셋만 깨진 리라이트에 남아, 로그인은 되는데 화면 일부가
 * 계속 비는 상태가 된다. 실제로 그랬다(콘솔에 {@code Ticker API 502}, {@code /api/congestion} 502).
 */
export const apiUrl = (endpoint: string): string => buildUrl(endpoint);

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
