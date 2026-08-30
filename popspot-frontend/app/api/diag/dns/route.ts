import { promises as dns } from 'node:dns';

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

async function attempt<T>(run: () => Promise<T>): Promise<{ ok: boolean; value?: T; error?: string }> {
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

  return Response.json(
    { host, lookup, resolve4, resolve6, servers, fetchByName: byName, fetchByIp: byIp },
    { headers: { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' } },
  );
}
