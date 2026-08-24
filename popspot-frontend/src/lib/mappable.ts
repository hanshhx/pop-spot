import type { PublicMapMarker } from './mapMarkers';
import { isCoordOutsideSeoul } from './seoulGuard';

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
 * <p>좌표가 서울 경계 사각형({@code SEOUL_BOX}, seoulGuard) 밖으로 증명된 마커는 shown 뿐
 * 아니라 <b>total 계산 전에</b> 통째로 뺀다. {@code public/seoul.pmtiles} 가 서울 언저리만 담고
 * 있어 그 밖 좌표는 애초에 지도에 유의미하게 찍을 방법이 없다(부산 팝업 한 건이 this-week 화면을
 * 한반도 전체로 넓히던 사례 — {@link markerBounds} 문서 참고). 여기서는
 * {@link isCoordOutsideSeoul}(좌표만 보는 절반)만 쓰고 {@code isProvenOutsideSeoul}(주소 표기
 * 규칙까지 더한 전체)은 쓰지 않는다 — 판교 8건처럼 표기는 서울 밖인데 좌표는 37.51(서울 한복판)로
 * 잘못 지오코딩된 행은 우리 타일 위에 멀쩡히 찍히므로 지도 계산에서 뺄 이유가 없다. 목록의
 * "서울 밖" 배지는 이 함수와 무관하게 그대로 남는다 — 밝히지 않는 건 지도뿐, 목록이 아니다.
 *
 * <p>순서는 다시 정하지 않는다. 호출한 쪽이 이미 정한 순서를 그대로 두고 걸러내기만 한다.
 */
export function mappable(markers: PublicMapMarker[]): Mappable {
  const inSeoulBox = markers.filter((marker) => !isCoordOutsideSeoul(marker));
  return {
    shown: inSeoulBox.filter((marker) => isCoord(marker.latitude) && isCoord(marker.longitude)),
    total: inSeoulBox.length,
  };
}

/** {@link markerBounds} 가 돌려주는 사각형 — 지도의 fitBounds 가 그대로 받는 모양. */
export interface MarkerBounds {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
}

/**
 * 찍히는 마커가 전부 화면에 들어오도록 사각형(최소/최댓값)을 구한다.
 *
 * <p>예전엔 좌표 평균(중심점) 하나만 지도에 넘겼다({@code markersCenter}, 지금은 지웠다) — 지도는
 * 그 중심으로 <b>이동</b>만 하고 <b>줌</b>은 고정된 채였다. 성수처럼 좁은 지역은 우연히 다
 * 들어왔지만, this-week 처럼 서울 전역에 흩어진 마커는 중심이 한강 한복판이라 나머지 대부분이
 * 화면 밖이었다 — "488곳 중 406곳 표시" 라고 적어놓고 실제로 보이는 건 9곳뿐이었다.
 *
 * <p>중심 대신 <b>사각형</b>을 돌려준다 — 호출하는 쪽이 지도의 fitBounds 에 그대로 넘기면 지도가
 * 줌까지 알아서 맞춘다. 마커가 하나거나 전부 같은 좌표면 넓이 0 인 사각형이 나오는데, 그건
 * 정상이다 — fitBounds 를 부르는 쪽(InteractiveMap)이 maxZoom 으로 과도한 확대를 막는다.
 *
 * <p>{@link mappable} 이 이미 걸러낸 목록({@code .shown})을 받는 게 정상 경로지만, 방어적으로
 * 여기서도 {@code isCoord} 로 다시 거른다 — 좌표 없는 마커가 섞여 들어와도 {@code Number(null)}
 * 같은 값이 사각형을 왜곡하지 않는다.
 */
export function markerBounds(markers: PublicMapMarker[]): MarkerBounds | undefined {
  const coords = markers.filter((marker) => isCoord(marker.latitude) && isCoord(marker.longitude));
  if (coords.length === 0) return undefined;

  let minLat = Infinity;
  let maxLat = -Infinity;
  let minLng = Infinity;
  let maxLng = -Infinity;
  for (const marker of coords) {
    const lat = Number(marker.latitude);
    const lng = Number(marker.longitude);
    minLat = Math.min(minLat, lat);
    maxLat = Math.max(maxLat, lat);
    minLng = Math.min(minLng, lng);
    maxLng = Math.max(maxLng, lng);
  }
  return { minLat, maxLat, minLng, maxLng };
}
