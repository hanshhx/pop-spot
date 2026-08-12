import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const NO_STORE_HEADERS = { 'Cache-Control': 'no-store, max-age=0' };

/**
 * 브라우저가 Tailscale 주소를 직접 두드리지 않고 Vercel 안에서 백엔드 전원 상태만 확인한다.
 *
 * 항상 200 JSON을 반환한다. 이 확인 자체가 503이면 브라우저는 "상태 확인 서버도 고장"으로
 * 오해하고 일반 API 재시도를 시작할 수 있다. 백엔드의 응답 본문과 내부 주소는 밖으로 내보내지 않는다.
 */
export async function GET() {
  const apiBase = process.env.NEXT_PUBLIC_API_URL;
  if (!apiBase || !/^https?:\/\//.test(apiBase)) {
    return NextResponse.json({ available: false }, { headers: NO_STORE_HEADERS });
  }

  try {
    const response = await fetch(`${apiBase}/actuator/health`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(4_000),
    });
    if (!response.ok) {
      return NextResponse.json({ available: false }, { headers: NO_STORE_HEADERS });
    }
    const body = (await response.json()) as { status?: string };
    return NextResponse.json({ available: body.status === 'UP' }, { headers: NO_STORE_HEADERS });
  } catch {
    return NextResponse.json({ available: false }, { headers: NO_STORE_HEADERS });
  }
}
