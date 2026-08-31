import { promises as dns } from 'node:dns';
import { request as httpsRequest } from 'node:https';

import { createBackendLookup, resolvePublicIpv4 } from '@/lib/backendDns';
import { env } from '@/lib/env';

/**
 * <b>일회용 진단.</b> Vercel 함수가 백엔드 호스트를 왜 못 푸는지 확인한다.
 *
 * <p>2026-08-30 18:09 부터 {@code /api/*} 전건이 502 {@code ENOTFOUND} 인데, 같은 시각 공개
 * DNS(1.1.1.1·8.8.8.8)는 정상 응답하고 공개 funnel IP(103.84.155.153/217)로 직접 붙으면 200 이다.
 * 즉 <b>이 함수 안에서만</b> 이름이 안 풀린다.
 *
 * <p>가설: {@code fetch} 가 쓰는 {@code dns.lookup}(OS 의 getaddrinfo)이 실패하고, DNS 서버에
 * 직접 묻는 {@code dns.resolve4}(c-ares)는 성공한다. 맞다면 해결은 <b>해석 방법을 바꾸는 것</b>이고,
 * 틀리면 우리 쪽에서 할 수 있는 일이 없다는 뜻이다. 추측으로 우회로를 만들기 전에 가른다.
 *
 * <p>원인을 확인하면 <b>지운다.</b> 진단용 경로를 오래 두면 그 자체가 표면이 된다.
 */

export const dynamic = 'force-dynamic';

/** 어떤 실패였는지만 남긴다. 스택은 필요 없고 길기만 하다. */
function describe(error: unknown): string {
  const e = error as { code?: string; message?: string; cause?: { code?: string } };
  return e?.code ?? e?.cause?.code ?? e?.message ?? String(error);
}

async function attempt<T>(
  run: () => Promise<T>,
): Promise<{ ok: boolean; value?: T; error?: string }> {
  const started = Date.now();
  try {
    const value = await run();
    return { ok: true, value };
  } catch (error) {
    return { ok: false, error: `${describe(error)} (${Date.now() - started}ms)` };
  }
}

export async function GET(): Promise<Response> {
  const base = env.apiUrl.replace(/\/+$/, '');
  const host = (() => {
    try {
      return new URL(base).hostname;
    } catch {
      return '';
    }
  })();

  if (!host) return Response.json({ error: 'api url not configured' }, { status: 500 });

  /* getaddrinfo — fetch 가 실제로 쓰는 길. */
  const lookup = await attempt(() => dns.lookup(host, { all: true }));
  /* c-ares — DNS 서버에 직접 묻는 길. 위가 죽어도 이건 살아 있을 수 있다. */
  const resolve4 = await attempt(() => dns.resolve4(host));
  const resolve6 = await attempt(() => dns.resolve6(host));
  const servers = await attempt(async () => dns.getServers());

  /*
   * <b>이것이 갈림길이다.</b> 이 리졸버가 "이 이름만" 못 푸는지 "아무것도" 못 푸는지 가른다.
   *
   * <p>앞의 것이면 DoH 우회로가 통한다 — dns.google 은 풀리니까. 뒤의 것이면 DoH 도 같이 죽고,
   * 우리 쪽에서 할 수 있는 일은 없다(남는 길은 ts.net 밖으로 나가는 것뿐이다).
   * 상한 인스턴스를 잡았을 때 이 줄만 보면 된다.
   */
  const lookupOther = await attempt(() => dns.lookup('dns.google', { all: true }));

  /* 실제 요청. 이름으로 한 번, resolve4 가 준 IP 로 한 번(SNI 는 이름 그대로 유지). */
  const byName = await attempt(async () => {
    const res = await fetch(`${base}/actuator/health`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(6000),
    });
    return res.status;
  });

  const ip = resolve4.ok ? resolve4.value?.[0] : undefined;
  const byIp = ip
    ? await attempt(async () => {
        const res = await fetch(`https://${ip}/actuator/health`, {
          cache: 'no-store',
          headers: { host },
          signal: AbortSignal.timeout(6000),
        });
        return res.status;
      })
    : { ok: false, error: 'resolve4 실패로 시도 못 함' };

  /*
   * 여기부터가 <b>우회로 검증</b>이다.
   *
   * <p>위 네 줄로 밝혀진 것: 이 함수 안에서는 getaddrinfo 도 c-ares 도 이 이름을 못 푼다.
   * 그런데 <b>같은 순간에도</b> 다른 인스턴스는 200 을 준다 — 즉 상하는 것은 사이트가 아니라
   * <b>인스턴스</b>다. 그래서 우회로가 "멀쩡한 인스턴스에서 되는 것"은 증명이 아니다.
   * <b>상한 인스턴스에서 되는지</b>를 봐야 한다.
   *
   * <p>{@code doh} 가 그 갈림길이다. DoH 도 결국 {@code dns.google} 을 풀어야 하고 그것도 같은
   * 리졸버를 쓴다. 여기가 실패하면 우리 우회로는 상한 인스턴스에서 무력하다 — 그러면 남는 길은
   * ts.net 밖으로 나가는 것뿐이다. 성공하면 리졸버는 <b>이 이름에 대해서만</b> 상한 것이고
   * 우회로가 통한다.
   */
  const doh = await attempt(() => resolvePublicIpv4(host));

  const viaDoh = await attempt(
    () =>
      new Promise<number>((resolve, reject) => {
        const req = httpsRequest(
          {
            hostname: host,
            port: 443,
            path: '/actuator/health',
            method: 'GET',
            lookup: createBackendLookup(host),
            agent: false,
            signal: AbortSignal.timeout(6000),
          },
          (res) => {
            res.resume();
            res.on('end', () => resolve(res.statusCode ?? 0));
          },
        );
        req.on('error', reject);
        req.end();
      }),
  );

  return Response.json(
    {
      host,
      lookup,
      resolve4,
      resolve6,
      servers,
      lookupOther,
      fetchByName: byName,
      fetchByIp: byIp,
      doh,
      viaDoh,
    },
    { headers: { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' } },
  );
}
