/**
 * v2.18 — 최근 본 팝업 (방문 기록) localStorage 헬퍼.
 *
 * <p>회원/게스트 무관하게 클라이언트에만 저장 — PIPA 부담 0. 기록은 <b>사람이 지우기 전까지</b>
 * 남는다.
 *
 * <p>설계 결정:
 * <ul>
 *   <li>서버 저장 안 함 — 단순한 UI 보조 정보라 백엔드 row 만들 필요 없음
 *   <li>한 사용자가 같은 팝업 두 번 보면 최신으로 갱신 (중복 제거)
 *   <li>오래됐다는 이유로 흘려보내지 않는다 — 지우는 쪽은 사람이 정한다
 *       ({@code removeVisit} / {@code clearVisits})
 *   <li>탈퇴 / 로그아웃 시 별도 처리 불필요 — 자기 브라우저 localStorage 에만 남음
 * </ul>
 */

const STORAGE_KEY = 'popspot:recent-visits';

/**
 * 여기서 멈춘다 — 보관 개수가 아니라 <b>안전장치</b>다.
 *
 * <p>서른이었다. 서른은 제품이 정한 개수였고, 그래서 서른한 번째를 본 순간 첫 번째가 조용히
 * 사라졌다. 지우는 판단을 사람에게 넘긴 지금은 쌓이는 쪽이 정상이고, 이 숫자는 "여기까지가
 * 적당하다" 가 아니라 "여기까지 오면 무언가 잘못된 것이다" 를 뜻한다.
 *
 * <p>그래도 숫자를 남겨 두는 이유는 localStorage 에 5~10MB 라는 벽이 실제로 있기 때문이다.
 * 오백 개면 120KB 남짓 — 하루에 열 개씩 봐도 일곱 주가 걸린다. 사람이 쓰다가 닿을 자리가
 * 아니라, 저장이 폭주했을 때 브레이크가 걸리는 자리다.
 */
const SAFETY_LIMIT = 500;

export interface RecentVisit {
  popupId: number;
  popupName: string;
  popupImage?: string;
  /** ISO timestamp — 정렬 / 만료 판정용. */
  visitedAt: string;
}

/**
 * 목록을 저장한다 — 한 번 튕기면 <b>오래된 절반을 버리고 한 번 더</b>.
 *
 * <p>예전에는 {@code setItem} 이 던지면 그것으로 끝이었다. 상한이 서른일 때는 그 조용한 포기가
 * 사실상 일어나지 않았지만, 기록을 계속 쌓기로 한 지금은 값이 달라진다. 할당량이 찬 순간부터
 * <b>앞으로의 기록이 영원히</b> 저장되지 않고, 사용자에게는 아무 신호도 가지 않는다. 가득 찬
 * 저장소가 가져가야 할 것은 지난 기록이지 앞으로의 기록이 아니다.
 *
 * <p>그래서 오래된 절반(목록은 최신순이므로 뒤쪽)을 버리고 한 번만 더 시도한다. 홀수면 새로
 * 넣은 것이 살아남는 쪽으로 올림한다 — 방금 본 팝업을 버리려고 재시도하는 것은 앞뒤가 맞지
 * 않는다. 두 번째도 실패하면(사파리 시크릿 창처럼 저장소 자체가 막힌 경우) 예전처럼 조용히
 * 넘어간다. 방문 기록 때문에 화면이 죽을 이유는 없다.
 *
 * <p>SSR 가드는 부르는 쪽에 있다 — 이 함수는 {@code window} 가 있는 것을 전제한다.
 */
function writeVisits(list: RecentVisit[]): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch {
    try {
      const half = list.slice(0, Math.ceil(list.length / 2));
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(half));
    } catch {
      // 저장소를 쓸 수 없는 환경 — 조용히 무시.
    }
  }
}

/**
 * 이 팝업을 본 것으로 남긴다.
 *
 * <p>이미 있던 팝업이면 개수를 늘리지 않고 맨 앞으로만 올린다 — 같은 곳을 두 번 봤다는 사실보다
 * 마지막으로 언제 봤는지가 화면에 필요한 정보다.
 */
export function recordVisit(visit: Omit<RecentVisit, 'visitedAt'>): void {
  if (typeof window === 'undefined') return;
  const list = readVisits();
  const filtered = list.filter((v) => v.popupId !== visit.popupId);
  const updated: RecentVisit[] = [
    { ...visit, visitedAt: new Date().toISOString() },
    ...filtered,
  ].slice(0, SAFETY_LIMIT);
  writeVisits(updated);
}

/**
 * 저장된 방문 기록을 최신순으로.
 *
 * <p>돌려주기 전에 한 번 더 자르는 것은 중복이 아니다. 저장한 쪽과 읽는 쪽이 같은 상한을 알고
 * 있어야, 예전 판본이 남긴 목록이든 손으로 건드린 목록이든 화면이 감당할 길이로 들어온다.
 */
export function readVisits(): RecentVisit[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as RecentVisit[];
    if (!Array.isArray(parsed)) return [];
    return parsed.slice(0, SAFETY_LIMIT);
  } catch {
    return [];
  }
}

/**
 * 이 팝업 하나만 기록에서 뺀다. 나머지 순서는 건드리지 않는다.
 *
 * <p>기록이 계속 쌓이게 된 이상 지우는 손잡이가 함께 있어야 한다. 목록 전체를 비우는 것
 * ({@code clearVisits})밖에 없으면, 하나가 거슬리는 사람은 전부를 버리게 된다.
 *
 * <p>없는 id 면 <b>저장 자체를 하지 않는다</b>. 단순히 결과가 같아서가 아니라, 아무것도 바뀌지
 * 않은 호출이 쓰기를 시도했다가 할당량에 걸리면 위의 재시도가 멀쩡한 목록을 절반으로 줄여
 * 버리기 때문이다 — 지우라고 한 적 없는 기록이 사라지는 길은 막아 둔다.
 */
export function removeVisit(popupId: number): void {
  if (typeof window === 'undefined') return;
  const list = readVisits();
  const updated = list.filter((v) => v.popupId !== popupId);
  if (updated.length === list.length) return;
  writeVisits(updated);
}

/**
 * 방문 기록을 통째로 비운다.
 *
 * <p>{@code try} 로 감싼 것은 형식이 아니다. 이 함수는 그동안 부르는 곳이 하나도 없었고, 삭제
 * 버튼이 붙는 지금이 처음으로 실행되는 순간이다. 사파리 시크릿 창이나 저장소가 꺼진 환경에서
 * {@code removeItem} 은 호출한 쪽으로 예외를 던지므로, 감싸지 않으면 '기록 지우기' 를 누른
 * 사람에게 돌아가는 것은 빈 목록이 아니라 멈춘 화면이다.
 */
export function clearVisits(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // 저장소를 쓸 수 없는 환경 — 조용히 무시.
  }
}
