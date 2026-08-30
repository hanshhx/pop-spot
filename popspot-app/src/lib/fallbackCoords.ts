/**
 * 지오코딩이 실패했을 때 찍힌 <b>지역 중심점</b>을 알아낸다.
 *
 * <p>주소가 모호하면("서울 성동구") 카카오는 그 동네 한가운데 좌표 하나를 돌려준다. 서로 다른
 * 팝업 수백 곳이 <b>똑같은 좌표</b>를 받게 되고, 지도에서는 한 점에 링처럼 뭉쳐 보인다. 눌러도
 * 그 자리에 그 팝업은 없다 — 좌표가 없는 것보다 나쁘다.
 *
 * <p>구분법은 개수뿐이다. 진짜로 같은 건물에서 열리는 팝업(더현대·롯데월드몰)도 좌표가 같지만
 * 수십 곳을 넘지는 않는다. 그래서 문턱을 넘긴 좌표만 "가짜" 로 본다.
 *
 * <p>웹은 이 판정을 {@code app/HomeClient.tsx} 안에 두고 {@code InteractiveMap} 의 같은 이름
 * 상수와 값을 손으로 맞춰 두었다. 앱에서는 한 파일로 꺼냈다 — 두 곳에 같은 숫자를 적어 두면
 * 한쪽만 고쳤을 때 "개수는 줄었는데 지도에는 그대로" 가 된다.
 */

/**
 * 한 좌표에 이보다 많이 뭉치면 지역 중심점으로 본다.
 *
 * <p>웹 {@code HomeClient.FALLBACK_CLUSTER_MIN}·{@code InteractiveMap} 과 같은 값이다. 바꿀 때는
 * 웹도 함께 바꿔야 앱과 웹의 개수가 갈리지 않는다.
 */
export const FALLBACK_CLUSTER_MIN = 40;

/** 좌표를 가진 최소 모양. 목록·마커 어느 쪽이든 받는다. */
export interface Located {
  latitude?: string | null;
  longitude?: string | null;
}

/** 좌표 두 개를 하나의 키로. 문자열 그대로 쓴다 — 반올림하면 서로 다른 좌표가 합쳐진다. */
function coordKey(p: Located): string | null {
  if (!p.latitude || !p.longitude) return null;
  return `${p.latitude},${p.longitude}`;
}

/**
 * 목록 전체를 훑어 "가짜 위치" 좌표 집합을 만든다.
 *
 * <p>목록이 통째로 있어야 셀 수 있으므로 화면 하나가 아니라 <b>목록을 들고 있는 곳</b>에서 한 번만
 * 부른다. 부분 목록(카테고리로 거른 것)으로 부르면 문턱을 못 넘겨 가짜 위치가 되살아난다.
 */
export function fallbackCoordKeys(all: Located[]): Set<string> {
  const counts = new Map<string, number>();
  for (const p of all) {
    const k = coordKey(p);
    if (k) counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  const keys = new Set<string>();
  for (const [k, n] of counts) if (n > FALLBACK_CLUSTER_MIN) keys.add(k);
  return keys;
}

/**
 * 지도에서 <b>실제로 찾을 수 있는</b> 팝업인가 — 개수·검색 이동 공용 판정.
 *
 * <p>좌표가 숫자로 읽혀야 하고, 위의 가짜 위치가 아니어야 한다. 빈 문자열을 그냥
 * {@code Number()} 에 넘기면 {@code Number(' ') === 0} 이라 통과해서 서아프리카 앞바다(0,0)에
 * 핀이 찍힌다 — {@code parseFloat} 는 빈 문자열에 {@code NaN} 을 주므로 그쪽을 쓴다.
 */
export function hasRealMapLocation(p: Located, fallback: Set<string>): boolean {
  const lat = parseFloat(p.latitude ?? '');
  const lng = parseFloat(p.longitude ?? '');
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
  return !fallback.has(`${p.latitude},${p.longitude}`);
}
