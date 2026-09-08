import { useSyncExternalStore } from 'react';

/**
 * 나란히 볼 팝업 고르기.
 *
 * <p><b>이것은 네 번째 저장소가 아니다.</b> 찜은 이미 후보 목록이고, 코스({@code myCourseItems})는
 * 이미 순서 있는 다중 선택 목록이다(중복 거절·드래그 정렬·서버 저장). 비교까지 팝업을 따로
 * 담기 시작하면 사용자가 고른 것이 <b>세 군데로 갈라지고</b>, 상세 화면 한 자리에 하트·코스담기·
 * 비교담기가 나란히 선다. 마스터 플랜 §1.3 이 "기존 코스나 플래너를 같은 역할로 새로 만들지
 * 않음" 을 못박은 지점이다.
 *
 * <p>그래서 여기 담기는 것은 <b>찜한 것 중 지금 고른 셋</b>이다. 팝업 자체가 아니라 <b>찜 위에
 * 얹힌 선택 상태</b>다. 비회원 지원이 공짜로 따라온다 — {@code guestWishlist} 가 이미 비회원 로컬
 * 저장이고, MY 탭은 2026-09-06({@code 0faba2f})부터 비회원에게 열려 있다.
 *
 * <p>계약은 {@code guestWishlist.ts} 를 그대로 본떴다. {@code popspot:} 접두 키, id 배열 + 고른 순서,
 * 손상값을 조용히 빈 목록으로, 쓰기 성공 여부를 돌려주어 화면이 거짓말하지 않게 하기.
 * <b>딱 하나를 일부러 다르게 했다</b> — 상한 처리다({@link COMPARE_MAX} 참고).
 */

export const COMPARE_SELECTION_KEY = 'popspot:compare:selected';

/** 같은 탭의 다른 화면에 알린다. 다른 탭은 브라우저의 {@code storage} 이벤트가 맡는다. */
export const COMPARE_SELECTION_EVENT = 'popspot:compare-selection';

/**
 * 한 번에 나란히 볼 수 있는 최대 개수.
 *
 * <p><b>넘치면 버리지 않고 거절한다.</b> {@code guestWishlist} 는 {@code .slice(-MAX)} 로 가장
 * 오래된 것을 말없이 버리는데, 그쪽은 상한이 100 이라 실제로 겪을 일이 드물다. 여기는 상한이
 * 3 이라 <b>매일 겪는다.</b> 네 번째를 고르는 순간 첫 번째가 조용히 사라지면 사용자는 자기가
 * 고른 것이 없어진 이유를 알 수 없다 — 화면에서는 그냥 "안 눌리는 버튼" 으로 보인다.
 *
 * <p>거절은 {@link CompareToggleResult#reason} 으로 알린다. 호출부가 그것을 받아 안내한다.
 */
export const COMPARE_MAX = 3;

/** 서버 렌더와 빈 상태가 공유하는 고정 참조. {@link useCompareSelection} 이 매번 새 배열을 만들면 안 된다. */
const EMPTY: readonly number[] = Object.freeze([]);

function read(): number[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(COMPARE_SELECTION_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    // 남이 넣어 둔 값일 수도 있고 예전 형식일 수도 있다. 숫자만, 중복 없이, 상한까지만 남긴다.
    const seen = new Set<number>();
    const ids: number[] = [];
    for (const v of parsed) {
      if (!Number.isInteger(v) || (v as number) <= 0) continue;
      const id = v as number;
      if (seen.has(id)) continue;
      seen.add(id);
      ids.push(id);
      if (ids.length === COMPARE_MAX) break;
    }
    return ids;
  } catch {
    return [];
  }
}

/**
 * 저장소에 쓴다. <b>실제로 쓰였는지</b>를 돌려준다.
 *
 * <p>{@code guestWishlist.write} 와 같은 이유다 — 저장소가 막힌 환경(시크릿 창·사이트 데이터
 * 차단·용량 초과)에서 실패를 삼키면 화면은 골라진 것처럼 보이는데 새로고침하면 사라진다.
 */
function write(ids: number[]): boolean {
  if (typeof window === 'undefined') return false;
  try {
    window.localStorage.setItem(COMPARE_SELECTION_KEY, JSON.stringify(ids));
    window.dispatchEvent(new Event(COMPARE_SELECTION_EVENT));
    return true;
  } catch {
    return false;
  }
}

/** 지금 고른 팝업 id. 고른 순서대로, 최대 {@link COMPARE_MAX} 개. */
export function readCompareSelection(): number[] {
  return read();
}

export function isCompared(popupId: number): boolean {
  return read().includes(popupId);
}

