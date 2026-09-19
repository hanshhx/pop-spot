/**
 * 접속자 IP 에 서명해 백엔드로 넘긴다.
 *
 * <p><b>왜 미들웨어가 아니라 여기인가.</b> 2026-09-19 까지 이 일은 {@code proxy.ts}(미들웨어)가
 * 했다. Cloudflare Workers 로 옮기면서 그 경로가 <b>약 50% 확률로 죽었다</b> — {@code /api/*} 만
 * Cloudflare 의 {@code Internal Server Error}(우리 {@code gatewayError} 가 아니다)를 냈고,
 * 실패하는 경로가 정확히 미들웨어가 도는 경로였다. OpenNext 가 빌드 때 경고한 그대로다:
 * <i>"Node.js middleware 는 Cloudflare 에서 실험적이고 공식 지원이 아니며 런타임에 예기치 않게
 * 깨질 수 있다."</i>
 *
 * <p>엣지 런타임으로 돌리려 했으나 Next 16 이 거부한다({@code Proxy does not support Edge
 * runtime}). 그래서 미들웨어를 없애고 이 일을 라우트 핸들러 안으로 옮겼다. 하는 일이
 * {@code /api/*} 의 서명 하나뿐이었으므로 중간 계층이 필요 없었다.
 */

/**
 * 비밀키. 값에 붙은 공백을 떼는 것이 중요하다 — 환경변수에 줄바꿈이 딸려 들어가면 서명이
 * 어긋나고, 화면에는 아무 증상이 없이 백엔드만 조용히 강등한다. 실제로 겪은 장애다.
 */
const SECRET = (process.env.EDGE_SIGNING_SECRET ?? '').trim();

/** IPv6 최대 표기 길이. 비정상적으로 긴 값은 붙이지 않는다. */
const MAX_IP_LENGTH = 45;

/** 키 지문 길이. 백엔드 {@code EdgeSignatureVerifier.FINGERPRINT_LENGTH} 와 같아야 한다. */
const FINGERPRINT_LENGTH = 12;

const encoder = new TextEncoder();

/**
 * 키 객체는 만드는 비용이 있어 isolate 당 한 번만 만든다.
 *
 * <p>실패한 Promise 를 캐시하면 그 isolate 가 사는 동안 계속 실패하므로, 실패 시 캐시를 비운다.
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

/** 백엔드가 믿으면 안 되는, 클라이언트가 보냈을 수 있는 헤더들. 넘기기 전에 반드시 지운다. */
export const EDGE_HEADERS = ['x-edge-ip', 'x-edge-ts', 'x-edge-sig', 'x-edge-kid'] as const;

/**
 * 접속자의 공인 IP.
 *
 * <p>{@code cf-connecting-ip} 를 먼저 본다 — Cloudflare 가 직접 채우는 값이라 클라이언트가
 * 위조할 수 없다. 나머지 둘은 Vercel 시절의 값으로, 되돌아갈 경우를 위해 남겨 둔다.
 */
export function clientIp(headers: Headers): string | null {
  const raw =
    headers.get('cf-connecting-ip') ??
    headers.get('x-vercel-forwarded-for') ??
    headers.get('x-forwarded-for');
  if (!raw) return null;

  const first = raw.split(',')[0]?.trim();
  if (!first || first.length > MAX_IP_LENGTH) return null;
  return first;
}

/**
 * 비밀키의 지문 — 키를 드러내지 않고 백엔드 로그와 대조하기 위한 값.
 *
 * <p>SHA-256 앞 12자리라 되돌려 키를 알아낼 수 없다. 백엔드는 서명이 안 맞을 때 이 값을 자기
 * 것과 비교해 "키가 다르다" 와 "키는 같은데 서명 방식이 어긋났다" 를 구분해 로그에 남긴다.
 * 이 구분이 없어서 운영에서 두 시간을 썼다.
 */
export async function keyFingerprint(): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(SECRET));
  return toHex(digest).slice(0, FINGERPRINT_LENGTH);
}

/**
 * 서명 계산 — 백엔드 {@code EdgeSignatureVerifier.hexSignature} 와 글자 하나까지 같아야 한다.
 *
 * <p>서명 대상은 {@code IP + 줄바꿈 + 밀리초타임스탬프}, 알고리즘은 HMAC-SHA256, 표기는 소문자
 * 16진수다. 따로 빼 둔 이유는 테스트에서 직접 부르기 위해서다 — 양쪽 구현이 같은 값을 내는지는
 * 실제로 대조해 보지 않으면 알 수 없고, 어긋나도 화면에는 아무 증상이 없다.
 */
export async function edgeSignature(ip: string, timestamp: string): Promise<string> {
  const signature = await crypto.subtle.sign(
    'HMAC',
    await signingKey(),
    encoder.encode(`${ip}\n${timestamp}`),
  );
  return toHex(signature);
}

/**
 * 백엔드로 넘길 서명 헤더. 붙일 수 없으면 빈 객체를 준다.
 *
 * <p><b>실패해도 요청을 막지 않는다.</b> 백엔드는 서명 없는 요청을 {@code remoteAddr} 로
 * 강등할 뿐 거절하지 않는다. 여기서 던지면 서명 하나 때문에 API 전체가 죽는다.
 */
export async function signedEdgeHeaders(headers: Headers): Promise<Record<string, string>> {
  if (!SECRET) return {};
  const ip = clientIp(headers);
  if (!ip) return {};

  try {
    const timestamp = Date.now().toString();
    return {
      'x-edge-ip': ip,
      'x-edge-ts': timestamp,
      'x-edge-sig': await edgeSignature(ip, timestamp),
      'x-edge-kid': await keyFingerprint(),
    };
  } catch (error) {
    console.error('[api] 엣지 서명 실패 — 서명 없이 통과시킨다', error);
    return {};
  }
}
