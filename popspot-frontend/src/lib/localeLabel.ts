import type { Locale } from './i18n';

/**
 * 지역·카테고리·기간·브랜드의 표시명을 화면 언어로 고른다.
 *
 * <p>사전(i18n.tsx)이 아니라 <b>별도 파일</b>에 두는 이유: i18n.tsx 는 {@code 'use client'} 라
 * 서버가 그 안의 함수를 부를 수 없다. 이 함수는 빌드 때 검색 랜딩 261×3 페이지를 만들면서
 * 서버에서 쓰이므로 클라이언트 경계 밖에 있어야 한다. 순수 함수라 옮겨도 잃는 게 없다.
 *
 * <p>표시명 자체가 사전이 아니라 정의(regions.ts · popupSlices.ts)에 붙어 있는 것도 같은 이유다.
 */
export function localizedLabel(
  def: { label: string; labelEn: string; labelJa: string },
  locale: Locale,
): string {
  if (locale === 'en') return def.labelEn;
  if (locale === 'ja') return def.labelJa;
  return def.label;
}
