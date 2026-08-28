import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * 서울에서 실행한다. 근거는 {@code app/api/[...path]/route.ts} 의 같은 설정과 동일하다 —
 * 기본값 {@code iad1}(미국) 이면 한국의 백엔드를 확인하러 태평양을 건넜다 온다.
 *
 * <p>여기서는 그 왕복이 <b>세 번</b> 일어난다(actuator · 목록 · 상세). 확인에 걸린 제한시간이
 * 4~5초라 왕복 비용만으로 한도에 닿았고, 연속 3회 실패는 "서버 연결이 일시적으로 중단됨" 배너와
 * 그 탭의 API 전면 차단으로 이어진다 — 서버는 멀쩡한데.
 */
export const preferredRegion = ['icn1'];

const NO_STORE_HEADERS = { 'Cache-Control': 'no-store, max-age=0' };

/**
 * 확인에 쓸 대표 팝업 id.
 *
 * <p>이 값을 기억하는 이유는 비용이다. 목록 응답은 <b>341KB</b> 인데 여기서 필요한 것은 id
 * 하나뿐이다(상세 응답은 133바이트). 탭마다 60초에 한 번씩 이 확인이 돌기 때문에, 기억하지 않으면
 * 열려 있는 탭 수만큼 매 분 341KB 를 백엔드에서 끌어낸다. 2코어 서버에서는 그 부하가 곧
 * 응답 지연이 되고, 지연이 5초 제한을 넘으면 <b>확인이 스스로 만든 부하 때문에 실패한다.</b>
 * 실제로 2026-08-21 측정에서 연속 호출 시 실패율이 50% 였고 실패는 전부 4.4~5.5초, 즉 제한시간이었다.
 *
 * <p>서버리스라 인스턴스마다 따로 기억하고 재시작하면 사라진다. 그래도 괜찮다 — 없으면 예전처럼
 * 목록을 한 번 받아 다시 고른다.
 */
let cachedRepresentativeId: number | null = null;

/** 테스트 사이에 이 기억이 새어 나가지 않게 하는 전용 초기화. */
export function resetServiceHealthCacheForTest(): void {
  cachedRepresentativeId = null;
}

/** 목록에서 확인용으로 쓸 팝업 하나를 고른다. 실패하면 null. */
async function pickRepresentativeId(apiBase: string): Promise<number | null> {
  const markersResponse = await fetch(`${apiBase}/api/map/markers`, {
    cache: 'no-store',
    signal: AbortSignal.timeout(5_000),
  });
  if (!markersResponse.ok) return null;

  const markers: unknown = await markersResponse.json();
  if (!Array.isArray(markers)) return null;

  const representative = markers.find(
    (marker): marker is { id: number; name: string } =>
      marker !== null &&
      typeof marker === 'object' &&
      typeof (marker as { id?: unknown }).id === 'number' &&
      typeof (marker as { name?: unknown }).name === 'string',
  );
  return representative ? representative.id : null;
}

/**
 * 브라우저가 Tailscale 주소를 직접 두드리지 않고 Vercel 안에서 백엔드 상태만 확인한다.
 *
 * 항상 200 JSON을 반환한다. 이 확인 자체가 503이면 브라우저는 "상태 확인 서버도 고장"으로
 * 오해하고 일반 API 재시도를 시작할 수 있다. 백엔드의 응답 본문과 내부 주소는 밖으로 내보내지 않는다.
 *
 * <p>보는 것은 두 가지다. 프로세스가 살아 있는지(<code>/actuator/health</code>)와, 공개 데이터가
 * 실제로 나오는지(팝업 상세 한 건). 프로세스만 UP 이고 DB 연결이 죽은 상태를 복구로 오인하지 않으려면
 * 두 번째가 필요하다. 둘은 서로를 기다릴 이유가 없으므로 같이 부른다.
 */
export async function GET() {
  const apiBase = process.env.NEXT_PUBLIC_API_URL;
  if (!apiBase || !/^https?:\/\//.test(apiBase)) {
    return NextResponse.json({ available: false }, { headers: NO_STORE_HEADERS });
  }

  try {
    const [healthResponse, representativeId] = await Promise.all([
      fetch(`${apiBase}/actuator/health`, {
        cache: 'no-store',
        signal: AbortSignal.timeout(4_000),
      }),
      cachedRepresentativeId === null
        ? pickRepresentativeId(apiBase)
        : Promise.resolve(cachedRepresentativeId),
    ]);

    if (!healthResponse.ok) {
      return NextResponse.json({ available: false }, { headers: NO_STORE_HEADERS });
    }
    const body = (await healthResponse.json()) as { status?: string };
    if (body.status !== 'UP' || representativeId === null) {
      return NextResponse.json({ available: false }, { headers: NO_STORE_HEADERS });
    }

    const detailResponse = await fetch(`${apiBase}/api/popups/${representativeId}`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(5_000),
    });
    if (!detailResponse.ok) {
      // 그 팝업이 지워졌을 수 있다. 기억을 비워 다음 확인에서 다시 고르게 한다.
      cachedRepresentativeId = null;
      return NextResponse.json({ available: false }, { headers: NO_STORE_HEADERS });
    }

    const detail = (await detailResponse.json()) as { data?: { name?: string }; name?: string };
    const detailName = detail.data?.name ?? detail.name;
    const available = typeof detailName === 'string' && detailName.trim().length > 0;
    if (available) cachedRepresentativeId = representativeId;
    return NextResponse.json({ available }, { headers: NO_STORE_HEADERS });
  } catch {
    return NextResponse.json({ available: false }, { headers: NO_STORE_HEADERS });
  }
}
