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
    if (body.status !== 'UP') {
      return NextResponse.json({ available: false }, { headers: NO_STORE_HEADERS });
    }

    // 프로세스만 UP이고 공개 데이터베이스 연결이 죽은 상태를 복구로 오인하지 않는다.
    const markersResponse = await fetch(`${apiBase}/api/map/markers`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(5_000),
    });
    if (!markersResponse.ok) {
      return NextResponse.json({ available: false }, { headers: NO_STORE_HEADERS });
    }
    const markers: unknown = await markersResponse.json();
    const representative = Array.isArray(markers)
      ? markers.find(
          (marker): marker is { id: number; name: string } =>
            marker !== null &&
            typeof marker === 'object' &&
            typeof (marker as { id?: unknown }).id === 'number' &&
            typeof (marker as { name?: unknown }).name === 'string',
        )
      : undefined;
    if (!representative) {
      return NextResponse.json({ available: false }, { headers: NO_STORE_HEADERS });
    }

    const detailResponse = await fetch(`${apiBase}/api/popups/${representative.id}`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(5_000),
    });
    if (!detailResponse.ok) {
      return NextResponse.json({ available: false }, { headers: NO_STORE_HEADERS });
    }
    const detail = (await detailResponse.json()) as { data?: { name?: string }; name?: string };
    const detailName = detail.data?.name ?? detail.name;
    const available = typeof detailName === 'string' && detailName.trim().length > 0;
    return NextResponse.json({ available }, { headers: NO_STORE_HEADERS });
  } catch {
    return NextResponse.json({ available: false }, { headers: NO_STORE_HEADERS });
  }
}
