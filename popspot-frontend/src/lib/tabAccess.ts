/**
 * 탭 접근 정책 — 한 곳에서 관리해 홈(HomeClient)의 게이트 · sessionStorage 복원 · {@code ?tab=}
 * 쿼리와, 상세 페이지(PopupDetailClient)의 "지금 이 탭에 갈 수 있나" 판정이 서로 어긋나지 않게
 * 한다.
 *
 * <p>원래 이 규칙은 {@code HomeClient.tsx} 안에만 있었다. 상세 페이지의 "AI 코스 만들기" 버튼도
 * COURSE 탭으로 이동하는 버튼이라 같은 질문에 같은 답을 해야 하는데, 규칙을 두 곳에 각각 두면
 * 한쪽만 고치고 잊는 사고가 난다 — 예를 들어 게스트 정책이 바뀌었는데 상세 페이지만 옛 규칙(예:
 * 단순 로그인 여부만 보는 규칙)으로 남는 경우다.
 *
 * <ul>
 *   <li>로그인 사용자 : 모든 탭
 *   <li>게스트 활성 : v2.13.1 부터 모든 탭 통과 — "7일 동안 전체 기능 둘러보기"의 약속을 실제로
 *       지키기 위함. 만료 후엔 회원가입 유도
 *   <li>비로그인+비게스트 : MAP / PASSPORT / MY / FEEDBACK 만 통과
 * </ul>
 */

/**
 * 게스트 모드를 시작하지 않았거나 로그인하지 않았으면 잠기는 탭.
 *
 * <p>지도(MAP)만 빠져 있다. 검색·SNS 로 들어온 사람이 <b>메인 화면은 그대로 보게</b> 하되, 그
 * 밖의 기능은 "게스트로 둘러보기" 를 누르거나 로그인해야 열린다.
 *
 * <p>일정(SCHEDULE)은 여기 없다. 전체 팝업 달력이라 이력도 계정도 필요 없고, 처음 온 사람에게
 * 바로 내용이 찬다 — 로그인 벽을 세우면 동행이 비어 있던 자리를 또 빈 화면으로 채우는 셈이다.
 */
export const USER_ONLY_TABS = new Set<string>(['COURSE', 'MUSIC', 'PASSPORT', 'MY']);

/** 현재 세션에서 해당 탭에 진입할 수 있는가. */
export function canAccessTab(tab: string, hasUser: boolean, isGuestActive: boolean): boolean {
  if (hasUser) return true;
  if (isGuestActive) return true; // 게스트는 7일 동안 모든 탭 자유 이용
  return !USER_ONLY_TABS.has(tab);
}
