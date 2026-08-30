import type { IconName } from '@/components/ui/Icon';

/**
 * 분야가 화면에서 갖는 색과 그림 — 웹 {@code components/main/categoryVisual.ts} 의 앱 판.
 *
 * <p>값은 <b>웹에서 그대로 가져왔다.</b> 이 표가 갈리면 같은 팝업이 웹에서는 자주색, 앱에서는
 * 남색이 된다 — 지도 핀과 목록 이름이 같은 표를 쓰는 구조라, 한쪽만 고치면 그 화면 안에서도 색이
 * 어긋난다.
 *
 * <p>웹과 다른 것은 두 가지다. 첫째, 대체 이미지의 <b>그라디언트 클래스</b>를 옮기지 않았다 —
 * Tailwind 클래스 문자열이라 RN 에서 뜻이 없고, 앱은 사진이 없을 때 아이콘 하나로 대신한다.
 * 둘째, 모르는 코드의 폴백이 {@code var(--color-foreground)} 가 아니라 {@code null} 이다. RN 에는
 * CSS 변수가 없어서, 색을 고르는 쪽이 지금 테마의 본문색을 넣도록 넘긴다.
 */

/**
 * 분야 이름에 쓰는 색 — <b>새로 만든 값이 아니다.</b>
 *
 * <p>{@code color} 는 대체 이미지 그라디언트가 쓰는 색 계열을 글자로 읽을 수 있는 명도까지 내린
 * 것이고(패션 rose · 뷰티 fuchsia · 푸드 orange · 테크 cyan), 문화·라이프·캐릭터는 브랜드 토큰
 * 값이다(violet-600 · success · lime-700).
 *
 * <p>{@code tint} 는 같은 색의 10~12% — 칩 배경이다. 만채도를 넓은 면에 칠하지 않기 위한 값이라
 * <b>이름과 칩에만</b> 쓴다. 카드 면이나 배경에 칠하면 사진 벽과 싸운다.
 *
 * <p>키는 {@code CategoryCode}({@code classifyCategory} 의 결과)다 — 백엔드 원본 코드와 다르다.
 */
export const CATEGORY_LABEL_COLOR: Record<string, { color: string; tint: string }> = {
  fashion: { color: '#be123c', tint: 'rgba(190,18,60,.10)' },
  beauty: { color: '#a21caf', tint: 'rgba(162,28,175,.10)' },
  dessert: { color: '#c2410c', tint: 'rgba(194,65,12,.10)' },
  art: { color: '#4626c8', tint: 'rgba(70,38,200,.10)' },
  lifestyle: { color: '#1c7f56', tint: 'rgba(34,160,107,.12)' },
  tech: { color: '#0e7490', tint: 'rgba(14,116,144,.10)' },
  character: { color: '#4f7a10', tint: 'rgba(79,122,16,.12)' },
};

/**
 * 분야 코드로 이름 색을 고른다.
 *
 * <p>모르는 코드는 색을 <b>지어내지 않는다.</b> {@code color} 를 null 로 돌려주므로 부르는 쪽이
 * 본문색을 넣는다 — 새 분야가 생겼을 때 엉뚱한 색이 붙는 것보다, 색이 없는 편이 낫다.
 */
export function categoryLabelColor(code: string): { color: string | null; tint: string } {
  return CATEGORY_LABEL_COLOR[code] ?? { color: null, tint: 'rgba(10,10,10,.07)' };
}

/**
 * 사진이 없을 때 자리를 채우는 아이콘.
 *
 * <p>웹은 카테고리별 그라디언트 + lucide 아이콘을 쓴다. 앱에는 그라디언트 클래스를 옮길 수 없어
 * 아이콘만 남기고, 바탕은 {@code mp}(눌린 면)로 통일한다 — 잘못된 사진을 붙이는 대신
 * <b>의도된 빈자리</b>로 보이게 하는 것이 목적이라, 그 목적은 아이콘 하나로도 달성된다.
 */
export const CATEGORY_ICON: Record<string, IconName> = {
  fashion: 'bookmark',
  beauty: 'heart',
  dessert: 'ticket',
  art: 'grid',
  lifestyle: 'map',
  tech: 'dice',
  character: 'course',
};

export function categoryIcon(code: string): IconName {
  return CATEGORY_ICON[code] ?? 'pin';
}
