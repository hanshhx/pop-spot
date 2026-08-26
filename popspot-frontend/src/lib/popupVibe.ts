/**
 * 팝업 상세 페이지의 "AI 코스 만들기" 버튼이 {@code GET /api/courses/recommend?vibe=} 에 보낼
 * 분위기 키워드를 고른다.
 *
 * <p><b>왜 이름을 그대로 안 쓰나.</b> 백엔드 {@code AiCourseService.PROMPT_TEMPLATE} 은
 * {@code "서울 성수동에서 '%s' 분위기에 딱 맞는 팝업스토어..."} 문장에 vibe 를 그대로 꽂는다 —
 * 그래서 vibe 는 장소명이 아니라 <b>분위기를 나타내는 형용어</b>여야 문장이 자연스럽다.
 * {@code HomeClient} 의 네 프리셋(핫플·데이트·사진·힐링)도 전부 그런 무드 단어다. 팝업 이름을
 * 그대로 꽂으면("성수동에서 'TOY STORY x PEACEMINUSONE' 분위기에 딱 맞는...") 문장이 깨진다.
 *
 * <p>그래서 카테고리를 우선 쓴다. {@link PopupDetailClient}의 {@code CATEGORY_KEY}처럼 정해진
 * 값 중 하나라 항상 짧고 자연스러운 한국어 무드 단어로 바꿀 수 있다. 화면 언어(locale)와
 * 무관하게 한국어로 고정한다 — {@code HomeClient}의 프리셋 {@code val}과 같은 이유로, AI 에
 * 보내는 검색어는 한국어 백엔드 프롬프트에 꽂히는 값이라 화면 언어를 따라가면 안 된다.
 *
 * <p>카테고리가 없거나(크롤러가 못 채운 경우) 매핑에 없는 값(ETC 포함)이면 팝업 이름으로
 * 대신한다 — 그래도 뭔가는 보내야 "이 팝업에서 출발한" 코스라는 말이 성립한다. 다만 이름은
 * 브랜드 콜라보명이 길 수 있어(실측 최장 47자) 쿼리스트링에 실을 만큼 자른다.
 */

const CATEGORY_VIBE_WORDS: Record<string, string> = {
  FASHION: '패션',
  FOOD: '맛집',
  CULTURE: '전시',
  CHARACTER: '캐릭터',
  BEAUTY: '뷰티',
  TECH: '테크',
  // ETC 는 의도적으로 비운다 — "기타"는 그 자체로 무드가 아니라서 이름 폴백으로 넘긴다.
};

/** vibe 로 쓸 문자열의 최대 길이. 쿼리스트링에 싣는 값이라 짧게 유지한다. */
const MAX_VIBE_LENGTH = 20;

export function popupVibe(popup: { category?: string | null; name: string }): string {
  const catWord = CATEGORY_VIBE_WORDS[popup.category?.toUpperCase() ?? ''];
  const base = catWord ?? popup.name;
  return base.trim().slice(0, MAX_VIBE_LENGTH).trim();
}
