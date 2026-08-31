import { request as httpRequest } from 'node:http';
import type { IncomingHttpHeaders, IncomingMessage } from 'node:http';
import { request as httpsRequest } from 'node:https';
import { Readable } from 'node:stream';
import type { NextRequest } from 'next/server';

import { createBackendLookup } from '@/lib/backendDns';

/**
 * {@code /api/*} 를 백엔드로 넘기는 프록시.
 *
 * <p><b>왜 리라이트가 아니라 이것인가.</b> 예전에는 {@code next.config.ts} 의 {@code rewrites()} 가
 * 이 일을 했다. 그런데 그 리라이트는 <b>Vercel 엣지</b>에서 실행되고, 엣지의 리졸버가 백엔드
 * 호스트명(ts.net)을 못 푼다. 실측(2026-08-28)으로 20번 중 14번이 502 였고 실패는 전부
 * {@code X-Vercel-Error: DNS_HOSTNAME_EMPTY / DNS_HOSTNAME_NOT_FOUND} 였다.
 *
 * <p>결정적으로 <b>엣지 리라이트는 우리가 손댈 수 없다.</b> Vercel 이 502 를 만들어 버리면 그걸로
 * 끝이다. 반면 Node 런타임에서는 우리가 다시 보낼 수 있고, 아래처럼 <b>이름 해석까지 우리 손으로</b>
 * 가져올 수 있다.
 *
 * <p><b>브라우저 직행이 아니라 이것인 이유.</b> 브라우저가 백엔드를 직접 부르면 Vercel 이 통째로
 * 빠지지만 두 가지를 잃는다. 하나는 {@code proxy.ts} 미들웨어다 — 그것이 붙이는 서명된
 * {@code x-edge-ip} 가 없으면 백엔드가 IP 를 {@code remoteAddr} 로 강등하고, 그러면
 * <b>전 사용자가 레이트리밋 바구니 하나를 공유</b>한다(인증메일 시간당 5회가 전체 합산이 된다).
 * 다른 하나는 도달성이다 — 어떤 브라우저는 ts.net 을 {@code ERR_BLOCKED_BY_CLIENT} 로 통째로
 * 막는다(실측: 교차 출처 자체는 멀쩡한데 그 호스트만, {@code mode:'no-cors'} 조차 전송 0바이트).
 * 동일 출처로 돌아오면 둘 다 해결된다.
 *
 * <p><b>여기를 지나지 않는 것들.</b> 업로드 2종과 관리자 장시간 작업 2종은
 * {@code api.ts} 의 {@code FORCE_ABSOLUTE_PREFIXES} 로 여전히 직행한다(응답 URL 이 요청 호스트를
 * 반사하는 문제와 본문 크기·시간 제한 때문이다). 관리자 로그 SSE 도 절대 URL 로 직행한다.
 * 채팅 WebSocket 은 애초에 {@code wss://} 로 붙어 프록시 대상이 아니다.
 */

export const dynamic = 'force-dynamic';

/**
 * <b>실행 리전은 여기가 아니라 {@code vercel.json} 의 {@code regions} 가 정한다.</b>
 *
 * <p>Vercel 서버리스의 기본 리전은 {@code iad1}(미국 워싱턴)이다. 그대로 두면 사용자도 백엔드도
 * 한국에 있는데 경로가 태평양을 두 번 건넌다 — 브라우저(한국) → 엣지(서울) → 함수(미국) →
 * 백엔드(한국). 응답 헤더 {@code X-Vercel-Id: icn1::iad1::...} 가 그것을 그대로 보여준다
 * (앞이 들어온 곳, 뒤가 실행된 곳). 실측(2026-08-28) {@code /api/popups} 한 건이 2.3~7.4초였고,
 * 같은 요청을 백엔드에 직접 부르면 0.2초다.
 *
 * <p>처음에는 Next.js 의 {@code export const preferredRegion} 을 썼는데 <b>적용되지 않았다</b> —
 * 배포 11시간 뒤에도 {@code icn1::iad1::} 그대로였다. 그 설정은 Node 런타임 서버리스 함수에는
 * 걸리지 않는다. 여기에 다시 쓰지 말 것 — 조용히 무시된다.
 */

