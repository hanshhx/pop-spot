import { useSyncExternalStore } from 'react';

/**
 * 발견에서 <b>이번 탐색만</b> 빼 두는 팝업.
 *
 * <p><b>왜 {@code sessionStorage} 인가.</b> 기획 §4.4 가 성격을 못박았다 — "'넘기기' 는 이번
 * 탐색에서 제외하는 뜻이며 <b>영구 취향으로 단정하지 않는다.</b>" {@code localStorage} 에 두면
 * 그 문장을 코드가 어긴다. 한 번 넘긴 팝업이 몇 달 뒤에도 안 보이고, 그건 우리가 사용자의
 * 취향을 확정해 버린 것이다. 탭을 닫으면 사라지는 저장소가 "이번 탐색" 의 정확한 표현이다.
 * ({@code returnTo.ts} 도 같은 저장소를 쓰지만 이유는 다르다 — 그쪽은 OAuth 왕복을 건너려고다.)
 *
 * <p>계약은 {@code compareSelection.ts} 를 본떴다. {@code popspot:} 접두 키, 넘긴 순서 유지,
 * 손상값을 조용히 빈 목록으로, 쓰기 성공 여부를 돌려주기, 되돌리기를 토글로 대신하지 않기.
 *
 * <p><b>상한 처리만 반대로 한다</b>({@link DISCOVER_SKIP_MAX} 참고).
 */

export const DISCOVER_SKIP_KEY = 'popspot:discover:skipped';

/**
 * 같은 탭의 다른 화면에 알린다.
 *
 * <p>{@code compareSelection} 과 달리 {@code 'storage'} 이벤트를 듣지 않는다 —
 * {@code sessionStorage} 는 탭마다 따로라 다른 탭에서 바뀔 일이 없고, 그 이벤트도 오지 않는다.
 */
export const DISCOVER_SKIP_EVENT = 'popspot:discover-skipped';

/**
 * 한 탐색에서 넘길 수 있는 최대 개수.
 *
 * <p><b>넘치면 가장 오래된 것부터 버린다 — 비교와 반대다.</b> {@code compareSelection} 은 상한에서
 * <b>거절</b>한다. 거기서 오래된 것을 버리면 사용자가 <b>고른 것</b>이 소리 없이 사라지기 때문이다.
 *
 * <p>넘기기는 잃을 것이 없다. 오래된 넘김이 밀려나면 그 팝업이 다시 보일 뿐이고, 그건 손실이
 * 아니라 원래 상태다. 게다가 거절하면 "넘겨지지 않는 카드" 가 생겨 화면이 멈춘 것처럼 보인다.
 * <b>같은 상황에서 반대로 하는 이유가 이것이다 — 버려서 잃는 것이 무엇인지가 다르다.</b>
 */
export const DISCOVER_SKIP_MAX = 200;

const EMPTY: readonly number[] = Object.freeze([]);

function read(): number[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.sessionStorage.getItem(DISCOVER_SKIP_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const seen = new Set<number>();
    const ids: number[] = [];
    for (const v of parsed) {
      if (!Number.isInteger(v) || (v as number) <= 0) continue;
      const id = v as number;
      if (seen.has(id)) continue;
      seen.add(id);
      ids.push(id);
    }
    return ids.slice(-DISCOVER_SKIP_MAX);
  } catch {
    return [];
  }
}

/** 저장소에 쓴다. <b>실제로 쓰였는지</b>를 돌려준다({@code guestWishlist} 와 같은 이유). */
function write(ids: number[]): boolean {
  if (typeof window === 'undefined') return false;
  try {
    window.sessionStorage.setItem(DISCOVER_SKIP_KEY, JSON.stringify(ids));
    window.dispatchEvent(new Event(DISCOVER_SKIP_EVENT));
    return true;
  } catch {
    return false;
  }
}

/** 이번 탐색에서 넘긴 팝업 id. 넘긴 순서대로. */
export function readSkipped(): number[] {
  return read();
}

export function isSkipped(popupId: number): boolean {
  return read().includes(popupId);
}

/** {@link skipPopup} 의 결과. 의도한 상태와 <b>실제 저장 여부</b>를 나눠서 준다. */
export interface SkipResult {
  /** 넘긴 상태인가. 이미 넘긴 것을 또 넘겨도 true. */
  skipped: boolean;
  /** 그 상태가 저장소에 <b>실제로 남았는가.</b> */
  saved: boolean;
}

/** 이번 탐색에서 뺀다. 이미 넘긴 것은 순서를 바꾸지 않는다. */
export function skipPopup(popupId: number): SkipResult {
  const current = read();
  if (current.includes(popupId)) return { skipped: true, saved: true };
  return { skipped: true, saved: write([...current, popupId].slice(-DISCOVER_SKIP_MAX)) };
}

/**
 * 넘긴 것을 되돌린다. 실제로 뺐으면 true.
 *
 * <p>토글로 대신하지 않는다 — 되돌리기 버튼이 넘기기 버튼으로 둔갑하면 안 된다
 * ({@code guestWishlist.removeGuestWishlist} 와 같은 이유).
 */
export function unskipPopup(popupId: number): boolean {
  const current = read();
  if (!current.includes(popupId)) return false;
  write(current.filter((id) => id !== popupId));
  return true;
}

export function clearSkipped(): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.removeItem(DISCOVER_SKIP_KEY);
    window.dispatchEvent(new Event(DISCOVER_SKIP_EVENT));
  } catch {
    /* 못 지워도 탭을 닫으면 사라진다. */
  }
}

/**
 * {@link useSyncExternalStore} 에 줄 스냅샷. <b>내용이 같으면 같은 참조</b>를 돌려준다.
 *
 * <p>배열을 매번 새로 만들어 돌려주면 React 가 스냅샷이 계속 바뀐다고 보고 무한 렌더에 빠진다
 * ({@code compareSelection} 이 같은 대가를 치르고 남긴 교훈).
 */
let cachedIds: number[] = [];
let cachedKey: string | null = null;

export function getSkipSnapshot(): number[] {
  const ids = read();
  const key = ids.join(',');
  if (key === cachedKey) return cachedIds;
  cachedKey = key;
  cachedIds = ids;
  return cachedIds;
}

function subscribe(onStoreChange: () => void): () => void {
  window.addEventListener(DISCOVER_SKIP_EVENT, onStoreChange);
  return () => window.removeEventListener(DISCOVER_SKIP_EVENT, onStoreChange);
}

/** 이번 탐색에서 넘긴 id 목록. */
export function useSkipped(): number[] {
  return useSyncExternalStore(subscribe, getSkipSnapshot, () => EMPTY as number[]);
}
