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