const BACKEND = (process.env.NEXT_PUBLIC_API_URL ?? '').replace(/\/+$/, '');

function backendHostname(base: string): string {
  try {
    return new URL(base).hostname;
  } catch {
    return '';
  }
}

/**
 * 백엔드 이름을 <b>우리가 직접</b> 푼다.
 *
 * <p>{@code fetch} 를 버리고 {@code node:https} 로 내려온 유일한 이유가 이것이다. Node 의
 * {@code fetch} 는 이름 해석에 {@code dns.lookup}(= OS 의 {@code getaddrinfo}) 만 쓰고, 그것은
 * Vercel 이 함수 컨테이너에 꽂아 준 리졸버로 간다. 그 리졸버가 ts.net 을 못 푸는 구간이 있다 —
 * 2026-08-31 11:36~11:57 실측으로 <b>21분간 전건 실패</b>({@code ENOTFOUND}). 같은 시각 공개
 * DNS 도 공인 IP 직접 접속도 멀쩡했다. {@code node:https} 는 {@code lookup} 을 갈아 끼울 수 있어
 * 그 리졸버를 통째로 건너뛴다. 경위와 근거는 {@link createBackendLookup} 에 적어 두었다.
 */
const backendLookup = createBackendLookup(backendHostname(BACKEND));

/**
 * 백엔드로 넘기지 않는 요청 헤더.
 *
 * <p>{@code host} 를 그대로 넘기면 백엔드가 자기 주소를 popspot.co.kr 로 착각한다.
 * {@code content-length} 는 우리가 본문을 다시 만들어 보내므로 원래 값이 맞지 않는다.
 * {@code accept-encoding} 을 떼는 이유는 <b>압축을 받지 않기 위해서</b>다 — {@code node:https} 는
 * {@code fetch} 와 달리 압축을 풀어 주지 않으므로, 받으면 그대로 흘려보내다 브라우저에서 깨진다.
 */
const DROP_REQUEST_HEADERS = new Set([
  'host',
  'connection',
  'content-length',
  'accept-encoding',
  'transfer-encoding',
]);

/**
 * 브라우저로 돌려주지 않는 응답 헤더.
 *
 * <p>본문을 우리가 다시 흘려보내므로 길이와 전송 방식은 원래 값과 어긋난다. 연결 관리 헤더는
 * 백엔드와 우리 사이의 이야기라 브라우저까지 갈 필요가 없다.
 */
const DROP_RESPONSE_HEADERS = new Set([
  'content-encoding',
  'content-length',
  'transfer-encoding',
  'connection',
  'keep-alive',
]);

/** 본문이 있을 수 없는 응답. 여기에 본문을 붙이면 {@code Response} 생성자가 던진다. */
const BODYLESS_STATUSES = new Set([204, 205, 304]);

/** 다시 보내기까지의 간격. 이 실패는 수십 ms 만에 돌아오므로 짧게 잡아도 된다. */
const RETRY_DELAYS_MS = [150, 400, 900] as const;

/**
 * 서버리스 함수가 물려 있을 수 있는 최대 시간보다 넉넉히 앞서 끝낸다.
 *
 * <p>이 한도를 넘기면 사용자에게는 함수 타임아웃(504)이 가는데, 그건 우리가 만든 오류 메시지보다
 * 훨씬 알아보기 어렵다.
 *
 * <p><b>{@code request.setTimeout} 으로 재지 말 것.</b> 그것은 "소켓이 배정되고 <b>연결된 뒤</b>"
 * 부터 도는 유휴 시간이라, 정작 연결이 안 맺어지는 구간을 덮지 못한다 — 실측으로 5초를 걸어 둔
 * 요청이 OS 의 연결 제한(21초)까지 갔다. 지금 겪는 장애가 바로 그 구간이므로 여기서는
 * {@code AbortSignal} 로 <b>전 구간</b>을 덮는다({@code fetch} 시절과 같은 성질).
 */
