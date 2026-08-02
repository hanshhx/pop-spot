import { NextResponse, type NextRequest } from 'next/server';

/**
 * 백엔드로 넘어가는 요청에 "이 요청은 Vercel 을 거쳤고 접속자는 이 IP다" 라는 서명을 붙인다.
 *
 * ## 왜 필요한가
 *
 * 백엔드의 레이트리밋(횟수 제한)은 IP 하나당 몇 회로 세는데, 그 IP를 클라이언트가 보낸 헤더에서 읽고
 * 있었다. 헤더 한 줄만 바꾸면 매번 새 IP로 인식돼 제한이 통째로 무력해진다 — v2.41 감사에서 실증됐다.
 * 그렇다고 헤더를 안 믿으면 백엔드가 보는 주소는 Tailscale Funnel 내부 주소 하나뿐이라 전 사용자가
 * 제한을 공유하게 되어, 인증메일(시간당 5회)이 사실상 막힌다.
 *
 * ## 어떻게 푸는가
 *
 * Vercel 가장자리는 클라이언트가 보낸 IP 헤더를 **버리고** 진짜 접속 IP로 덮어쓴다(공식 문서: "we
 * currently overwrite the X-Forwarded-For header and do not forward external IPs. This
 * restriction is in place to prevent IP spoofing"). 그래서 이 파일 안에서 읽는 IP는 신뢰할 수 있다.
 * 여기에 백엔드와 공유하는 비밀키로 HMAC 서명을 붙여 보내면, 백엔드는 서명이 맞는 요청의 IP만 쓰면 된다.
 * 비밀키가 없는 공격자는 Funnel 주소를 직접 때려도 임의 IP의 서명을 만들 수 없다.
 *
 * ## 안전장치
 *
 * - `EDGE_SIGNING_SECRET` 이 없으면 아무것도 붙이지 않는다. 백엔드도 같은 조건에서 검증을 끄므로,
 *   **먼저 배포해 두고 나중에 양쪽 키를 채워 켜는** 순서가 가능하다. 되돌릴 때도 키만 지우면 된다.
 * - 어떤 예외가 나도 요청을 그대로 통과시킨다. 여기는 모든 `/api` 요청이 지나는 길목이라 오류가
 *   곧 전면 장애다. 서명 실패의 대가는 "제한이 예전처럼 동작" 이지 "사이트가 죽음" 이 아니어야 한다.
 * - 클라이언트가 보낸 `x-edge-*` 는 **먼저 지운다.** 서명이 붙지 않는 경우에도 위조된 값이 백엔드까지
 *   흘러가면 안 된다.
 *
 * 짝이 되는 백엔드 코드: `popspot-backend/.../config/EdgeSignatureVerifier.java`
 */

export const config = {
  // 페이지에는 서버가 처음부터 올바른 <html lang> 을 만들 수 있도록 언어 헤더를 전달한다.
  // 정적 파일은 제외해 이미지·번들 요청마다 Proxy 가 실행되는 낭비를 막는다.
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|icon.svg|og-image.png|.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif|ico|mp4|webm)$).*)',
  ],
};

/**
 * 앞뒤 공백을 뗀다 — 백엔드(`EdgeSignatureVerifier`)도 같은 처리를 한다.
 *
 * 한쪽만 떼면 서명이 전부 어긋나고, 그 대가는 "전 사용자가 레이트리밋 버킷을 공유" 라는 조용한
 * 장애다. Vercel 환경변수에 값을 붙여넣을 때 줄바꿈이 딸려 들어가는 일이 흔해서 실제로 겪었다.
 */
const SECRET = (process.env.EDGE_SIGNING_SECRET ?? '').trim();

/** IPv6 최대 표기 길이. 비정상적으로 긴 값은 붙이지 않는다. */
const MAX_IP_LENGTH = 45;

/** 키 지문 길이. 백엔드 `EdgeSignatureVerifier.FINGERPRINT_LENGTH` 와 같아야 한다. */
const FINGERPRINT_LENGTH = 12;

const encoder = new TextEncoder();

/**
 * 키 객체는 만드는 비용이 있어 isolate 당 한 번만 만든다.
 *
 * 실패한 Promise 를 캐시하면 그 isolate 가 사는 동안 계속 실패하므로, 실패 시 캐시를 비운다.
 */
