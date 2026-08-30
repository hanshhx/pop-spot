import { FALLBACK_CLUSTER_MIN } from '@/lib/fallbackCoords';

/**
 * 같은 좌표에 박힌 핀들을 작은 원형으로 흩어 놓는다 — 웹 {@code InteractiveMap} 의 같은 이름 함수.
 *
 * <p>자동 수집한 좌표는 같은 값이 자주 나온다. 같은 건물에서 열리는 팝업이 실제로 여럿이거나
 * (더현대·롯데월드몰), 지오코딩이 건물 대표 좌표 하나만 주기 때문이다. 그대로 찍으면 <b>핀 하나만
 * 보인다</b> — 다섯 곳이 열려 있는데 지도에는 한 곳으로 보이고, 눌러도 맨 위의 하나만 열린다.
 *
 * <p>반경 {@code 0.00005}도는 약 5m다. 지도에서는 눌러서 구별할 만큼 벌어지고, 실제 위치로는
 * 같은 건물 안이라 사람을 엉뚱한 데로 보내지 않는다.
 *
 * <p><b>{@link FALLBACK_CLUSTER_MIN} 을 넘긴 무리는 흩지 않고 통째로 뺀다.</b> 그건 같은 건물이
 * 아니라 지오코딩이 실패해 동네 한가운데로 찍힌 값이라, 흩어 놓으면 <b>있지도 않은 자리에</b>
 * 수백 개를 뿌리는 셈이 된다. 웹은 이 판정을 개수(홈)와 지도(InteractiveMap) 두 곳에 각각 적어
 * 두고 값을 손으로 맞췄는데, 여기서는 {@code fallbackCoords.ts} 의 상수 하나를 함께 쓴다.
 *
 * <p>지도에서 빠져도 <b>목록·검색·카드에는 그대로 나온다.</b> 좌표를 못 믿는 것이지 팝업이
 * 없어진 것은 아니다.
 */

/** 흩는 데 필요한 최소 모양. 좌표는 문자열이다(백엔드가 그렇게 준다). */
export interface Spreadable {
  latitude?: string | null;
  longitude?: string | null;
}

/** 약 5m. 눌러서 구별되면서 같은 건물을 벗어나지 않는 거리. */
const SPREAD_RADIUS_DEG = 0.00005;

export function spreadOverlappingMarkers<T extends Spreadable>(markers: T[]): T[] {
  const groups = new Map<string, T[]>();
  for (const m of markers) {
    if (!m.latitude || !m.longitude) continue;
    const key = `${m.latitude},${m.longitude}`;
    const list = groups.get(key);
    if (list) list.push(m);
    else groups.set(key, [m]);
  }

  const result: T[] = [];
  for (const list of groups.values()) {
    // 지역 중심점(가짜 위치)으로 비정상적으로 몰린 무리는 지도에서 제외.
    if (list.length > FALLBACK_CLUSTER_MIN) continue;
    if (list.length === 1) {
      result.push(list[0]);
      continue;
    }
    const baseLat = parseFloat(list[0].latitude as string);
    const baseLng = parseFloat(list[0].longitude as string);
    list.forEach((m, i) => {
      const angle = (2 * Math.PI * i) / list.length;
      result.push({
        ...m,
        latitude: (baseLat + SPREAD_RADIUS_DEG * Math.cos(angle)).toString(),
        longitude: (baseLng + SPREAD_RADIUS_DEG * Math.sin(angle)).toString(),
      });
    });
  }
  return result;
}
