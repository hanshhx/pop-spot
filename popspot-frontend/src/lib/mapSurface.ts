/**
 * 지도 자리에 무엇을 그릴지 정한다 — 지도인가, 기다리는 그림인가, 없다는 말인가.
 *
 * <p>예전에는 갈래가 <b>둘</b>이었다: 지도를 그릴 수 있으면 지도, 아니면 "위치 정보가 없습니다".
 * 그런데 "아직 모른다"(테마 확정 전)와 "정말 없다"(좌표 없음)가 같은 갈래로 묶여 있었다.
 *
 * <p>그래서 좌표가 멀쩡한 팝업도 불러오는 동안 위치가 없다고 말했고, 서버가 만든 HTML 에도
 * 그대로 실려서 <b>검색엔진이 팝업 위치 페이지에서 "위치 정보가 없습니다" 를 읽어갔다.</b>
 *
 * <p>모르는 것과 없는 것은 다르다. 모를 때는 아무 말도 하지 않는다.
 */
export type MapSurface =
  /** 좌표도 테마도 준비됐다. */
  | 'map'
  /** 좌표는 있는데 아직 그릴 수 없다. 곧 지도가 된다 — 단정하지 않는다. */
  | 'loading'
  /** 좌표가 없다. 이때만 없다고 말한다. */
  | 'empty';

/**
 * @param ready 지도를 만들어도 되는 시점인가(테마 확정 등)
 * @param hasCoordinates 좌표가 실제로 있는가
 */
export function mapSurface(ready: boolean, hasCoordinates: boolean): MapSurface {
  if (!hasCoordinates) return 'empty';
  return ready ? 'map' : 'loading';
}

/**
 * 좌표 두 개가 쓸 만한 값인지.
 *
 * <p>{@code null}·빈 문자열·숫자가 아닌 값을 걸러낸다. 0 은 유효한 숫자지만 서울에서는 나올 수
 * 없는 값이라, 좌표가 비었을 때 0 으로 메워 온 데이터라면 여기서 걸러야 한다 —
 * 적도 한가운데를 팝업 위치라고 그리는 것보다 없다고 하는 편이 낫다.
 */
export function hasUsableCoordinates(lat: unknown, lng: unknown): boolean {
  const a = typeof lat === 'string' ? Number(lat) : lat;
  const b = typeof lng === 'string' ? Number(lng) : lng;
  if (typeof a !== 'number' || typeof b !== 'number') return false;
  if (!Number.isFinite(a) || !Number.isFinite(b)) return false;
  return a !== 0 && b !== 0;
}
