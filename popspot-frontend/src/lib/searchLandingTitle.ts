import type { Locale } from './i18n';
import type { SliceKind } from './landingCopy';

type SearchLandingTitleInput = {
  locale: Locale;
  kind: SliceKind;
  slug: string;
  label: string;
  count: number;
};

/**
 * 실제 노출은 많지만 클릭률이 낮은 기존 한국어 랜딩의 제목을 더 구체적으로 만든다.
 *
 * <p>새 URL이나 없는 정보를 만들지 않는다. 지역 페이지는 이미 오늘 진행 중인 팝업과 이번 주 일정을
 * 보여 주고, 브랜드 페이지는 실제 목록에 일정·위치·마감일을 표시한다. 검색 결과의 제목만 그 내용을
 * 더 정확히 말하게 한다.
 *
 * <p>영어·일본어는 검색 자료가 아직 적어 건드리지 않는다. 값이 {@code null}이면 기존 언어별 제목을
 * 그대로 사용한다.
 */
export function searchLandingTitle(input: SearchLandingTitleInput): string | null {
  const { locale, kind, slug, label, count } = input;
  if (locale !== 'ko' || count <= 0) return null;

  if (kind === 'region') {
    return `${label} 팝업스토어 ${count}곳 | 오늘·이번 주 일정·위치`;
  }

  if (kind === 'brand') {
    // 네이버 실측 검색어는 "오프사이드 스토어"였고 기존 제목에는 "스토어"가 빠져 있었다.
    // 화면의 실제 팝업 이름이 오프사이드 팝업스토어이므로 추측이나 키워드 끼워 넣기가 아니다.
    if (slug === 'offside') {
      return `오프사이드 스토어 팝업 ${count}곳 | 일정·위치`;
    }
    return `${label} 팝업스토어 ${count}곳 | 일정·위치·마감일`;
  }

  return null;
}