const UPSTREAM_TIMEOUT_MS = 9_000;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * 오류에서 코드를 꺼낸다.
 *
 * <p>{@code node:https} 는 {@code error.code} 에 바로 담고, {@code fetch}(undici)는 한 겹 안쪽
 * {@code error.cause.code} 에 담는다. 이 프록시는 전자를 쓰지만 둘 다 본다 — 나중에 누가
 * {@code fetch} 로 되돌려도 이 판정이 조용히 무력해지지 않도록.
 */
function errorCode(error: unknown): string | undefined {
  const direct = (error as { code?: unknown })?.code;
  if (typeof direct === 'string') return direct;
  const nested = (error as { cause?: { code?: unknown } })?.cause?.code;
  return typeof nested === 'string' ? nested : undefined;
}

/**
 * 이 오류는 <b>요청이 백엔드에 닿은 적이 없음</b>을 뜻하는가.
 *
 * <p>이 구분이 있어야 POST 도 다시 보낼 수 있다. 이름을 못 풀었거나 연결 자체가 거절됐다면 서버는
 * 그 요청을 본 적이 없으므로 중복이 생길 수 없다. 반대로 연결된 뒤 끊기거나 시간이 다 된 경우
 * ({@code ECONNRESET}, {@code upstream-timeout})는 서버가 이미 처리했을 수 있으므로 여기에 넣지
 * 않는다 — 애매하면 다시 보내지 않는 쪽이 안전하다.
 */
const NOT_DELIVERED_CODES = new Set([
  'ENOTFOUND', // 이름을 못 풀었다
  'EAI_AGAIN', // 이름 해석이 일시적으로 실패했다
  'ECONNREFUSED', // 연결을 거절당했다
  'UND_ERR_CONNECT_TIMEOUT', // 연결이 맺어지기 전에 시간이 다 됐다
]);

function provablyNotDelivered(error: unknown): boolean {
  const code = errorCode(error);
  return code !== undefined && NOT_DELIVERED_CODES.has(code);
}

/**
 * 502 본문에 적을 이유. 로그에서 이것만 보고 원인을 가를 수 있어야 한다.
 *
 * <p>{@code AbortSignal} 로 끊으면 Node 가 {@code ABORT_ERR} 를 주기도 하고 시간 초과의 이름을
 * 그대로 넘기기도 한다. 둘 다 우리가 건 한도에 걸린 것이므로 같은 이름으로 적는다.
 */
function failureReason(error: unknown): string {
  const name = (error as { name?: unknown })?.name;
  const code = errorCode(error);
  if (code === 'ABORT_ERR' || name === 'AbortError' || name === 'TimeoutError') {
    return 'upstream-timeout';
  }
  return code ?? 'upstream-unreachable';
}

/** 문제를 사람이 알아볼 수 있는 형태로 돌려준다. 백엔드 주소는 밖으로 내보내지 않는다. */
function gatewayError(reason: string): Response {
  return Response.json(
    { error: 'Bad Gateway', message: '백엔드에 연결하지 못했습니다.', reason },
    { status: 502, headers: { 'Cache-Control': 'no-store' } },
  );
}

function forwardRequestHeaders(request: NextRequest): Record<string, string> {
  const headers: Record<string, string> = {};
  request.headers.forEach((value, key) => {
    if (!DROP_REQUEST_HEADERS.has(key.toLowerCase())) headers[key] = value;
  });
  return headers;
}

