import type { NextRequest } from 'next/server';

/**
 * {@code /api/*} 를 백엔드로 넘기는 프록시.
 *
 * <p><b>왜 리라이트가 아니라 이것인가.</b> 예전에는 {@code next.config.ts} 의 {@code rewrites()} 가
 * 이 일을 했다. 그런데 그 리라이트는 <b>Vercel 엣지</b>에서 실행되고, 엣지의 리졸버가 백엔드
 * 호스트명(ts.net)을 못 푼다. 실측(2026-08-28)으로 20번 중 14번이 502 였고 실패는 전부
 * {@code X-Vercel-Error: DNS_HOSTNAME_EMPTY / DNS_HOSTNAME_NOT_FOUND} 였다.
 *
 * <p>결정적으로 <b>엣지 리라이트는 우리가 재시도를 걸 수 없다.</b> Vercel 이 502 를 만들어 버리면
 * 그걸로 끝이다. 반면 같은 시각 Vercel 의 Node 런타임에서 같은 백엔드를 부르면 호출당 실패가
 * 약 4% 였다({@code /service-health} 20회 중 18회 성공, 그 경로는 백엔드를 2~3번 부른다).
 * 여기서는 우리가 다시 보낼 수 있으므로 그 4% 도 사실상 0 이 된다.
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

const BACKEND = (process.env.NEXT_PUBLIC_API_URL ?? '').replace(/\/+$/, '');

/**
 * 백엔드로 넘기지 않는 요청 헤더.
 *
 * <p>{@code host} 를 그대로 넘기면 백엔드가 자기 주소를 popspot.co.kr 로 착각한다.
 * {@code content-length} 와 {@code accept-encoding} 은 우리가 본문을 다시 만들어 보내므로
 * 원래 값이 맞지 않는다 — 남겨 두면 응답이 잘리거나 압축 해제가 두 번 일어난다.
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
 * <p>{@code fetch} 가 이미 압축을 풀어 준 본문을 넘기므로 {@code content-encoding} 을 같이 보내면
 * 브라우저가 한 번 더 풀려다 실패한다. 길이도 마찬가지로 원래 값과 어긋난다.
 */
const DROP_RESPONSE_HEADERS = new Set([
  'content-encoding',
  'content-length',
  'transfer-encoding',
  'connection',
]);

/** 다시 보내기까지의 간격. 이 실패는 수십 ms 만에 돌아오므로 짧게 잡아도 된다. */
const RETRY_DELAYS_MS = [150, 400, 900] as const;

/**
 * 서버리스 함수가 물려 있을 수 있는 최대 시간보다 넉넉히 앞서 끝낸다.
 *
 * <p>이 한도를 넘기면 사용자에게는 함수 타임아웃(504)이 가는데, 그건 우리가 만든 오류 메시지보다
 * 훨씬 알아보기 어렵다.
 */
const UPSTREAM_TIMEOUT_MS = 9_000;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * 이 오류는 <b>요청이 백엔드에 닿은 적이 없음</b>을 뜻하는가.
 *
 * <p>이 구분이 있어야 POST 도 다시 보낼 수 있다. 이름을 못 풀었거나 연결 자체가 거절됐다면 서버는
 * 그 요청을 본 적이 없으므로 중복이 생길 수 없다. 반대로 연결된 뒤 끊긴 경우
 * ({@code ECONNRESET} 등)는 서버가 이미 처리했을 수 있으므로 여기에 넣지 않는다 —
 * 애매하면 다시 보내지 않는 쪽이 안전하다.
 */
const NOT_DELIVERED_CODES = new Set([
  'ENOTFOUND', // 이름을 못 풀었다
  'EAI_AGAIN', // 이름 해석이 일시적으로 실패했다 (지금 겪는 것)
  'ECONNREFUSED', // 연결을 거절당했다
  'UND_ERR_CONNECT_TIMEOUT', // 연결이 맺어지기 전에 시간이 다 됐다
]);

function provablyNotDelivered(error: unknown): boolean {
  const cause = (error as { cause?: unknown })?.cause;
  const code = (cause as { code?: unknown })?.code;
  return typeof code === 'string' && NOT_DELIVERED_CODES.has(code);
}

/** 문제를 사람이 알아볼 수 있는 형태로 돌려준다. 백엔드 주소는 밖으로 내보내지 않는다. */
function gatewayError(reason: string): Response {
  return Response.json(
    { error: 'Bad Gateway', message: '백엔드에 연결하지 못했습니다.', reason },
    { status: 502, headers: { 'Cache-Control': 'no-store' } },
  );
}

function forwardRequestHeaders(request: NextRequest): Headers {
  const headers = new Headers();
  request.headers.forEach((value, key) => {
    if (!DROP_REQUEST_HEADERS.has(key.toLowerCase())) headers.set(key, value);
  });
  return headers;
}

function forwardResponseHeaders(upstream: Response): Headers {
  const headers = new Headers();
  upstream.headers.forEach((value, key) => {
    if (!DROP_RESPONSE_HEADERS.has(key.toLowerCase())) headers.append(key, value);
  });
  return headers;
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
  const target = `${BACKEND}/api/${path.map(encodeURIComponent).join('/')}${search}`;

  // 본문을 미리 읽어 둔다. 스트림은 한 번만 읽히므로, 버퍼로 갖고 있어야 다시 보낼 수 있다.
  // 여기를 지나는 요청은 전부 JSON 이라 작다 — 큰 업로드는 FORCE_ABSOLUTE_PREFIXES 로 직행한다.
  const body =
    request.method === 'GET' || request.method === 'HEAD' ? undefined : await request.arrayBuffer();

  const headers = forwardRequestHeaders(request);
  let lastError: unknown;

  for (let attempt = 0; ; attempt++) {
    try {
      const upstream = await fetch(target, {
        method: request.method,
        headers,
        body,
        redirect: 'manual',
        cache: 'no-store',
        signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
      });

      return new Response(upstream.body, {
        status: upstream.status,
        statusText: upstream.statusText,
        headers: forwardResponseHeaders(upstream),
      });
    } catch (error) {
      lastError = error;
      // 닿은 적 없음이 증명될 때만 다시 보낸다. 그래야 POST 를 두 번 처리하는 일이 없다.
      if (!provablyNotDelivered(error) || attempt >= RETRY_DELAYS_MS.length) break;
      await sleep(RETRY_DELAYS_MS[attempt]);
    }
  }

  const cause = (lastError as { cause?: { code?: string } })?.cause;
  return gatewayError(cause?.code ?? 'upstream-unreachable');
}

export const GET = proxy;
export const POST = proxy;
export const PUT = proxy;
export const PATCH = proxy;
export const DELETE = proxy;
export const HEAD = proxy;
export const OPTIONS = proxy;
