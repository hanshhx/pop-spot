import { getAuthToken } from './authStorage';
import { API_BASE_URL } from './env';

/**
 * 서버에 요청 하나 보내기 — 웹 {@code lib/api.ts} 의 앱 판.
 *
 * <p>웹의 그 파일은 700줄이 넘는다. 인증 만료·토큰 재발급·관리자 403 구분·게이트웨이 재시도·
 * 장애 상태 공유가 전부 들어 있다. 여기로 <b>전부 옮기지 않았다</b> — 앱에 아직 없는 화면(관리자)의
 * 분기까지 미리 옮기면, 두 파일이 갈렸을 때 어느 쪽이 맞는지 알 수 없게 된다. 지금 앱이 실제로
 * 겪는 것만 옮기고, 화면이 생길 때 그 조각을 가져온다.
 *
 * <p>옮긴 것은 <b>재시도와 타임아웃</b>이다. 이 둘은 앱이 웹보다 더 자주 겪는다 — 지하철에서 켜는
 * 앱이라 연결이 끊겼다 붙었다 한다.
 */

/**
 * 게이트웨이가 잠깐 백엔드를 못 잡을 때 나오는 상태코드.
 *
 * <p>백엔드는 집 VM 이고 Tailscale Funnel 을 거쳐 나간다. 터널이 순간적으로 원본을 못 잡으면
 * <b>수십 ms 만에</b> 502 가 돌아온다 — 느린 게 아니라 연결 자체가 안 된 것이라 응답이 빠르다.
 * 애플리케이션 오류가 아니라 경로 문제라서, 잠깐 뒤 다시 보내면 대개 붙는다.
 */
const GATEWAY_STATUSES = new Set([502, 503, 504]);

/**
 * 재시도 간격.
 *
 * <p>웹에서 실측한 값을 그대로 쓴다 — 2026-08-10 에 popspot.co.kr 을 통해 20번 불러 7번이 502 였다.
 * 세 번 시도로는 0.35³ ≈ 4% 가 그대로 실패하고, 화면 하나가 API 를 여러 개 부르니 사실상 매번
 * 어딘가는 비어 보인다. 다섯 번이면 0.5% 다. 게이트웨이 502 는 수십 ms 만에 돌아오므로 늘려도
 * 기다림은 거의 늘지 않는다.
 */
const RETRY_DELAYS_MS = [200, 600, 1500, 3000] as const;

/**
 * 재시도 시각을 흩뜨린다.
 *
 * <p>화면 하나가 지도·목록·찜을 <b>동시에</b> 부른다. 다 같이 502 를 받고 다 같이 200ms 뒤에 다시
 * 보내면 같은 순간에 같은 구간을 또 때린다. 조금씩 어긋나게 해서 그 덩어리를 푼다.
 */
const jittered = (ms: number) => ms + Math.floor(Math.random() * ms * 0.4);

/**
 * 요청 하나가 끝나기를 기다리는 최대 시간.
 *
 * <p>이게 없으면 터널이 붙잡고 놓지 않을 때 화면이 <b>영원히 로딩</b>이다. 끊어서 예외로 보내면
 * 최소한 "다시 시도" 를 그릴 수 있다.
 */
const REQUEST_TIMEOUT_MS = 12_000;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** 응답이 없어도 안전하게 다시 보낼 수 있는 메서드. */
const IDEMPOTENT_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/**
 * 로그인 토큰을 헤더에 싣는다.
 *
 * <p>부르는 쪽이 매번 붙이게 두면 <b>반드시 어딘가 빠진다</b> — 빠진 자리는 401 로 드러나는데,
 * 그 401 이 "로그인 안 됨" 인지 "헤더를 안 붙임" 인지 화면에서는 구별되지 않는다.
 *
 * <p>부르는 쪽이 이미 {@code Authorization} 을 넣었으면 건드리지 않는다 — 관리자 화면처럼 다른
 * 토큰을 쓰는 경우를 막지 않기 위해서다.
 */
async function withAuth(init: RequestInit): Promise<RequestInit> {
  const headers = new Headers(init.headers ?? {});
  if (headers.has('Authorization')) return init;

  const token = await getAuthToken();
  if (!token) return init;

  headers.set('Authorization', `Bearer ${token}`);
  return { ...init, headers };
}

/** 한 번 보내고 타임아웃을 건다. */
async function once(path: string, init: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(`${API_BASE_URL}${path}`, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * 게이트웨이가 흔들리는 동안 다시 보낸다.
 *
 * <p>POST 는 다시 보내지 않는다 — "서버는 처리했는데 응답만 못 돌아온" 502 에서 찜·제보가 두 개
 * 만들어진다. 웹은 {@code X-Vercel-Error: DNS_HOSTNAME_*} 으로 "요청이 백엔드에 닿은 적 없음" 을
 * 증명할 수 있을 때만 POST 도 재시도하는데, 그 헤더 판정은 앱에 POST 화면이 생길 때 함께 옮긴다.
 */
export async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const method = (init.method ?? 'GET').toUpperCase();
  const retryable = IDEMPOTENT_METHODS.has(method);
  const authed = await withAuth(init);

  for (let attempt = 0; ; attempt += 1) {
    try {
      const response = await once(path, authed);
      if (!GATEWAY_STATUSES.has(response.status)) return response;
      if (!retryable || attempt >= RETRY_DELAYS_MS.length) return response;
    } catch (error) {
      if (!retryable || attempt >= RETRY_DELAYS_MS.length) throw error;
    }
    await sleep(jittered(RETRY_DELAYS_MS[attempt]));
  }
}

/** JSON 을 받는다. 2xx 가 아니면 {@link ApiError}. */
export async function apiJson<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await apiFetch(path, init);
  if (!response.ok) throw new ApiError(response.status, `${path} ${response.status}`);
  return (await response.json()) as T;
}
