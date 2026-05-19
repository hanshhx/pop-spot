/**
 * 일주일 게스트 모드 — 회원가입 강제 전에 7일간 둘러보기 / 검색 / 지도 / 캘린더 자유 이용.
 *
 * <p>운영 정책:
 * <ul>
 *   <li>첫 방문 시점을 localStorage 에 기록 (key: {@link GUEST_FIRST_VISIT_KEY}).</li>
 *   <li>7일이 지나면 진입 시 회원가입 페이지로 강제 리다이렉트.</li>
 *   <li>액션 게이트 — 메이트/찜/투표/스탬프 같은 "참여형" 기능은 게스트도 회원가입 유도.</li>
 *   <li>서버 저장 없음 — 클라이언트 localStorage 만 사용. PIPA 부담 최소.</li>
 * </ul>
 *
 * <p>편법으로 localStorage 를 지우면 다시 7일이 갱신되지만, 의도적인 우회는 비즈니스 임팩트가 작아 무시.
 */

export const GUEST_FIRST_VISIT_KEY = "popspot:guest:firstVisit";
export const GUEST_GRACE_PERIOD_DAYS = 7;

const DAY_IN_MS = 24 * 60 * 60 * 1000;

/** 첫 방문이라면 timestamp 를 기록하고 그 값을 반환. 이미 기록돼 있으면 기존 값을 그대로 반환. */
export function ensureGuestFirstVisit(): number {
  if (typeof window === "undefined") return Date.now();
  const stored = window.localStorage.getItem(GUEST_FIRST_VISIT_KEY);
  if (stored) {
    const parsed = Number(stored);
    if (!Number.isNaN(parsed)) return parsed;
  }
  const now = Date.now();
  window.localStorage.setItem(GUEST_FIRST_VISIT_KEY, String(now));
  return now;
}

/** 첫 방문 timestamp 를 반환. 미설정 시 null. */
export function getGuestFirstVisit(): number | null {
  if (typeof window === "undefined") return null;
  const stored = window.localStorage.getItem(GUEST_FIRST_VISIT_KEY);
  if (!stored) return null;
  const parsed = Number(stored);
  return Number.isNaN(parsed) ? null : parsed;
}

/** 게스트 grace 만료 여부. true 면 회원가입 강제. */
export function isGuestExpired(firstVisit: number | null = getGuestFirstVisit()): boolean {
  if (firstVisit == null) return false;
  return Date.now() - firstVisit >= GUEST_GRACE_PERIOD_DAYS * DAY_IN_MS;
}

/** 남은 일수 (0~7). 만료되었으면 0. */
export function getRemainingGuestDays(firstVisit: number | null = getGuestFirstVisit()): number {
  if (firstVisit == null) return GUEST_GRACE_PERIOD_DAYS;
  const elapsedMs = Date.now() - firstVisit;
  const remainingMs = GUEST_GRACE_PERIOD_DAYS * DAY_IN_MS - elapsedMs;
  if (remainingMs <= 0) return 0;
  return Math.ceil(remainingMs / DAY_IN_MS);
}

/** 게스트 모드 리셋 — 가입 완료 시 호출해 localStorage 정리. */
export function clearGuestMode(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(GUEST_FIRST_VISIT_KEY);
}
