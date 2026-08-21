import type { PublicMapMarker } from '@/lib/mapMarkers';

/**
 * 지금 보고 있는 팝업 <b>근처에서 같이 볼</b> 팝업을 고른다.
 *
 * <p>사람은 팝업 하나만 보러 나오지 않는다. 성수까지 가서 하나만 보고 오지는 않는다는 뜻이다.
 * 그런데 상세 페이지는 그 팝업 하나로 끝나고, 근처에 뭐가 더 있는지 알려면 지도로 되돌아가서
 * 다시 찾아야 했다.
 *
 * <p>필요한 데이터는 이미 다 있다 — 좌표는 모든 팝업이 갖고 있고, 목록은 {@code loadMapMarkers}
 * 가 세션 캐시로 들고 있다. 계산만 없었다.
 */

/** 지구 반지름(km). 서울 안에서만 쓰므로 평균값으로 충분하다. */
const EARTH_RADIUS_KM = 6371;

/**
 * 두 좌표 사이 거리(km).
 *
 * <p>하버사인이다. 서울 정도 크기면 평면으로 근사해도 오차가 크지 않지만, 위도에 따라
 * 경도 1도의 실제 길이가 달라지는 것을 그냥 무시하면 동서 거리가 부풀려진다.
 */
export function distanceKm(
  aLat: number,
  aLng: number,
  bLat: number,
  bLng: number,
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * 걸어갈 만한 거리. 이 밖은 "근처" 가 아니라 <b>다음 일정</b>이라 여기서 권하지 않는다.
 *
 * <p>2km 는 성인 걸음으로 25분쯤이다. 더 넓히면 목록은 늘 채워지지만 "근처" 라는 말이 거짓이 된다.
 */
export const NEARBY_RADIUS_KM = 2;

/** 몇 개까지 보여줄지. 세 개가 넘어가면 고르는 일이 되고, 그건 지도가 할 일이다. */
export const NEARBY_LIMIT = 3;

export type NearbyPopup = {
  marker: PublicMapMarker;
  distanceKm: number;
};

/** 문자열 좌표를 숫자로. 값이 없거나 숫자가 아니면 {@code null} — 0 으로 떨어뜨리지 않는다. */
function coord(value: string | null | undefined): number | null {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/**
 * 좌표를 읽어 온다. 위도·경도가 <b>둘 다</b> 있어야 쓴다.
 *
 * <p>내보내는 이유는 시험 때문이다. 없는 값을 0 으로 메워도 서울에서는 결과가 같다 — 적도
 * 근처로 밀려나 어차피 반경 밖이 되기 때문이다. 그래서 {@link findNearby} 를 통해서는
 * 이 규칙이 지켜지는지 확인할 수 없고, 여기를 직접 봐야 한다.
 *
 * <p>결과가 같은데도 굳이 {@code null} 을 돌려주는 이유는, 0 으로 메우는 코드가 "이 팝업은
 * (0, 127) 에 있다" 고 <b>말하기</b> 때문이다. 지금은 거리 필터가 우연히 가려 주지만, 나중에
 * 누가 이 함수를 지도 핀이나 정렬에 쓰면 그 거짓말이 그대로 화면에 나온다.
 */
export function positionOf(marker: PublicMapMarker): { lat: number; lng: number } | null {
  const lat = coord(marker.latitude);
  const lng = coord(marker.longitude);
  return lat === null || lng === null ? null : { lat, lng };
}

/**
 * 이름을 견주기 좋게 다듬는다 — 공백·기호를 버리고 소문자로.
 *
 * <p>{@code '스트릿 레스토랑 파이터 셰프 릴레이 팝업'} 과 {@code '…릴레이 팝업스토어'} 처럼
 * 같은 행사가 이름만 조금 달리 두 번 들어와 있는 경우가 있다.
 */
function normalizeName(name: string): string {
  return name.toLowerCase().replace(/[\s·・,.'"()[\]{}\-–—_/]+/g, '');
}

/**
 * 같은 행사로 보이는가.
 *
 * <p>한쪽이 다른 쪽을 통째로 품고 있으면 같은 것으로 본다 — 실제로 걸린 사례가
 * "…릴레이 팝업" 과 "…릴레이 팝업스토어" 였다. 완전히 같은 이름만 걸러서는 안 잡힌다.
 *
 * <p>짧은 이름은 제외한다. {@code '팝업'} 같은 두 글자가 다른 이름 안에 들어 있다고 해서
 * 같은 행사는 아니다. 여덟 자는 이 조건에 걸릴 만큼 일반적인 한국어 팝업 이름이 드문 길이다.
 */
export function looksLikeSameEvent(a: string, b: string): boolean {
  const x = normalizeName(a);
  const y = normalizeName(b);
  if (!x || !y) return false;
  const shorter = x.length <= y.length ? x : y;
  const longer = shorter === x ? y : x;
  if (shorter.length < 8) return shorter === longer;
  return longer.includes(shorter);
}

export type FindNearbyOptions = {
  /** 지금 보고 있는 팝업. 자기 자신은 빼야 한다. */
  excludeId: number;
  /**
   * 지금 보고 있는 팝업의 이름. 같은 행사가 다른 id 로 또 들어와 있으면 이것으로 걸러진다.
   *
   * <p>id 만으로는 부족하다는 것을 실제 화면에서 봤다 — 2991 번을 보는데 1890 번이
   * "167m 거리" 로 떠 있었고, 둘은 같은 행사였다.
   */
  excludeName?: string | null;
  radiusKm?: number;
  limit?: number;
  /** 이미 끝난 팝업을 거르기 위한 기준일. {@code YYYY-MM-DD}. */
  today?: string | null;
};

/**
 * @param origin 지금 보고 있는 팝업의 좌표
 * @returns 가까운 순. 조건에 맞는 게 없으면 빈 배열 — 억지로 채우지 않는다.
 */
export function findNearby(
  origin: { lat: number; lng: number },
  markers: readonly PublicMapMarker[],
  {
    excludeId,
    excludeName = null,
    radiusKm = NEARBY_RADIUS_KM,
    limit = NEARBY_LIMIT,
    today = null,
  }: FindNearbyOptions,
): NearbyPopup[] {
  if (!Number.isFinite(origin.lat) || !Number.isFinite(origin.lng)) return [];

  const found: NearbyPopup[] = [];
  for (const marker of markers) {
    if (marker.id === excludeId) continue;
    // 지금 보고 있는 것을 "근처" 라고 권하면 안 된다. 중복 등록이라 id 는 다르다.
    if (excludeName && looksLikeSameEvent(excludeName, marker.name)) continue;
    // 이미 끝난 팝업을 "근처에서 같이 보세요" 라고 권하면 헛걸음을 시키는 것이다.
    if (today && marker.endDate && marker.endDate < today) continue;

    const pos = positionOf(marker);
    if (!pos) continue;

    const km = distanceKm(origin.lat, origin.lng, pos.lat, pos.lng);
    if (km > radiusKm) continue;
    found.push({ marker, distanceKm: km });
  }

  // 같은 거리면 id 가 큰 쪽(최근에 수집된 것)을 앞에 둔다 — 홈 레일과 같은 규칙.
  found.sort((a, b) => a.distanceKm - b.distanceKm || b.marker.id - a.marker.id);
  return found.slice(0, limit);
}

/**
 * 거리를 사람이 읽는 말로.
 *
 * <p>"0.3km" 보다 "도보 4분" 이 실제로 갈지 말지를 정하는 데 쓰인다. 다만 <b>직선 거리</b>라
 * 실제 걷는 길은 더 멀다 — 그래서 시속 4km 로 넉넉하게 잡고, 1분 미만은 올려서 0분이 안 나오게 한다.
 */
export function walkingMinutes(km: number): number {
  return Math.max(1, Math.round((km / 4) * 60));
}
