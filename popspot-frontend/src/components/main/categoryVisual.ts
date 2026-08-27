import { MapPin, Shirt, Coffee, Palette, Star, Sparkles, Cpu, Store } from 'lucide-react';

/**
 * 사진이 없을 때(또는 쓸 수 없을 때)의 대체 그림 — 카테고리별 그라디언트 + 아이콘.
 *
 * <p>잘못된 사진을 붙이는 대신 <b>의도된 디자인</b>으로 보이게 하는 것이 목적이다. 색은 소스에
 * 문자열 리터럴로 박아 두어야 Tailwind JIT 가 클래스를 인식한다 — 문자열을 조립하면 빌드에서
 * 사라진다.
 *
 * <p>{@link PopupCard} 와 {@link PopAllPreview} 가 같은 표를 쓴다. 예전엔 카드 파일 안에만
 * 있었는데, 두 번째 화면이 생기면서 복사하면 반드시 갈라진다 — 한 화면에서만 색이 바뀌는 식으로.
 */
export const CATEGORY_STYLE: Record<string, { grad: string; Icon: typeof MapPin }> = {
  FASHION: { grad: 'from-pink-200 to-rose-300', Icon: Shirt },
  FOOD: { grad: 'from-amber-200 to-orange-300', Icon: Coffee },
  CULTURE: { grad: 'from-violet-200 to-indigo-300', Icon: Palette },
  CHARACTER: { grad: 'from-lime-200 to-emerald-300', Icon: Star },
  BEAUTY: { grad: 'from-fuchsia-200 to-pink-300', Icon: Sparkles },
  TECH: { grad: 'from-sky-200 to-cyan-300', Icon: Cpu },
  ETC: { grad: 'from-gray-200 to-gray-300', Icon: Store },
};

/** 백엔드 카테고리 코드로 대체 그림을 고른다. 모르는 코드는 ETC. */
export function categoryVisual(category: string | null | undefined) {
  return CATEGORY_STYLE[(category ?? 'ETC').toUpperCase()] ?? CATEGORY_STYLE.ETC;
}

/**
 * 분야 이름에 쓰는 색 — <b>새로 만든 값이 아니다.</b>
 *
 * <p>{@code color} 는 위 {@link CATEGORY_STYLE} 의 대체 이미지 그라디언트가 쓰는 색 계열을
 * 글자로 읽을 수 있는 명도까지 내린 것이다(패션 rose · 뷰티 fuchsia · 푸드 orange · 테크 cyan).
 * 문화·라이프·캐릭터는 {@code globals.css} 의 토큰 값을 그대로 쓴다(violet-600 · success ·
 * lime-700). 그래서 사진이 없는 카드의 그라디언트와 이름 색이 저절로 맞는다.
 *
 * <p>{@code tint} 는 같은 색의 10~12% — 곳수 칩의 배경이다. 만채도를 넓은 면에 칠하지 않기 위한
 * 값이고, 팔레트 규칙(만채도는 화면의 10% 이내)을 지키려면 <b>이름과 칩, 접기 버튼에만</b> 쓴다.
 * 카드 면이나 배경에 칠하면 사진 벽과 싸운다.
 *
 * <p>키는 {@code CategoryCode}(classifyCategory 의 결과)다 — 위 표의 키는 백엔드 원본 코드라
 * 서로 다르다.
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

/** 분야 코드로 이름 색을 고른다. 모르는 코드는 본문색으로 — 지어낸 색을 쓰지 않는다. */
export function categoryLabelColor(code: string) {
  return (
    CATEGORY_LABEL_COLOR[code] ?? { color: 'var(--color-foreground)', tint: 'rgba(13,21,23,.07)' }
  );
}
