/**
 * 홈 화면의 상태를 주소창에 실어 둔다.
 *
 * <p>지금까지 탭 전환은 {@code setCurrentTab} 만 했고 주소는 늘 <code>/</code> 였다. 그래서
 * <b>새로고침·북마크·링크 공유·새 탭으로 열기</b>가 전부 지도 탭 초기 상태로 돌아갔다.
 *
 * <p>덤이 아니라 오히려 이쪽이 더 큰 이유가 하나 있다 — 무엇을 보다 나갔는지 기록이 남지 않는다.
 * 어떤 지역·카테고리가 실제로 먹히는지 모르면 다음에 무엇을 늘릴지 정할 근거가 없다.
 *
 * <p><b>{@code history.replaceState} 를 쓰고 Next 라우터는 건드리지 않는다.</b>
 * {@code router.replace} 는 리렌더를 유발하는데, HomeClient 의 진입 게이트가 예전에 그 때문에
 * 게스트 잔여일을 매번 다시 계산해 깜빡인 적이 있다(v2.13.1 주석). 주소만 바꾸는 것이 목적이므로
 * 브라우저 API 로 충분하고, 그 사고를 되풀이하지 않는다.
 *
 * <p>이력을 쌓지 않으므로(replace) 뒤로가기 동작은 지금과 같다. 탭을 누를 때마다 이력이 쌓이면
 * 뒤로가기를 여러 번 눌러야 사이트를 벗어나게 되는데, 그건 더 나쁜 쪽이다.
 */

/** 주소에 실을 홈 탭. 그 외 값은 무시한다. */
const KNOWN_TABS = ['MAP', 'COURSE', 'MUSIC', 'PASSPORT', 'MATE', 'MY', 'FEEDBACK'] as const;
export type HomeTab = (typeof KNOWN_TABS)[number];

/** 기본 화면이라 주소에 굳이 적지 않는다. */
const DEFAULT_TAB: HomeTab = 'MAP';

/** 푸터에서 바로 열 수 있는 모달. */
const KNOWN_PANELS = ['calendar', 'congestion'] as const;
export type HomePanel = (typeof KNOWN_PANELS)[number];

export function parseTab(value: string | null | undefined): HomeTab | null {
  if (!value) return null;
  const upper = value.toUpperCase();
  return (KNOWN_TABS as readonly string[]).includes(upper) ? (upper as HomeTab) : null;
}

export function parsePanel(value: string | null | undefined): HomePanel | null {
  if (!value) return null;
  const lower = value.toLowerCase();
  return (KNOWN_PANELS as readonly string[]).includes(lower) ? (lower as HomePanel) : null;
}

/**
 * 주어진 주소에 탭을 반영한 다음 주소를 만든다.
 *
 * <p>기본 탭이면 매개변수를 <b>지운다</b> — <code>/?tab=MAP</code> 과 <code>/</code> 가 같은
 * 화면인데 주소가 둘로 갈리면 공유 링크도 애널리틱스 집계도 쪼개진다.
 *
 * <p>{@code open} 은 한 번 쓰고 지운다. 캘린더를 닫았는데 주소에 남아 있으면 새로고침할 때마다
 * 다시 열린다.
 */
export function nextHomeUrl(currentUrl: string, tab: string): string {
  const url = new URL(currentUrl);
  const known = parseTab(tab);

  if (!known || known === DEFAULT_TAB) url.searchParams.delete('tab');
  else url.searchParams.set('tab', known);

  url.searchParams.delete('open');

  const query = url.searchParams.toString();
  return `${url.pathname}${query ? `?${query}` : ''}${url.hash}`;
}
