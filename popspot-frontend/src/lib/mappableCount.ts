import { groupSameEvent, type GroupableEvent } from '@/lib/groupSameEvent';
import { isOpenNow, kstTodayStart } from '@/lib/popupSlices';

/**
 * <b>갈 수 있는 팝업의 수.</b>
 *
 * <p><b>왜 따로 빼 놨나.</b> 홈 화면의 "지금 서울에 N개" 와 검색 결과 제목의 "N곳" 이 <b>같은 수를
 * 말해야 한다.</b> 검색에서 1,191곳을 보고 들어왔는데 화면이 1,014곳이라고 하면 첫 3초에 신뢰를
 * 잃는다. 랜딩 메타 주석에도 같은 경고가 있다 — "목록은 2줄인데 제목이 8곳이라고 하면 그 자체가
 * 또 하나의 거짓말이다".
 *
 * <p>실제로 2026-09-03 에 그 어긋남을 만들 뻔했다. 메타는 "열려 있는가" 만 보고 1,191을 냈는데
 * 화면은 좌표와 중복까지 걸러 1,014를 세고 있었다. 두 벌로 두면 반드시 갈라지므로 한 곳에 둔다.
 *
 * <p><b>무엇을 세는가.</b> 셀 수 있는 것이 아니라 <b>갈 수 있는 것</b>을 센다.
 *
 * <ol>
 *   <li>지금 열려 있고
 *   <li>진짜 좌표가 있고 — 없거나 지역 중심점에 뭉친 것은 눌러도 지도에서 못 찾는다
 *   <li>같은 행사가 여러 줄로 들어온 것은 하나로 — 갈 수 있는 곳은 한 곳이다
 * </ol>
 */

/** 한 좌표에 이보다 많이 뭉치면 진짜 위치가 아니라 지역 중심점으로 본다. */
export const FALLBACK_CLUSTER_MIN = 40;

interface Placed {
  latitude?: string | null;
  longitude?: string | null;
}

/**
 * 지역 중심점으로 쓰인 좌표들.
 *
 * <p>수백 곳이 한 점에 뭉쳐 있으면 그건 실제 주소가 아니라 "서울 어딘가" 를 뜻하는 대표값이다.
 */
export function fallbackCoordKeys(popups: readonly Placed[]): Set<string> {
  const counts = new Map<string, number>();
  for (const p of popups) {
    if (p.latitude && p.longitude) {
      const k = `${p.latitude},${p.longitude}`;
      counts.set(k, (counts.get(k) ?? 0) + 1);
    }
  }
  const keys = new Set<string>();
  for (const [k, n] of counts) if (n > FALLBACK_CLUSTER_MIN) keys.add(k);
  return keys;
}

/** 지도에 실제로 찍히는가 — 좌표가 읽히고, 지역 중심점이 아니어야 한다. */
export function isMappable(p: Placed, fallbacks: Set<string>): boolean {
  const lat = Number.parseFloat(p.latitude ?? '');
  const lng = Number.parseFloat(p.longitude ?? '');
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
  return !fallbacks.has(`${p.latitude},${p.longitude}`);
}

/** {@code groupSameEvent} 가 이름으로 같은 행사를 묶으므로 name 이 필요하다. */
type Countable = Placed & GroupableEvent;

/**
 * 화면이 내거는 그 수.
 *
 * <p>{@code HomeClient} 의 {@code mappablePopupCount} 와 <b>같은 정의</b>여야 한다. 한쪽만 고치면
 * 검색 결과와 화면이 다른 말을 하게 된다.
 */
export function countGoAble(
  popups: readonly Countable[] | null | undefined,
  today: Date = kstTodayStart(),
): number {
  if (!popups?.length) return 0;
  const open = popups.filter((p) => isOpenNow(p.startDate, p.endDate, today));
  const fallbacks = fallbackCoordKeys(open);
  const mappable = open.filter((p) => isMappable(p, fallbacks));
  return groupSameEvent(mappable).length;
}
