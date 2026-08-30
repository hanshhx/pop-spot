import { classifyCategory, parseDate, type CategoryCode } from './popupSlices';
import type { PopupStore } from '@/types/popup';

/**
 * 홈의 「최근 오픈한 팝업」 레일 — 웹 {@code app/HomeClient.tsx} 의 {@code railPopups} 를 모듈로
 * 승격한 것.
 *
 * <p>웹은 이 계산을 3,300줄짜리 화면 파일 안에 두고 있어 테스트가 없다. 정렬 기준 셋이 전부
 * "눈으로 봐야 아는" 규칙이라({@code endDate} 없는 것을 어디로 보내나, 동점은 무엇으로 가르나)
 * 앱에서는 떼어 내고 테스트를 붙였다.
 *
 * <p><b>받는 목록은 이미 같은 행사끼리 묶인 것이어야 한다</b>({@code usePopups} 의
 * {@code popAll}). 안 묶으면 스크롤을 내려도 새로운 것이 안 나온다 — 웹 실측에서 상위 12칸 중
 * 8칸이 3개 행사였다.
 */

export type RailSort = 'popular' | 'deadline' | 'latest';

/**
 * 레일이 보여줄 최대 개수. 웹 {@code RAIL_POPUP_COUNT} 와 같은 값이다.
 */
export const RAIL_POPUP_COUNT = 30;

/**
 * 정렬 + 카테고리 필터를 걸어 레일에 그릴 목록을 만든다.
 *
 * <ul>
 *   <li><b>latest(기본값)</b> — 시작일 내림차순. <b>이것이 "최근 오픈" 의 정의다</b>: 실제 날짜를
 *       보고 최근에 문을 연 순서다. 시작일이 없으면 맨 뒤로 보내고({@code -Infinity}), 동점은
 *       {@code id} 내림차순으로 가른다 — id 는 auto-increment 라 항상 있고 순서가 흔들리지 않는다.
 *   <li><b>deadline</b> — 종료일 오름차순. 종료일이 없는 것은 맨 뒤({@code Infinity}) — "언제
 *       끝날지 모른다" 를 "가장 급하다" 로 읽으면 안 된다.
 *   <li><b>popular</b> — 조회수 내림차순. 수집 팝업 다수가 0 이라 동점이 흔해서 id 로 안정화한다.
 * </ul>
 *
 * <p>날짜는 {@code parseDate} 로 읽는다. {@code Date.parse} 를 쓰면 "2026-02-31" 같은 값이
 * 3월 2일로 조용히 이월돼 순서가 틀어진다.
 */
export function railPopups(
  popups: PopupStore[],
  sort: RailSort = 'latest',
  category: CategoryCode | 'all' = 'all',
  limit: number = RAIL_POPUP_COUNT,
): PopupStore[] {
  const base =
    category === 'all'
      ? popups
      : popups.filter((p) => classifyCategory(p.category) === category);
  const list = [...base];

  if (sort === 'deadline') {
    const end = (p: PopupStore) => {
      const d = parseDate(p.endDate);
      return d ? d.getTime() : Infinity;
    };
    list.sort((a, b) => end(a) - end(b) || (b.viewCount || 0) - (a.viewCount || 0));
  } else if (sort === 'latest') {
    const start = (p: PopupStore) => {
      const d = parseDate(p.startDate);
      return d ? d.getTime() : -Infinity;
    };
    list.sort((a, b) => start(b) - start(a) || b.id - a.id);
  } else {
    list.sort((a, b) => (b.viewCount || 0) - (a.viewCount || 0) || b.id - a.id);
  }

  return list.slice(0, limit);
}

/**
 * 필터 칩으로 보여줄 카테고리 — <b>목록에 실제로 있는 것만.</b>
 *
 * <p>개수 0 인 칩을 그리면 누를 수 있는데 결과가 비는 자리가 생긴다. 웹도 같은 이유로 존재하는
 * 것만 남긴다.
 */
export function railCategoryCodes(popups: PopupStore[]): Set<CategoryCode> {
  return new Set(popups.map((p) => classifyCategory(p.category)));
}
