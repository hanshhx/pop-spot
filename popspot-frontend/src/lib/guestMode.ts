/**
 * 일주일 게스트 모드 — 회원가입 강제 전에 7일간 둘러보기 / 검색 / 지도 / 캘린더 자유 이용.
 *
 * <p>운영 정책 (v2.7 재설계):
 * <ul>
 *   <li>게스트 모드는 사용자가 <b>로그인 페이지에서 "게스트로 로그인하기"</b> 를 명시적으로 눌러야만 시작된다.
 *       이전 구현은 인트로/메인 진입만으로 자동 시작돼 사용자가 인지하지 못한 채 7일 카운터가 돌고 있었다.</li>
 *   <li>시작 시점을 localStorage 에 기록 (key: {@link GUEST_FIRST_VISIT_KEY}).</li>
 *   <li>7일이 지나면 메인 진입 시 회원가입 페이지로 강제 리다이렉트.</li>
 *   <li>액션 게이트 — 메이트/찜/투표/스탬프 같은 "참여형" 기능은 게스트도 회원가입 유도.</li>
 *   <li>서버 저장 없음 — 클라이언트 localStorage 만 사용. PIPA 부담 최소.</li>
 * </ul>
 *
 * <p>편법으로 localStorage 를 지우면 다시 7일이 갱신되지만, 의도적인 우회는 비즈니스 임팩트가 작아 무시.
 */

export const GUEST_FIRST_VISIT_KEY = 'popspot:guest:firstVisit';
export const GUEST_GRACE_PERIOD_DAYS = 7;

const DAY_IN_MS = 24 * 60 * 60 * 1000;

/**
 * 게스트 모드를 명시적으로 시작 — 로그인 페이지의 "게스트로 로그인하기" 버튼 핸들러에서 호출.
 *
 * <p>이미 시작돼 있으면 기존 timestamp 를 그대로 둔다 (게스트 모드는 명시 폐기 전까지 유지). 새로 시작하면
 * 현재 시각을 기록하고 그 값을 반환한다. 호출자는 반환값으로 D-N 표시 등에 활용할 수 있다.
 */
export function startGuestMode(): number {
  if (typeof window === 'undefined') return Date.now();
  const existing = getGuestFirstVisit();
  if (existing != null) return existing;
  const now = Date.now();
  window.localStorage.setItem(GUEST_FIRST_VISIT_KEY, String(now));
  return now;
}

/** 첫 방문 timestamp 를 반환. 미설정 (= 게스트 모드 미시작) 시 null. 부작용 없음. */
export function getGuestFirstVisit(): number | null {
  if (typeof window === 'undefined') return null;
  const stored = window.localStorage.getItem(GUEST_FIRST_VISIT_KEY);
  if (!stored) return null;
  const parsed = Number(stored);
  return Number.isNaN(parsed) ? null : parsed;
}

/** 게스트 모드가 활성화된 상태인가 (= 시작했고 아직 만료 전). */
export function isGuestActive(): boolean {
  const firstVisit = getGuestFirstVisit();
  return firstVisit != null && !isGuestExpired(firstVisit);
}

/**
 * 게스트 grace 만료 여부. true 면 회원가입 강제.
 *
 * <p>인자 미지정 시 localStorage 에서 읽어 판정. 인자가 null 이면 (= 미시작) false — 만료가 아니라 "아직
 * 시작도 안 한 상태" 다.
 */
export function isGuestExpired(firstVisit: number | null = getGuestFirstVisit()): boolean {
  if (firstVisit == null) return false;
  return Date.now() - firstVisit >= GUEST_GRACE_PERIOD_DAYS * DAY_IN_MS;
}

/**
 * 남은 일수 (0~7).
 *
 * <p>게스트 모드 미시작 시 — 의도적으로 {@link GUEST_GRACE_PERIOD_DAYS} (= 7) 를 반환해 UI 에서
 * "7일 무료 체험" 안내 카피에 그대로 쓸 수 있게 했다. 만료 시 0.
 */
export function getRemainingGuestDays(firstVisit: number | null = getGuestFirstVisit()): number {
  if (firstVisit == null) return GUEST_GRACE_PERIOD_DAYS;
  const elapsedMs = Date.now() - firstVisit;
  const remainingMs = GUEST_GRACE_PERIOD_DAYS * DAY_IN_MS - elapsedMs;
  if (remainingMs <= 0) return 0;
  return Math.ceil(remainingMs / DAY_IN_MS);
}

/** 게스트 모드 리셋 — 가입 완료 / 로그아웃 시 호출해 localStorage 정리. */
export function clearGuestMode(): void {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(GUEST_FIRST_VISIT_KEY);
}