let cachedKey: Promise<CryptoKey> | null = null;

function signingKey(): Promise<CryptoKey> {
  if (!cachedKey) {
    cachedKey = crypto.subtle
      .importKey('raw', encoder.encode(SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
      .catch((error) => {
        cachedKey = null;
        throw error;
      });
  }
  return cachedKey;
}

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * 접속자의 공인 IP.
 *
 * `x-vercel-forwarded-for` 를 먼저 본다 — 나중에 Vercel 앞에 다른 프록시(CDN 등)를 두더라도 이 값은
 * Vercel 이 정하는 값으로 남는다. `x-forwarded-for` 는 그때 덮어써질 수 있다.
 */
function clientIp(request: NextRequest): string | null {
  const raw =
    request.headers.get('x-vercel-forwarded-for') ?? request.headers.get('x-forwarded-for');
  if (!raw) return null;

  const first = raw.split(',')[0]?.trim();
  if (!first || first.length > MAX_IP_LENGTH) return null;
  return first;
}

/**
 * 서명 계산 — 백엔드 `EdgeSignatureVerifier.hexSignature` 와 글자 하나까지 같아야 한다.
 *
 * 서명 대상은 `IP + 줄바꿈 + 밀리초타임스탬프`, 알고리즘은 HMAC-SHA256, 표기는 소문자 16진수다.
 * 따로 빼 둔 이유는 테스트에서 직접 부르기 위해서다 — 양쪽 구현이 같은 값을 내는지는 실제로
 * 대조해 보지 않으면 알 수 없고, 어긋나도 화면에는 아무 증상이 없다.
 */
/**
 * 비밀키의 지문 — 키를 드러내지 않고 백엔드 로그와 대조하기 위한 값.
 *
 * SHA-256 앞 12자리라 되돌려 키를 알아낼 수 없다. 백엔드는 서명이 안 맞을 때 이 값을 자기 것과
 * 비교해서 "키가 다르다" 와 "키는 같은데 서명 방식이 어긋났다" 를 구분해 로그에 남긴다. 이 구분이
 * 없어서 운영에서 두 시간을 썼다.
 */
export async function keyFingerprint(): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(SECRET));
  return toHex(digest).slice(0, FINGERPRINT_LENGTH);
}

export async function edgeSignature(ip: string, timestamp: string): Promise<string> {
  const signature = await crypto.subtle.sign(
    'HMAC',
    await signingKey(),
    encoder.encode(`${ip}\n${timestamp}`),
  );
  return toHex(signature);
}

export async function proxy(request: NextRequest) {
  const headers = new Headers(request.headers);
  const localeMatch = request.nextUrl.pathname.match(/^\/(en|ja)(?=\/|$)/);
  headers.set('x-popspot-locale', localeMatch?.[1] ?? 'ko');

  // 위조 시도를 먼저 걷어낸다. 아래에서 서명을 못 붙이는 경우에도 남아 있으면 안 된다.
  headers.delete('x-edge-ip');
  headers.delete('x-edge-ts');
  headers.delete('x-edge-sig');
  headers.delete('x-edge-kid');

  try {
    // 엣지 서명은 API 요청에만 필요하다. 페이지 요청에는 언어 헤더만 전달한다.
    if (!request.nextUrl.pathname.startsWith('/api/')) {
      return NextResponse.next({ request: { headers } });
    }
    const ip = SECRET ? clientIp(request) : null;
    if (ip) {
      const timestamp = Date.now().toString();
      const signature = await edgeSignature(ip, timestamp);
      headers.set('x-edge-ip', ip);
      headers.set('x-edge-ts', timestamp);
      headers.set('x-edge-sig', signature);
      headers.set('x-edge-kid', await keyFingerprint());
    }
  } catch (error) {
    // 서명에 실패해도 요청은 살린다. 백엔드는 서명 없는 요청을 remoteAddr 로 강등할 뿐 막지 않는다.
    console.error('[proxy] 엣지 서명 실패 — 서명 없이 통과시킨다', error);
  }

  return NextResponse.next({ request: { headers } });
}
