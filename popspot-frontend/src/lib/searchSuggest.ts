/**
 * 검색창 이름 추천의 <b>순서</b>.
 *
 * <p><b>왜 따로 떼어 놨나.</b> 2026-09-02 에 "제주" 를 치면 「2026 제주 로컬브랜드 팝업스토어」가
 * 추천에 안 떴다. 걸러내기는 멀쩡했다 — 걸린 것 중 <b>앞에서 6개를 그냥 자르고</b> 있었고, 그
 * 여섯 자리를 주소에 「제주공항」이 들어간 지브리 팝업들이 차지했다. 이름으로 걸린 것이 주소로만
 * 걸린 것에게 배열 순서로 진 것이다.
 *
 * <p>검색이 못 찾은 게 아니라 <b>찾아 놓고 안 보여 준</b> 고장이라, 밖에서는 "없는 팝업" 과
 * 구별되지 않는다. 순서 규칙을 컴포넌트 밖으로 꺼내 검사 대상으로 삼는 이유다.
 *
 * <p>서버의 {@code AiSearchService.scoreOf} 와 같은 기준을 쓴다 — 즉시 추천과 AI 검색 결과가
 * 서로 다른 순서로 나오면 사용자가 둘을 같은 검색으로 못 읽는다.
 */

import { isExpired } from './popupSlices';

/** 추천 드롭다운에 몇 개까지 보일지. */
export const SUGGEST_LIMIT = 6;

/* 이름 앞부분 > 이름 어딘가 > 주소에만. 값 자체는 크기 관계만 의미가 있다. */
const NAME_PREFIX_SCORE = 4;
const NAME_SCORE = 3;
const LOCATION_SCORE = 1;

/** 순서를 매기는 데 필요한 것만. {@code PopupStore} 전체를 요구하면 검사에서 가짜를 만들기 어렵다. */
export type SuggestFields = {
  name?: string | null;
  location?: string | null;
  nameEn?: string | null;
  nameJa?: string | null;
  locationEn?: string | null;
  locationJa?: string | null;
};

/**
 * 관련도 점수. 0 이면 안 걸린 것이다.
 *
 * <p>{@code query} 는 <b>이미 소문자로 다듬어진</b> 검색어여야 한다 — 후보마다 다시 다듬으면
 * 목록이 길 때 그만큼 헛일을 한다.
 */
export function suggestScore(popup: SuggestFields, lowered: string): number {
  if (!lowered) return 0;

  const names = [popup.name, popup.nameEn, popup.nameJa];
  const places = [popup.location, popup.locationEn, popup.locationJa];

  if (names.some((v) => v?.toLowerCase().startsWith(lowered))) return NAME_PREFIX_SCORE;
  if (names.some((v) => v?.toLowerCase().includes(lowered))) return NAME_SCORE;
  if (places.some((v) => v?.toLowerCase().includes(lowered))) return LOCATION_SCORE;
  return 0;
}

/**
 * 걸린 것을 <b>관련도 순으로</b> 추려 준다.
 *
 * <p>동점이면 원래 차례를 지킨다. 목록은 대개 시작일 순이라, 같은 점수 안에서는 그 순서가
 * 사용자에게 가장 덜 놀랍다.
 */
export function rankSuggestions<T extends SuggestFields>(
  popups: T[] | undefined | null,
  query: string,
  limit: number = SUGGEST_LIMIT,
): T[] {
  const lowered = query.trim().toLowerCase();
  if (!lowered || !popups?.length) return [];

  return popups
    .map((popup, order) => ({ popup, order, score: suggestScore(popup, lowered) }))
    .filter((scored) => scored.score > 0)
    .sort((a, b) => b.score - a.score || a.order - b.order)
    .slice(0, limit)
    .map((scored) => scored.popup);
}

/**
 * 검색창이 볼 팝업 — <b>아직 안 끝난 것 전부</b>. 오늘 열린 것에 <b>앞으로 열 것</b>을 더한다.
 *
 * <p><b>왜 "오늘 열린 것" 이면 안 되나.</b> 2026-09-02 에 "제주" 를 쳐도 9/5 에 여는
 * 「2026 제주 로컬브랜드 팝업스토어」가 추천에 안 떴다. 홈 목록·랭킹은 오늘 문이 열린 것만
 * 남기는 것이 맞지만, <b>검색은 다르다</b> — 사람들은 주말에 갈 곳을 미리 찾는다.
 *
 * <p>같은 검색창의 두 경로가 서로 다른 세계를 보고 있던 것이 진짜 문제였다. 즉시 추천은 "오늘
 * 열린 것" 만, 서버의 AI 검색은 지도 마커 전체(예정 포함)를 봤다. 그래서 AI 검색은 찾아내는데
 * 추천에는 없는 팝업이 생겼고, 밖에서는 그냥 "없는 팝업" 으로 보였다. 지도 마커와 같은
 * 기준으로 맞춘다.
 *
 * <p>끝난 것은 뺀다 — 지난달에 닫은 팝업이 검색에 뜨면 헛걸음을 만든다.
 */
export function keepSearchable<T extends { endDate?: string | null }>(
  popups: T[] | undefined | null,
  today: Date,
): T[] {
  if (!popups?.length) return [];
  return popups.filter((popup) => popup && !isExpired(popup.endDate, today));
}
