import { lookup as systemLookup } from 'node:dns';
import type { LookupFunction } from 'node:net';

/**
 * 백엔드 호스트명을 <b>우리가 직접</b> 푼다.
 *
 * <p><b>왜 필요한가.</b> Vercel 함수 안에서 백엔드({@code *.ts.net})를 부르면 이름 해석이 통째로
 * 실패하는 구간이 있다 — 몇 분에서 수십 분까지. 2026-08-31 11:36~11:57 실측으로 21분간
 * {@code /api/*} 전건이 502 {@code ENOTFOUND} 였다. 같은 시각 <b>공개 인터넷은 멀쩡했다</b>:
 * 공개 DNS(Google·Cloudflare DoH)는 A·AAAA 를 정상으로 돌려주고, 그 공인 IP 로 직접 붙으면
 * 33ms 만에 200 이 온다. 못 푸는 것은 Vercel 함수의 리졸버 하나뿐이다.
 *
 * <p><b>왜 하필 이 호스트만.</b> Tailscale 은 funnel 이 켜지지 않은 노드의 주소로
 * {@code 100.64.0.0/10}(CGNAT)을 공개 DNS 에 싣는다. 리졸버들은 DNS 리바인딩 방어로 사설·CGNAT
 * 응답을 걸러 내는데, 그러면 남는 주소가 0 개가 된다 — 엣지가 뱉던 오류가 실제로
 * {@code DNS_HOSTNAME_EMPTY}("없음"이 아니라 <b>"비었음"</b>)였던 것이 이 설명과 맞는다.
 *
 * <p><b>해법.</b> {@code node:https} 의 {@code lookup} 옵션에 이 모듈의 함수를 꽂는다. 이름은
 * DoH(HTTPS 위의 DNS)로 우리가 풀고 <b>공인 주소만</b> 남겨 넘긴다. HTTPS 요청이므로 막힌 리졸버를
 * 거치지 않는다. TLS SNI 는 URL 의 호스트명을 그대로 쓰므로 인증서는 그대로 맞는다.
 *
 * <p>못 풀면 <b>시스템 해석으로 되돌아간다.</b> 이 모듈이 고장 나도 지금보다 나빠지지 않는다.
 */

/** 두 곳을 순서대로 시도한다. 한쪽이 죽어도 이름 해석이 멈추지 않는다. */
const DOH_ENDPOINTS = [
  'https://dns.google/resolve',
  'https://cloudflare-dns.com/dns-query',
] as const;

/** DoH 한 번에 허용하는 시간. 이름 해석 때문에 요청 전체가 늦어지면 안 된다. */
const DOH_TIMEOUT_MS = 2_000;

/** 성공 결과를 붙잡아 두는 최소·최대 시간. 응답의 TTL 을 이 사이로 자른다. */
const MIN_TTL_MS = 30_000;
const MAX_TTL_MS = 300_000;

/** 실패했을 때 다시 물어보기까지. 짧게 잡아 장애가 끝나면 곧바로 회복한다. */
const FAILURE_TTL_MS = 5_000;

type Entry = { addresses: string[]; expiresAt: number };

const cache = new Map<string, Entry>();
const inFlight = new Map<string, Promise<string[]>>();
let rotation = 0;

/**
 * 공개 인터넷에서 실제로 갈 수 있는 IPv4 인가.
 *
 * <p>{@code 100.64.0.0/10} 을 막는 것이 이 함수의 핵심 목적이다 — Tailscale 의 tailnet 내부 주소가
 * 그 대역이고, Vercel 함수는 tailnet 에 없으므로 그리로 붙으면 응답 없이 시간만 끈다.
 */
export function isPubliclyRoutableIpv4(ip: string): boolean {
  const parts = ip.split('.');
  if (parts.length !== 4) return false;
  const octets = parts.map((part) => (/^\d{1,3}$/.test(part) ? Number(part) : NaN));
  if (octets.some((value) => !Number.isInteger(value) || value < 0 || value > 255)) return false;
  const [a, b] = octets;
  if (a === 0 || a === 127) return false; // 이 호스트 / 루프백
  if (a === 10) return false; // 사설
  if (a === 172 && b >= 16 && b <= 31) return false; // 사설
  if (a === 192 && b === 168) return false; // 사설
  if (a === 169 && b === 254) return false; // 링크 로컬
  if (a === 100 && b >= 64 && b <= 127) return false; // CGNAT — Tailscale 내부 주소
  if (a >= 224) return false; // 멀티캐스트 및 예약
  return true;
}

type DohAnswer = { type?: unknown; data?: unknown; TTL?: unknown };

