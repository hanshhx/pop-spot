/**
 * 홈 → 상세로 갈 때 스크롤 위치를 저장했다가, 뒤로가기로 돌아왔을 때 복원해도 되는지 판단하는
 * 순수 로직.
 *
 * <p><b>왜 뺐는가.</b> 이 판단은 세 조건(형식이 맞는가·검색조건이 같은가·30분 안인가)의
 * 교집합이라 셋 중 하나만 놓쳐도 조용히 깨진다. 컴포넌트 클로저 안에 있으면 브라우저 없이
 * 테스트할 수 없어서 뺐다.
 *
 * <p><b>왜 처음엔 지도 마커 경로 한 곳뿐이었는가.</b> 저장 로직이 {@code window} 전역만 읽어서
 * 굳이 컴포넌트 클로저 안에 있을 이유가 없었는데도, 지도 마커 클릭 핸들러 안에 인라인으로만
 * 있었다. 그래서 레일·POP-LOOK·벤토·검색 등 나머지 열 곳은 저장 없이 그냥 이동했고, 뒤로가기는
 * 항상 홈의 맨 위로 튀었다. 모듈 스코프 함수로 빼면 어디서든 그냥 부를 수 있다.
 */

/** sessionStorage 키. 예전 이름({@code popspot:map-return-state})은 지도 마커 전용이던 시절 것이다. */
export const HOME_RETURN_STATE_KEY = 'popspot:home-return-state';

/** 30분 — 이보다 오래된 저장은 다른 방문으로 본다. 의도적인 값이라 늘리거나 줄이지 않는다. */
const RETURN_STATE_TTL_MS = 30 * 60_000;

export interface HomeReturnState {
  scrollY: number;
  search: string;
  savedAt: number;
}

/**
 * 지금 스크롤 위치를 저장한다.
 *
 * <p>{@code window} 전역만 읽고 라우터·로케일 등 컴포넌트 상태에 기대지 않는다 — 그래서 홈
 * 화면(HomeClient) 밖의 다른 파일(HomeBento1a, BrowseSection, GlobalSearchModal 등)에서도 그냥
 * import 해서 부를 수 있다.
 *
 * <p><b>반드시 탭을 바꾸기 전에 불러야 한다.</b> {@code handleTabChange} 가 탭 전환 시 화면을
 * 맨 위로 스크롤시키는데(그 나름의 이유가 있는 동작이다), 그 뒤에 저장하면 {@code scrollY: 0} 을
 * 저장하게 되어 이 함수가 있으나 마나 해진다.
 */
export function saveHomeReturnState(): void {
  try {
    const state: HomeReturnState = {
      scrollY: window.scrollY,
      search: window.location.search,
      savedAt: Date.now(),
    };
    window.sessionStorage.setItem(HOME_RETURN_STATE_KEY, JSON.stringify(state));
  } catch {
    // 시크릿 모드 등에서 sessionStorage 가 막힐 수 있다 — 저장이 안 돼도 이동 자체는 막지 않는다.
  }
}

/**
 * 저장된 항목을 복원해도 되는지 판단한다. 되면 되돌릴 scrollY 를, 안 되면 null 을 돌려준다.
 *
 * <p>세 조건을 <b>전부</b> 통과해야 한다 — 하나도 빼면 안 된다:
 * <ul>
 *   <li>형식이 맞는다({@code scrollY} 가 숫자다). sessionStorage 값은 사용자가 손댈 수도, 과거
 *       버전이 다른 모양으로 남길 수도 있어 무엇이든 들어올 수 있다고 본다.
 *   <li>저장 당시 검색조건과 지금이 같다. 다른 필터로 돌아온 화면에 옛 스크롤을 앉히면 화면에
 *       보이는 것과 스크롤 위치가 어긋나 복원 안 하느니만 못하다.
 *   <li>30분 안이다. 탭을 오래 열어 두고 다른 일을 하다 돌아온 경우까지 복원하면 사용자가
 *       놀란다.
 * </ul>
 *
 * @param raw sessionStorage 에서 읽어 {@code JSON.parse} 한 값 — 무엇이든 올 수 있다
 * @param currentSearch 지금 {@code location.search}
 * @param now 지금 시각(ms) — 테스트가 주입할 수 있게 인자로 받는다
 */
export function resolveHomeReturnScroll(
  raw: unknown,
  currentSearch: string,
  now: number,
): number | null {
  if (raw === null || typeof raw !== 'object') return null;
  const { scrollY, search, savedAt } = raw as Record<string, unknown>;
  if (typeof scrollY !== 'number') return null;
  if (search !== currentSearch) return null;
  const savedAtMs = typeof savedAt === 'number' ? savedAt : 0;
  if (now - savedAtMs > RETURN_STATE_TTL_MS) return null;
  return scrollY;
}

/**
 * 이 경로가 팝업 상세({@code /popup/:id})인지 — 로케일 접두사(en/ja) 유무 모두 인정한다.
 *
 * <p>카탈로그 랜딩({@code /popups/[slug]})과 헷갈리면 안 된다 — 복수형 뒤에는 슬래시가 바로
 * 오지 않으므로 이 정규식은 그 경로를 잡지 않는다.
 */
export function isPopupDetailPath(pathname: string): boolean {
  return /^\/(?:(?:en|ja)\/)?popup\/[^/]+\/?$/.test(pathname);
}
