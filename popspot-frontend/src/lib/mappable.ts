import type { PublicMapMarker } from './mapMarkers';

/** {@link mappable} 이 돌려주는 결과. */
export interface Mappable {
  /** 좌표가 있어 지도에 찍을 수 있는 것만. 원래 순서를 그대로 유지한다. */
  shown: PublicMapMarker[];
  /** 걸러내기 <b>전</b> 전체 개수. 화면이 "N곳 중 M곳" 이라고 적을 때 N 쪽이다. */
  total: number;
}

/** 문자열 좌표 하나가 지도에 찍을 수 있는 값인지 본다. */
function isCoord(value: string | null): boolean {
  if (value === null) return false;
  const trimmed = value.trim();
  if (trimmed === '') return false;
  return Number.isFinite(Number(trimmed));
}

/**
 * 지도에 찍을 수 있는 것만 고른다.
 *
 * <p>랜딩은 "지도 한눈에" 라고 말하지만 좌표는 3분의 1 가까이 비어 있다(성수 98곳 중 65곳).
 * 없는 것을 숨기면 지도가 조용히 짧아지고, 방문자는 목록에 있는 팝업이 왜 지도에 없는지 알 수
 * 없다. 그래서 <b>고르되 센다</b> — 화면이 "98곳 중 65곳" 이라고 적을 수 있게 둘 다 돌려준다.
 *
 * <p>{@code latitude}·{@code longitude} 는 문자열이다. 빈 문자열이나 공백만 든 문자열은
 * {@code trim()} 없이 그냥 {@code Number()} 에 넘기면 {@code Number(' ') === 0} 이라 통과해
 * 버린다. {@code (0, 0)} 은 서아프리카 앞바다다. 좌표가 깨진 행이 전부 그리로 모이면 서울 지도는
 * 비고 대서양에 핀이 뭉친다 — 빈 값보다 나쁜 종류의 거짓말이라, <b>trim 을 먼저</b> 하고
 * {@code Number.isFinite} 로 거른다.
 *
 * <p>순서는 다시 정하지 않는다. 호출한 쪽이 이미 정한 순서를 그대로 두고 걸러내기만 한다.
 */
export function mappable(markers: PublicMapMarker[]): Mappable {
  return {
    shown: markers.filter((marker) => isCoord(marker.latitude) && isCoord(marker.longitude)),
    total: markers.length,
  };
}