/**
 * 백엔드 응답 헤더를 옮긴다.
 *
 * <p>{@code node:http} 는 {@code set-cookie} 를 <b>배열로</b> 준다. 그래서 한 줄씩 따로 붙일 수
 * 있다 — 예전 {@code fetch} 경로에서는 {@code Headers.forEach} 가 여러 줄을 쉼표 하나로 합쳐
 * 버려서(쿠키 값에는 {@code Expires=Wed, 01 Jan ...} 처럼 쉼표가 들어간다) 따로 손을 써야 했다.
 * 지금은 구조가 알아서 지켜 준다.
 */
function forwardResponseHeaders(raw: IncomingHttpHeaders): Headers {
  const headers = new Headers();
  for (const [name, value] of Object.entries(raw)) {
    if (DROP_RESPONSE_HEADERS.has(name)) continue;
    if (Array.isArray(value)) for (const item of value) headers.append(name, item);
    else if (value !== undefined) headers.append(name, value);
  }
  return headers;
}

type Upstream = {
  status: number;
  statusText: string;
  headers: Headers;
  body: ReadableStream<Uint8Array> | null;
};

function sendUpstream(
  target: URL,
  method: string,
  headers: Record<string, string>,
  body: ArrayBuffer | undefined,
): Promise<Upstream> {
  const send = target.protocol === 'http:' ? httpRequest : httpsRequest;

  return new Promise<Upstream>((resolve, reject) => {
    const outgoing = send(
      {
        protocol: target.protocol,
        hostname: target.hostname,
        port: target.port || (target.protocol === 'http:' ? 80 : 443),
        path: `${target.pathname}${target.search}`,
        method,
        headers,
        lookup: backendLookup,
        signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
      },
      (incoming: IncomingMessage) => {
        const status = incoming.statusCode ?? 502;
        const hasBody = method !== 'HEAD' && !BODYLESS_STATUSES.has(status);
        if (!hasBody) incoming.resume(); // 읽어 버리지 않으면 연결이 반납되지 않는다
        resolve({
          status,
          statusText: incoming.statusMessage ?? '',
          headers: forwardResponseHeaders(incoming.headers),
          body: hasBody ? (Readable.toWeb(incoming) as ReadableStream<Uint8Array>) : null,
        });
      },
    );

    outgoing.on('error', reject);

    if (body !== undefined) outgoing.write(Buffer.from(body));
    outgoing.end();
  });
}

async function proxy(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> },
): Promise<Response> {
  if (!BACKEND || !/^https?:\/\//.test(BACKEND)) {
    return gatewayError('backend-url-missing');
  }

  const { path } = await context.params;
  const search = request.nextUrl.search;
  const target = new URL(`${BACKEND}/api/${path.map(encodeURIComponent).join('/')}${search}`);

  // 본문을 미리 읽어 둔다. 스트림은 한 번만 읽히므로, 버퍼로 갖고 있어야 다시 보낼 수 있다.
  // 여기를 지나는 요청은 전부 JSON 이라 작다 — 큰 업로드는 FORCE_ABSOLUTE_PREFIXES 로 직행한다.
  const body =
    request.method === 'GET' || request.method === 'HEAD' ? undefined : await request.arrayBuffer();

  const headers = forwardRequestHeaders(request);
  let lastError: unknown;

  for (let attempt = 0; ; attempt++) {
    try {
      const upstream = await sendUpstream(target, request.method, headers, body);
      return new Response(upstream.body, {
        status: upstream.status,
        statusText: upstream.statusText,
        headers: upstream.headers,
      });
    } catch (error) {
      lastError = error;
      // 닿은 적 없음이 증명될 때만 다시 보낸다. 그래야 POST 를 두 번 처리하는 일이 없다.
      if (!provablyNotDelivered(error) || attempt >= RETRY_DELAYS_MS.length) break;
      await sleep(RETRY_DELAYS_MS[attempt]);
    }
  }

  return gatewayError(failureReason(lastError));
}

export const GET = proxy;
export const POST = proxy;
export const PUT = proxy;
export const PATCH = proxy;
export const DELETE = proxy;
export const HEAD = proxy;
export const OPTIONS = proxy;