/** DoH 응답에서 쓸 수 있는 A 레코드만 골라낸다. {@code type: 1} 이 A 이고 CNAME(5)은 버린다. */
export function parseDohAnswer(body: unknown): { addresses: string[]; ttlMs: number } {
  const answers = (body as { Answer?: unknown })?.Answer;
  if (!Array.isArray(answers)) return { addresses: [], ttlMs: FAILURE_TTL_MS };

  const records = (answers as DohAnswer[]).filter(
    (answer) =>
      answer?.type === 1 && typeof answer.data === 'string' && isPubliclyRoutableIpv4(answer.data),
  );
  if (records.length === 0) return { addresses: [], ttlMs: FAILURE_TTL_MS };

  const ttls = records
    .map((answer) => answer.TTL)
    .filter((ttl): ttl is number => typeof ttl === 'number' && ttl > 0);
  const ttlMs = ttls.length > 0 ? Math.min(...ttls) * 1_000 : MIN_TTL_MS;

  return {
    addresses: records.map((answer) => answer.data as string),
    ttlMs: Math.min(Math.max(ttlMs, MIN_TTL_MS), MAX_TTL_MS),
  };
}

async function queryDoh(
  endpoint: string,
  hostname: string,
): Promise<{ addresses: string[]; ttlMs: number }> {
  const response = await fetch(`${endpoint}?name=${encodeURIComponent(hostname)}&type=A`, {
    headers: { accept: 'application/dns-json' },
    cache: 'no-store',
    signal: AbortSignal.timeout(DOH_TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`doh ${response.status}`);
  return parseDohAnswer(await response.json());
}

async function resolveNow(hostname: string): Promise<string[]> {
  for (const endpoint of DOH_ENDPOINTS) {
    try {
      const { addresses, ttlMs } = await queryDoh(endpoint, hostname);
      if (addresses.length > 0) {
        cache.set(hostname, { addresses, expiresAt: Date.now() + ttlMs });
        return addresses;
      }
    } catch {
      // 다음 곳으로 넘어간다. 둘 다 실패하면 아래에서 실패로 적어 둔다.
    }
  }
  cache.set(hostname, { addresses: [], expiresAt: Date.now() + FAILURE_TTL_MS });
  return [];
}

/** 캐시가 살아 있으면 그것을, 아니면 한 번만 물어본다(같은 이름의 동시 요청은 하나로 합친다). */
export async function resolvePublicIpv4(hostname: string): Promise<string[]> {
  const cached = cache.get(hostname);
  if (cached && cached.expiresAt > Date.now()) return cached.addresses;

  const existing = inFlight.get(hostname);
  if (existing) return existing;

  const pending = resolveNow(hostname).finally(() => inFlight.delete(hostname));
  inFlight.set(hostname, pending);
  return pending;
}

/**
 * {@code node:https} 에 넘길 이름 해석 함수를 만든다.
 *
 * <p>{@code hostname} 이 우리가 맡은 이름이 아니거나 DoH 가 아무것도 못 주면 시스템 해석
 * ({@code dns.lookup}) 으로 그대로 넘긴다 — 이 모듈은 <b>더 나빠질 수 없는</b> 자리에 있다.
 */
export function createBackendLookup(backendHostname: string): LookupFunction {
  const fallback = (hostname: string, options: unknown, callback: unknown) => {
    (systemLookup as unknown as (h: string, o: unknown, c: unknown) => void)(
      hostname,
      options,
      callback,
    );
  };

  return ((hostname: string, options: unknown, callback: unknown) => {
    if (hostname !== backendHostname) {
      fallback(hostname, options, callback);
      return;
    }

    resolvePublicIpv4(hostname)
      .then((addresses) => {
        if (addresses.length === 0) {
          fallback(hostname, options, callback);
          return;
        }
        const done = callback as (
          error: NodeJS.ErrnoException | null,
          address: string | { address: string; family: number }[],
          family?: number,
        ) => void;
        if ((options as { all?: boolean })?.all) {
          done(
            null,
            addresses.map((address) => ({ address, family: 4 })),
          );
          return;
        }
        // 주소가 둘 이상이면 돌려 가며 쓴다. 한쪽이 상해도 다음 요청은 다른 쪽으로 간다.
        done(null, addresses[rotation++ % addresses.length], 4);
      })
      .catch(() => fallback(hostname, options, callback));
  }) as LookupFunction;
}

/** 테스트에서 상태를 비운다. 캐시가 테스트 사이에 새어 나가면 결과가 순서에 의존하게 된다. */
export function resetBackendDnsForTest(): void {
  cache.clear();
  inFlight.clear();
  rotation = 0;
}
