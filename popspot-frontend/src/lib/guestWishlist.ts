/**
 * 로그인하지 않은 사람의 찜.
 *
 * <p><b>왜 필요한가.</b> 실측(2026-09-01) 7일간 찜한 사람이 <b>0명</b>이었다. 기능이 안 팔린 것이
 * 아니라 <b>누를 수가 없었다</b> — 비회원이 찜을 누르면 "로그인이 필요합니다" 를 띄우고 곧장
 * {@code /login} 으로 보냈다. 그 7일 방문자 1,561명 중 회원은 <b>4명</b>이다. 99.7% 가 벽을 만난다.
 *
 * <p>그리고 그 벽은 방문을 끝낸다. 랜딩 → 상세 → 찜 시도 → 로그인 화면. 관심을 표시하려던
 * 사람을 정확히 그 순간에 내보낸다.
 *
 * <p><b>여기 담긴 것은 서버로 옮겨진다.</b> 로그인하면 {@link takeGuestWishlist} 로 꺼내 서버에
 * 올리고 비운다. 안 그러면 가입한 순간 모아 둔 것이 조용히 사라져, 가입이 손해처럼 느껴진다.
 *
 * <p>저장소가 막힌 환경(시크릿 창·차단 설정)에서는 조용히 빈 목록으로 동작한다. 찜이 안 남는 것은
 * 아쉽지만, 그것 때문에 화면이 깨지는 것보다는 낫다.
 */

export const GUEST_WISHLIST_KEY = 'popspot:guest:wishlist';

/**
 * 담을 수 있는 최대 개수.
 *
 * <p>비회원 목록은 서버로 올라가기 전까지 브라우저에만 있다. 무한정 쌓이면 로그인할 때 그만큼
 * 요청이 나가므로 상한을 둔다. 넘으면 <b>가장 오래된 것</b>부터 버린다 — 방금 담은 것이 사라지면
 * 눌러도 안 되는 것처럼 보인다.
 */
export const GUEST_WISHLIST_MAX = 100;

function read(): number[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(GUEST_WISHLIST_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    // 남이 넣어 둔 값일 수도 있고 예전 형식일 수도 있다. 숫자만 남긴다.
    return parsed.filter((v): v is number => Number.isInteger(v) && (v as number) > 0);
  } catch {
    return [];
  }
}

function write(ids: number[]): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(GUEST_WISHLIST_KEY, JSON.stringify(ids));
  } catch {
    /* 저장소가 막혀 있으면 이번 담기는 기억되지 않는다. 화면은 그대로 둔다. */
  }
}

/** 지금 담겨 있는 팝업 id. 담은 순서대로. */
export function readGuestWishlist(): number[] {
  return read();
}

export function isGuestWished(popupId: number): boolean {
  return read().includes(popupId);
}

/**
 * 담거나 뺀다. <b>바뀐 뒤의 상태</b>를 돌려준다(담겼으면 true).
 *
 * <p>호출부가 그 값으로 화면을 갱신하므로, 저장소가 막혀 있어도 이 반환값은 정직해야 한다 —
 * 그래서 저장 결과가 아니라 <b>의도한 다음 상태</b>를 돌려준다. 새로고침하면 사라지지만
 * 그 자리에서 눌린 것처럼 보이는 편이 낫다.
 */
export function toggleGuestWishlist(popupId: number): boolean {
  const current = read();
  const has = current.includes(popupId);
  const next = has
    ? current.filter((id) => id !== popupId)
    : [...current, popupId].slice(-GUEST_WISHLIST_MAX);
  write(next);
  return !has;
}

/**
 * 목록을 <b>꺼내면서 비운다.</b> 로그인 직후 서버로 옮길 때 쓴다.
 *
 * <p>비우는 것까지 한 번에 하는 이유는, 꺼내 놓고 옮기다 실패했을 때 <b>같은 것을 두 번 올리는</b>
 * 일을 막기 위해서다. 서버 찜은 멱등이라 두 번 올려도 결과는 같지만, 실패한 것을 되돌려 놓는
 * 책임은 호출부에 있다({@link restoreGuestWishlist}).
 */
export function takeGuestWishlist(): number[] {
  const ids = read();
  if (ids.length > 0) write([]);
  return ids;
}

/** 서버로 못 옮긴 것을 되돌려 놓는다. 이미 담긴 것과 합치되 중복은 만들지 않는다. */
export function restoreGuestWishlist(ids: number[]): void {
  if (ids.length === 0) return;
  const current = read();
  const merged = [...ids.filter((id) => !current.includes(id)), ...current];
  write(merged.slice(-GUEST_WISHLIST_MAX));
}

export function clearGuestWishlist(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(GUEST_WISHLIST_KEY);
  } catch {
    /* 못 지워도 다음 로그인에서 다시 시도한다. */
  }
}
