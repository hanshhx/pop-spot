/**
 * 도보 경로 — OSRM 공개 서버에서 실제 길을 받아 온다.
 *
 * <p>웹 작전지도가 쓰던 것과 같은 서버다({@code router.project-osrm.org}). 개인정보 처리방침에
 * 이미 "FOSSGIS e.V. — OSRM 공개 서버 (독일)" 로 고지돼 있고, 보내는 것은 출발·도착 <b>좌표</b>뿐이다.
 *
 * <h3>이 서버는 프로필을 무시한다</h3>
 *
 * <p><b>주의해서 읽을 것.</b> URL 의 {@code /foot/} 은 아무 일도 하지 않는다. 2026-08-30 에 성수
 * 779m 구간으로 {@code foot}·{@code walking}·{@code driving}·{@code car}·{@code bike} 를 각각 불러
 * 봤더니 <b>다섯 개가 완전히 같은 값</b>을 돌려줬다 — 거리 779m, 소요 123초. 시속 22.8km 다.
 * 사람은 그 속도로 걷지 않는다. 공개 데모 서버에 올라가 있는 프로필이 자동차 하나뿐이기 때문이다.
 *
 * <p>그래서 <b>거리·경로·도로명만 쓰고 시간은 우리가 센다.</b> 셋은 프로필과 무관하게 맞다(같은
 * 길을 자동차로 가든 걸어가든 길이는 같다). 시간만 {@link walkMinutes} 로 다시 계산한다.
 *
 * <p>웹도 같은 함수를 쓰고 있으므로 거기도 도보 시간 자리에 자동차 시간이 들어가 있다. 별건으로
 * 고쳐야 한다.
 */

/** OSRM 응답의 한 갈래. 필요한 칸만 적는다. */
interface OsrmStep {
  distance: number;
  name: string;
  maneuver: { type: string; modifier?: string };
}

interface OsrmResponse {
  code: string;
  routes?: {
    distance: number;
    geometry: { coordinates: [number, number][] };
    legs: { steps: OsrmStep[] }[];
  }[];
}

export interface RoutePoint {
  lat: number;
  lng: number;
}

/** 안내 한 마디 — 시안 12 상단 카드가 쓰는 것. */
export interface RouteStep {
  /** 이 구간 길이(m). */
  distanceM: number;
  /** 도로 이름. OSRM 이 한국어로 준다({@code 연무장9길}). 골목은 비어 있을 수 있다. */
  road: string;
  /** 화살표로 그릴 방향. */
  turn: 'left' | 'right' | 'straight' | 'arrive' | 'depart';
  minutes: number;
}

export interface WalkRoute {
  distanceM: number;
  minutes: number;
  points: RoutePoint[];
  steps: RouteStep[];
}

/**
 * 걷는 속도 — 분당 67m(시속 약 4km).
 *
 * <p>{@code lib/walkGroups.ts} 의 {@code walkInfo} 가 쓰는 값과 같다. 두 곳이 다른 속도를 쓰면
 * 목록의 "도보 7분" 과 길찾기의 "도보 4분" 이 어긋난다.
 *
 * <p>다만 {@code walkInfo} 는 <b>직선거리에 1.3배</b>를 곱해 우회를 흉내 낸다. 여기서 받는 것은
 * 이미 실제 길을 따라간 거리라 그 보정을 <b>다시 걸면 안 된다</b> — 걸면 같은 길이 30% 길어진다.
 */
const METRES_PER_MINUTE = 67;

/** 실제 경로 길이(m)로 도보 분을 센다. 0분이라고 말하지 않는다 — 짧아도 한 걸음은 걸린다. */
export function walkMinutes(distanceM: number): number {
  return Math.max(1, Math.round(distanceM / METRES_PER_MINUTE));
}

/** OSRM 의 maneuver 를 화살표 네 갈래로 줄인다. 도보 안내에 필요한 것은 그 정도다. */
function toTurn(step: OsrmStep): RouteStep['turn'] {
  if (step.maneuver.type === 'arrive') return 'arrive';
  if (step.maneuver.type === 'depart') return 'depart';
  const modifier = step.maneuver.modifier ?? '';
  if (modifier.includes('left')) return 'left';
  if (modifier.includes('right')) return 'right';
  return 'straight';
}

/** 요청 하나가 붙잡고 있을 수 있는 최대 시간. 남의 공개 서버라 오래 기다리지 않는다. */
const TIMEOUT_MS = 8_000;

/**
 * 두 점 사이 도보 경로.
 *
 * <p>실패하면 {@code null} 이다. 부르는 쪽은 직선으로 대신 그린다 — 남의 공개 서버라 언제든 막힐
 * 수 있고, 그때 길찾기 화면 전체가 죽으면 안 된다.
 */
export async function fetchWalkRoute(
  from: RoutePoint,
  to: RoutePoint,
): Promise<WalkRoute | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const coords = `${from.lng},${from.lat};${to.lng},${to.lat}`;
    const url = `https://router.project-osrm.org/route/v1/foot/${coords}?overview=full&geometries=geojson&steps=true`;
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) return null;

    const data = (await res.json()) as OsrmResponse;
    const route = data.routes?.[0];
    if (data.code !== 'Ok' || !route) return null;

    const steps: RouteStep[] = (route.legs[0]?.steps ?? []).map((step) => ({
      distanceM: Math.round(step.distance),
      road: step.name?.trim() ?? '',
      turn: toTurn(step),
      minutes: walkMinutes(step.distance),
    }));

    return {
      distanceM: Math.round(route.distance),
      /* 서버가 준 duration 은 자동차 시간이라 쓰지 않는다. 위 주석 참고. */
      minutes: walkMinutes(route.distance),
      points: route.geometry.coordinates.map(([lng, lat]) => ({ lat, lng })),
      steps,
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
