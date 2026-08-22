// @vitest-environment jsdom

import { afterEach, describe, expect, it } from 'vitest';

import { buildBaseStyle } from './mapStyle';
import { parseHex } from '@/lib/colorMix';

/**
 * 지도 팔레트가 <b>화면과 같은 편</b>인지 지킨다.
 *
 * <p>실제로 뒤집힌 적이 있다: 라이트 화면에 다크 지도가, 다크 화면에 라이트 지도가 깔렸다.
 * 지도는 브라우저에서 WebGL 로 그려져 눈으로만 확인하던 부분이라 아무도 못 잡았다. 색이
 * 정해지는 곳은 순수 함수이므로 여기서 잠근다.
 *
 * <p>jsdom 에는 CSS 가 없어 계절 토큰(--s-map)이 비어 있고, 그러면 THEMES 의 기본값으로
 * 떨어진다. 계절색까지는 못 보지만 <b>어느 쪽 팔레트를 골랐는가</b>는 그대로 드러난다.
 */

/** 이 레이어의 fill-color. 스타일 스펙에서 직접 꺼낸다. */
function fillOf(style: ReturnType<typeof buildBaseStyle>, id: string): string {
  const layer = style.layers.find((l) => l.id === id);
  if (!layer || !('paint' in layer)) throw new Error(`${id} 레이어가 없다`);
  const paint = layer.paint as Record<string, unknown>;
  const color = paint['fill-color'] ?? paint['background-color'];
  if (typeof color !== 'string') throw new Error(`${id} 의 색이 문자열이 아니다`);
  return color;
}

/** 0(검정) ~ 1(흰색). 어느 쪽 팔레트인지 가르는 데만 쓴다. */
function brightness(hex: string): number {
  const rgb = parseHex(hex);
  if (!rgb) throw new Error(`hex 가 아니다: ${hex}`);
  return (rgb[0] + rgb[1] + rgb[2]) / 3 / 255;
}

const setDark = (on: boolean) => document.documentElement.classList.toggle('dark', on);

afterEach(() => document.documentElement.classList.remove('dark'));

describe('buildBaseStyle', () => {
  it('다크 화면에는 어두운 지도를 준다', () => {
    setDark(true);
    expect(brightness(fillOf(buildBaseStyle('dark', 'x'), 'earth'))).toBeLessThan(0.25);
  });

  it('라이트 화면에는 밝은 지도를 준다', () => {
    setDark(false);
    expect(brightness(fillOf(buildBaseStyle('light', 'x'), 'earth'))).toBeGreaterThan(0.75);
  });

  it('넘겨받은 mode 가 문서와 어긋나면 문서를 따른다', () => {
    /*
     * 색의 출처가 둘이라 생기는 문제다. 바탕은 CSS 변수(=문서의 .dark 클래스)에서 오고 나머지는
     * React 가 넘긴 mode 에서 왔다. 둘이 어긋나면 반쪽은 다크, 반쪽은 라이트인 지도가 나온다.
     * 변수를 읽는 그 문서를 따르는 것이 유일하게 앞뒤가 맞는 선택이다.
     */
    setDark(true);
    expect(brightness(fillOf(buildBaseStyle('light', 'x'), 'earth'))).toBeLessThan(0.25);

    setDark(false);
    expect(brightness(fillOf(buildBaseStyle('dark', 'x'), 'earth'))).toBeGreaterThan(0.75);
  });

  it('도로는 두 모드 모두 바탕보다 밝다', () => {
    // 라이트에서 도로가 검게 나온 적이 있다 — 도로와 글자에 같은 기준점을 줘서, 글자가 가는
    // 어두운 쪽으로 도로까지 따라갔다.
    for (const dark of [true, false]) {
      setDark(dark);
      const style = buildBaseStyle(dark ? 'dark' : 'light', 'x');
      const earth = brightness(fillOf(style, 'earth'));
      const road = brightness(
        (style.layers.find((l) => l.id === 'roads-minor')?.paint as Record<string, string>)?.[
          'line-color'
        ] ?? '#000000',
      );
      expect(road, dark ? 'dark' : 'light').toBeGreaterThan(earth);
    }
  });
});
