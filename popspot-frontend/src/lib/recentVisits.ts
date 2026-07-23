/**
 * v2.18 — 최근 본 팝업 (방문 기록) localStorage 헬퍼.
 *
 * <p>회원/게스트 무관하게 클라이언트에만 저장 — PIPA 부담 0. 한 명당 최대 10개 (FIFO).
 *
 * <p>설계 결정:
 * <ul>
 *   <li>서버 저장 안 함 — 단순한 UI 보조 정보라 백엔드 row 만들 필요 없음
 *   <li>한 사용자가 같은 팝업 두 번 보면 최신으로 갱신 (중복 제거)
 *   <li>탈퇴 / 로그아웃 시 별도 처리 불필요 — 자기 브라우저 localStorage 에만 남음
 * </ul>
 */

const STORAGE_KEY = 'popspot:recent-visits';
const MAX_ITEMS = 10;

export interface RecentVisit {
  popupId: number;
  popupName: string;
  popupImage?: string;
  /** ISO timestamp — 정렬 / 만료 판정용. */
  visitedAt: string;
}

export function recordVisit(visit: Omit<RecentVisit, 'visitedAt'>): void {
  if (typeof window === 'undefined') return;
  const list = readVisits();
  const filtered = list.filter((v) => v.popupId !== visit.popupId);
  const updated: RecentVisit[] = [
    { ...visit, visitedAt: new Date().toISOString() },
    ...filtered,
  ].slice(0, MAX_ITEMS);
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch {
    // localStorage 가득 차거나 사용 불가 시 — 조용히 무시.
  }
}

export function readVisits(): RecentVisit[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as RecentVisit[];
    if (!Array.isArray(parsed)) return [];
    return parsed.slice(0, MAX_ITEMS);
  } catch {
    return [];
  }
}

export function clearVisits(): void {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(STORAGE_KEY);
}
