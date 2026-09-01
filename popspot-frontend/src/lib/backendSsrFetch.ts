import { request as httpsRequest } from 'node:https';
import type { LookupFunction } from 'node:net';

import { createBackendLookup } from './backendDns';

/**
 * 서버 렌더가 백엔드를 부를 때 쓰는 {@code fetch} — <b>이름 해석에 실패하면 한 번 더 시도한다.</b>
 *
 * <p><b>왜 필요한가.</b> Vercel 함수 안에서 백엔드({@code *.ts.net})의 이름 해석이 통째로 실패하는
 * 구간이 있다(경위는 {@link createBackendLookup}). {@code /api/*} 프록시는 이미 그것을 우회하지만
 * <b>서버 렌더는 프록시를 안 거친다</b> — 홈·랜딩·상세가 백엔드를 직접 부른다. 그래서 그 구간에
 * 크롤러가 오면 2026-08-11 스냅샷이 나갔다. 사람에게는 오래된 목록이고, 검색엔진에게는
 * "이 사이트는 안 고쳐진다" 는 신호다.
 *
 * <p><b>왜 {@code fetch} 를 버리지 않는가.</b> 세 호출부가 전부 {@code next: { revalidate }} 로
 * Next 의 데이터 캐시를 쓴다(1시간·1시간·5분). {@code node:https} 로 통째로 내려가면 그 캐시가
 * 사라져 <b>크롤러가 몰릴 때마다 백엔드를 직접 두드리게</b> 된다 — 상세의 주석이 "크롤러가
 * 몰려와도 5분에 한 번만 나간다" 고 약속한 바로 그것을 깨뜨린다.
 *
 * <p>그래서 평소에는 {@code fetch} 그대로 두고, <b>이름을 못 풀었을 때만</b> 우회로로 한 번 더
 * 시도한다. 정상 구간에서는 코드 경로가 예전과 완전히 같다.
 */

/**
 * 다시 시도해도 되는 실패인가 — <b>요청이 백엔드에 닿은 적이 없음</b>이 증명되는 것만.
 *
 * <p>연결된 뒤 끊긴 경우는 서버가 이미 처리했을 수 있다. 여기는 전부 GET 이라 중복 처리 위험은
 * 없지만, 그때는 이름 해석이 문제가 아니므로 우회로가 도울 것도 없다. 괜히 한 번 더 기다릴 뿐이다.
 */
const NOT_DELIVERED_CODES = new Set([
  'ENOTFOUND',
  'EAI_AGAIN',
  'ECONNREFUSED',
  'UND_ERR_CONNECT_TIMEOUT',
]);

/** 우회로 한 번에 허용하는 시간. 서버 렌더가 이것 때문에 오래 붙들리면 안 된다. */
const DOH_TIMEOUT_MS = 8_000;

/** 응답이 이보다 크면 우회로에서는 포기한다. 가장 큰 응답(팝업 목록)이 실측 1.3MB 다. */
const MAX_BYTES = 8 * 1024 * 1024;

/**
 * 오류에서 코드를 꺼낸다. {@code fetch}(undici)는 한 겹 안쪽 {@code cause.code} 에,
 * {@code node:https} 는 {@code code} 에 담는다.
 */
export function errorCode(error: unknown): string | undefined {
  const nested = (error as { cause?: { code?: unknown } })?.cause?.code;
  if (typeof nested === 'string') return nested;
  const direct = (error as { code?: unknown })?.code;
  return typeof direct === 'string' ? direct : undefined;
}

/** 이 실패에 우회로를 써 볼 값어치가 있는가. */
export function shouldRetryViaDoh(error: unknown): boolean {
  const code = errorCode(error);
  return code !== undefined && NOT_DELIVERED_CODES.has(code);
}

const lookups = new Map<string, LookupFunction>();

function lookupFor(hostname: string): LookupFunction {
  const cached = lookups.get(hostname);
  if (cached) return cached;
  const made = createBackendLookup(hostname);
  lookups.set(hostname, made);
  return made;
}

/**
 * DoH 로 이름을 풀어 다시 받아 온다.
 *
 * <p>본문을 통째로 모아서 돌려준다. 여기를 지나는 응답은 전부 JSON 이고 가장 큰 것이 1.3MB 라,
 * 흘려보내는 복잡함을 감수할 이유가 없다 — 이 경로는 장애 구간에서만 돈다.
 */
function viaDoh(target: URL): Promise<Response> {
  return new Promise<Response>((resolve, reject) => {
    const req = httpsRequest(
      {
        hostname: target.hostname,
        port: target.port || 443,
        path: `${target.pathname}${target.search}`,
        method: 'GET',
        lookup: lookupFor(target.hostname),
        signal: AbortSignal.timeout(DOH_TIMEOUT_MS),
      },
      (res) => {
        const chunks: Buffer[] = [];
        let size = 0;
        res.on('data', (chunk: Buffer) => {
          size += chunk.length;
          if (size > MAX_BYTES) {
            res.destroy();
            reject(new Error('backend response too large'));
            return;
          }
          chunks.push(chunk);
        });
        res.on('end', () => {
          const type = res.headers['content-type'];
          resolve(
            new Response(Buffer.concat(chunks), {
              status: res.statusCode ?? 502,
              headers: type ? { 'content-type': type } : undefined,
            }),
          );
        });
        res.on('error', reject);
      },
    );
    req.on('error', reject);
    req.end();
  });
}

/**
 * 서버 렌더용 백엔드 호출. 실패하면 던진다 — 호출부가 이미 {@code try/catch} 로 스냅샷·빈 값으로
 * 물러설 준비가 되어 있으므로, 여기서 삼키면 그 판단을 빼앗는다.
 */
export async function fetchBackend(url: string, revalidate: number): Promise<Response> {
  try {
    return await fetch(url, { next: { revalidate } });
  } catch (error) {
    if (!shouldRetryViaDoh(error)) throw error;
    console.warn(`[ssr] 이름 해석 실패로 우회로 사용: ${url} (${errorCode(error)})`);
    return viaDoh(new URL(url));
  }
}