/** {@link toggleCompareSelection} 의 결과. 의도한 상태와 <b>실제 저장 여부</b>를 나눠서 준다. */
export interface CompareToggleResult {
  /** 눌린 뒤의 상태. 골라졌으면 true. */
  selected: boolean;
  /** 그 상태가 저장소에 <b>실제로 남았는가.</b> false 면 새로고침하면 사라진다. */
  saved: boolean;
  /** 거절된 이유. 지금은 상한 하나뿐이다. */
  reason?: 'full';
}

/**
 * 고르거나 뺀다.
 *
 * <p><b>해제는 상한 검사를 거치지 않는다.</b> 가득 찬 상태에서 이미 고른 것까지 못 빼면 사용자가
 * 갇힌다 — 셋을 고른 뒤에는 아무 버튼도 안 듣는 화면이 된다.
 */
export function toggleCompareSelection(popupId: number): CompareToggleResult {
  const current = read();
  if (current.includes(popupId)) {
    return { selected: false, saved: write(current.filter((id) => id !== popupId)) };
  }
  if (current.length >= COMPARE_MAX) {
    return { selected: false, saved: false, reason: 'full' };
  }
  return { selected: true, saved: write([...current, popupId]) };
}

/**
 * 목록에서 뺀다. 실제로 뺐으면 true.
 *
 * <p>{@link toggleCompareSelection} 으로 대신하지 않는 이유는 {@code guestWishlist} 와 같다 —
 * 목록 화면의 "빼기" 는 담겨 있다는 전제 아래 눌리는데 토글은 <b>없으면 담아 버린다.</b>
 * 화면과 저장소가 어긋난 순간 빼기 버튼이 담기 버튼으로 둔갑한다.
 */
export function removeCompareSelection(popupId: number): boolean {
  const current = read();
  if (!current.includes(popupId)) return false;
  write(current.filter((id) => id !== popupId));
  return true;
}

/**
 * 지정한 id 를 뺀다. 몇 개를 실제로 뺐는지 돌려준다.
 *
 * <p>찜을 해제하면 이것도 함께 부른다. 찜에서 사라진 팝업이 비교 화면에 남아 있으면 사용자가
 * 어디서 지워야 하는지 알 수 없다.
 *
 * <p><b>지금 저장소를 다시 읽는 것</b>이 이 함수의 핵심이다({@code forgetGuestWishlist} 와 같다).
 * 미리 읽어 둔 배열을 그대로 되쓰면 그 사이에 사용자가 고른 것이 조용히 지워진다.
 */
export function forgetCompareSelection(ids: number[]): number {
  if (ids.length === 0) return 0;
  const gone = new Set(ids);
  const current = read();
  const next = current.filter((id) => !gone.has(id));
  if (next.length === current.length) return 0;
  write(next);
  return current.length - next.length;
}

export function clearCompareSelection(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(COMPARE_SELECTION_KEY);
    window.dispatchEvent(new Event(COMPARE_SELECTION_EVENT));
  } catch {
    /* 못 지워도 다음 선택에서 덮인다. */
  }
}

/**
 * {@link useSyncExternalStore} 에 줄 스냅샷. <b>내용이 같으면 같은 참조</b>를 돌려준다.
 *
 * <p>선례({@code externalMediaConsent})는 값이 boolean 이라 이 문제가 없었다. 배열을 매번 새로
 * 만들어 돌려주면 React 는 스냅샷이 계속 바뀐다고 보고 <b>무한 렌더</b>에 빠진다. 그래서 마지막
 * 결과를 내용 키({@code join(',')})로 캐싱한다 — 다른 탭이 저장소를 바꿔도 키가 달라지므로
 * 새 참조가 나간다.
 */
let cachedIds: number[] = [];
let cachedKey: string | null = null;

export function getCompareSnapshot(): number[] {
  const ids = read();
  const key = ids.join(',');
  if (key === cachedKey) return cachedIds;
  cachedKey = key;
  cachedIds = ids;
  return cachedIds;
}

function subscribe(onStoreChange: () => void): () => void {
  window.addEventListener('storage', onStoreChange);
  window.addEventListener(COMPARE_SELECTION_EVENT, onStoreChange);
  return () => {
    window.removeEventListener('storage', onStoreChange);
    window.removeEventListener(COMPARE_SELECTION_EVENT, onStoreChange);
  };
}

/** 지금 고른 id 목록. 저장소가 바뀌면 같은 탭·다른 탭 모두에서 다시 그려진다. */
export function useCompareSelection(): number[] {
  return useSyncExternalStore(subscribe, getCompareSnapshot, () => EMPTY as number[]);
}
