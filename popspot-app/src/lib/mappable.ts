import type { PublicMapMarker } from './mapMarkers';
import { isOpenNow } from './popupSlices';
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

/**
 * {@link mappable} 앞에 {@link isOpenNow} 를 한 겹 더 두른 것 — 슬라이스 랜딩 지도가 실제로
 * 세고 찍는 모집단.
 *
 * <p>{@link mappable} 은 좌표·서울 경계만 본다. 날짜는 모른다. 그런데 지도를 그리는
 * {@code InteractiveMap} 은 받은 마커를 자기 안에서 다시 {@code isOpenNow} 로 거른다(홈·랭킹과
 * 같은 판정 기준을 쓰기 위해서다 — {@link isOpenNow} 문서 참고). 호출하는 쪽이 이 필터를 먼저
 * 걸지 않으면, 여기서 세는 개수(N/M)에는 아직 시작하지 않은 팝업이 들어가는데 정작 지도에는
 * 그 팝업의 핀이 찍히지 않는다 — 화면이 "393곳 중 372곳 표시" 라고 적어놓고 실제로 찍히는 건
 * 더 적은 상태가 된다.
 *
 * <p>그래서 이 함수가 필터와 집계를 한곳에 묶는다. 두 곳(지도가 찍는 것, 페이지가 세는 것)이
 * 각자 따로 {@code isOpenNow} 를 부르면 한쪽만 고쳤을 때 다시 갈라질 수 있다.
 */
