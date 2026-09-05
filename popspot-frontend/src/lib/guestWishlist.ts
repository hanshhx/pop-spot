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
 * <p><b>여기 담긴 것은 서버로 옮겨진다.</b> 로그인하면 {@code lib/migrateGuestWishlist.ts} 가
 * 서버에 올리고, <b>올라간 것이 확인된 것만</b> {@link forgetGuestWishlist} 로 뺀다. 안 그러면
 * 가입한 순간 모아 둔 것이 조용히 사라져, 가입이 손해처럼 느껴진다.
 *
 * <p><b>이 파일은 옮기기를 직접 하지 않는다.</b> 예전에는 여기에 "꺼내면서 비우는" 함수가 있었고
 * 그 주석은 "서버 찜은 멱등이라 두 번 올려도 결과는 같다" 고 적고 있었다. <b>사실이 아니다</b> —
 * 서버의 {@code POST /api/wishlist/{userId}/{popupId}} 는 토글이라 두 번 올리면 지워진다. 그
 * 잘못된 전제 위에서 이미 찜한 팝업이 이전 중에 삭제됐다. 지금은 저장소가 무엇을 뺄지 스스로
 * 정하지 않고, 서버 상태를 아는 쪽이 id 를 지정해 빼도록 한다.
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
 * 목록에서 뺀다. 없으면 아무 일도 없다.
 *
 * <p>{@link toggleGuestWishlist} 로 대신하지 않는 이유는, 목록 화면의 "빼기" 는 담겨 있다는 전제
 * 아래 눌리는데 토글은 <b>없으면 담아 버리기</b> 때문이다. 화면과 저장소가 어긋난 순간
 * 빼기 버튼이 담기 버튼으로 둔갑한다.
 */
export function removeGuestWishlist(popupId: number): void {
  const current = read();
  if (!current.includes(popupId)) return;
  write(current.filter((id) => id !== popupId));
}

/**
 * <b>서버에 있는 것이 확인된 id 만</b> 목록에서 뺀다. 몇 개를 실제로 뺐는지 돌려준다.
 *
 * <p>이전(migrateGuestWishlist)이 끝날 때 <b>단 한 번</b> 부른다. 옮기기 전에 미리 비우지 않는
 * 이유는, 그 사이에 탭이 닫히면 되돌릴 것 자체가 없어지기 때문이다. 예전 구현이 그랬다.
 *
 * <p><b>지금 저장소를 다시 읽는 것</b>이 이 함수의 핵심이다. 이전은 네트워크를 기다리므로 그
 * 사이에 사용자가 새로 담을 수 있는데, 시작할 때 읽어 둔 배열을 그대로 되쓰면 그 창에서 담은
 * 것이 조용히 지워진다. 그래서 "빼야 할 것" 만 받고 나머지는 지금 저장소를 따른다.
 *
 * <p>상한을 다시 자르지 않는다 — 빼기만 하므로 개수가 늘어날 일이 없다.
 */
export function forgetGuestWishlist(ids: number[]): number {
  if (ids.length === 0) return 0;
  const gone = new Set(ids);
  const current = read();
  const next = current.filter((id) => !gone.has(id));
  if (next.length === current.length) return 0;
  write(next);
  return current.length - next.length;
}

export function clearGuestWishlist(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(GUEST_WISHLIST_KEY);
  } catch {
    /* 못 지워도 다음 로그인에서 다시 시도한다. */
  }
}