export function openMappable(markers: PublicMapMarker[], today: Date): Mappable {
  return mappable(markers.filter((marker) => isOpenNow(marker.startDate, marker.endDate, today)));
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

/**
 * 백분위 자르기가 쓰는 중앙값. 짝수 개면 가운데 두 값의 평균.
 *
 * <p>평균이 아니라 중앙값을 쓰는 이유는 {@link coreBounds} 문서에 있다 — 여기서는 계산만 한다.
 */
function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

/**
 * {@link coreBounds} 가 5% 를 잘라내는 기준. 95를 고른 근거는 함수 문서 참고.
 */
const CORE_PERCENTILE = 95;

/**
 * 이 개수 미만이면 {@link coreBounds} 는 자르지 않고 {@link markerBounds} 를 그대로 돌려준다.
 *
 * <p>95번째 백분위는 "가장 먼 5%를 버린다" 는 약속이다. 마커가 20개보다 적으면 <b>단 하나</b>를
 * 잘라내는 것만으로 이미 그 약속을 넘어선다 — 20개 중 1개는 정확히 5%지만, 10개 중 1개는 10%,
 * 3개 중 1개는 33%다("3개 중 가장 먼 것 하나를 버리면 데이터의 3분의 1을 버리는 것"과 같은
 * 경우다). 20을 문턱으로 두면 "1개를 잘라내는 것 자체가 목표 비율(5%)을 넘지 않는" 가장 작은
 * 개수가 되어, 실제로 잘리는 비율이 항상 약속한 5% 이내로 유지된다.
 */
const CORE_MIN_COUNT = 20;

/**
 * {@link markerBounds} 처럼 사각형을 돌려주지만, <b>극단값 몇 개가 아니라 마커 대다수</b>가
 * 화면에 들어오도록 좁힌다.
 *
 * <p>{@code markerBounds} 는 정직한 min/max라서 마커 106개가 성수에 촘촘히 모여 있어도 나머지
 * 6개(주소 텍스트에 "성수" 가 섞였을 뿐 실제로는 몇 km 떨어진 뉴발란스 덕진점·캐릭터 올스타전
 * 같은 곳)가 사각형을 도시 규모로 늘려 버린다. this-week 처럼 정말로 서울 전역에 흩어진
 * 슬라이스에서는 같은 계산이 옳은 답을 낸다 — 그래서 고정 반경으로 자르는 방식은 못 쓴다.
 * 성수는 좁게, this-week 는 넓게 — 둘 다 "마커 대부분이 모인 곳" 이라는 <b>같은 기준</b>으로
 * 답이 갈라져야 한다.
 *
 * <p><b>중심은 평균이 아니라 위도·경도 각각의 중앙값.</b> 평균은 지금 자르려는 바로 그 극단값에
 * 끌려간다 — 뉴발란스 덕진점 하나가 평균을 북서쪽으로 당기면, 나머지 106개와의 거리도 함께
 * 틀어진다. 중앙값은 몇 개가 아무리 멀어도 흔들리지 않는다.
 *
 * <p><b>거리는 위도 차·경도 차(× cos(중앙값 위도))의 평면 유클리드로 잰다.</b> 정확한
 * 지구 곡률 거리(하버사인, {@code src/lib/walkGroups.ts} 의 {@code walkInfo} 에 이미 있다)를
 * 다시 쓰지 않은 이유: {@code walkInfo} 는 도보 보정(1.3배)과 "1.5km"/"723m" 같은 반올림·문자열 포맷까지 함께
 * 묶여 있어, 순위를 매길 원시 거리(km)를 꺼내려면 그 포맷을 다시 파싱해야 한다 — 재사용이 아니라
 * 재구현이 된다. 여기 필요한 건 "누가 더 먼가" 라는 <b>상대적 순서</b>뿐이고, 서울 위도(약
 * 37.5˚N)·이 규모의 거리(수~수십 km)에서 경도 보정 유클리드와 하버사인의 오차는 순서를 바꿀
 * 만큼 벌어지지 않는다. 경도 보정을 빼면 위도 1도(~111km)보다 경도 1도(~88km)가 실제로는 짧은데
 * 같은 무게로 계산돼 동서로 더 쉽게 잘리므로, {@code cos(lat)} 보정은 뺄 수 없다.
 *
 * <p><b>{@link CORE_MIN_COUNT} 미만이면 자르지 않는다</b> — 상수 문서에 근거가 있다. 자를 때도
 * 잘려나간 마커는 지도에서 사라지지 않는다: 이 함수는 <b>카메라가 어디를 비출지</b>만 정하고,
 * {@code mappable}/{@code openMappable} 이 이미 정해 둔 {@code shown}·개수 문구는 그대로 둔다 —
 * 방문자가 지도를 줌아웃하면 잘려나간 마커도 그대로 보인다.
 *
 * <p>마커가 전부 같은 좌표거나 하나뿐이면 거리가 전부 0(또는 계산 자체가 없음)이라 그대로
 * {@link markerBounds} 와 같은 넓이 0 사각형이 나온다 — 따로 분기하지 않아도 자연스럽게
 * 같아진다.
 */
export function coreBounds(markers: PublicMapMarker[]): MarkerBounds | undefined {
  const coords = markers
    .filter((marker) => isCoord(marker.latitude) && isCoord(marker.longitude))
    .map((marker) => ({ lat: Number(marker.latitude), lng: Number(marker.longitude) }));
  if (coords.length === 0) return undefined;
  if (coords.length < CORE_MIN_COUNT) return markerBounds(markers);

  const medianLat = median(coords.map((c) => c.lat));
  const medianLng = median(coords.map((c) => c.lng));
  const lngWeight = Math.cos((medianLat * Math.PI) / 180);

  const distances = coords.map((c) => {
    const dLat = c.lat - medianLat;
    const dLng = (c.lng - medianLng) * lngWeight;
    return Math.sqrt(dLat * dLat + dLng * dLng);
  });

  // 가장 가까운 ceil(95%) 개를 남긴다 — 나머지(최대 5%, 최소 1개)가 사각형 밖으로 빠진다.
  const sortedDistances = [...distances].sort((a, b) => a - b);
  const keepCount = Math.ceil((CORE_PERCENTILE / 100) * sortedDistances.length);
  const threshold = sortedDistances[keepCount - 1];

  let minLat = Infinity;
  let maxLat = -Infinity;
  let minLng = Infinity;
  let maxLng = -Infinity;
  coords.forEach((c, i) => {
    if (distances[i] > threshold) return;
    minLat = Math.min(minLat, c.lat);
    maxLat = Math.max(maxLat, c.lat);
    minLng = Math.min(minLng, c.lng);
    maxLng = Math.max(maxLng, c.lng);
  });
  return { minLat, maxLat, minLng, maxLng };
}
