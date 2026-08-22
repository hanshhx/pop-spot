import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { BRAND_LIME, SCALE_STEPS, SEASON_SCALES } from './seasonPalette';
import { SEASONS } from './season';

/**
 * globals.css 와 seasonPalette.ts 가 어긋나지 않게 붙잡는다.
 *
 * <p>값이 두 곳에 있는 건 CSS 가 TS 를 못 읽기 때문인데, 그러면 반드시 한쪽만 고치는 날이 온다.
 * 색은 틀려도 빌드가 통과하고 테스트도 안 깨지니, 배포하고 나서야 눈으로 발견하게 된다.
 */

const CSS = readFileSync(join(__dirname, '../../app/globals.css'), 'utf8');

/** 셀렉터 한 블록을 통째로 떼어 온다. */
function block(selector: string): string {
  const at = CSS.indexOf(`${selector} {`);
  if (at < 0) return '';
  return CSS.slice(at, CSS.indexOf('}', at));
}

/** 상대 휘도 — 대비 계산용. */
function luminance(hex: string): number {
  const channel = (v: number) => {
    const c = v / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  const n = parseInt(hex.slice(1), 16);
  return (
    0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255)
  );
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

const INK = '#0a0a0a';
const WHITE = '#ffffff';

describe('계절 라임 스케일', () => {
  it('네 계절 블록이 globals.css 의 값과 정확히 일치한다', () => {
    for (const season of SEASONS) {
      const css = block(`:root[data-season='${season}']`);
      // --s-* 블록과 --color-lime-* 블록이 같은 셀렉터를 쓰므로, 뒤에 오는 쪽을 찾는다.
      const limeBlock = CSS.slice(CSS.indexOf('계절 주 색상'));
      const at = limeBlock.indexOf(`:root[data-season='${season}']`);
      const scope = at >= 0 ? limeBlock.slice(at, limeBlock.indexOf('}', at)) : css;

      for (const step of SCALE_STEPS) {
        expect(scope, `${season} 블록에 --color-lime-${step} 이 없거나 값이 다르다`).toContain(
          `--color-lime-${step}: ${SEASON_SCALES[season][step]};`,
        );
      }
    }
  });

  it('@theme 의 원본 라임은 그대로다 — 계절 블록을 지우면 여기로 돌아간다', () => {
    const theme = CSS.slice(CSS.indexOf('@theme {'), CSS.indexOf('}', CSS.indexOf('@theme {')));
    for (const step of SCALE_STEPS) {
      expect(theme).toContain(`--color-lime-${step}: ${BRAND_LIME[step]};`);
    }
  });

  it('50→900 휘도가 단조 감소한다 — 역전되면 hover 가 원래 색보다 밝아진다', () => {
    for (const season of SEASONS) {
      const ls = SCALE_STEPS.map((s) => luminance(SEASON_SCALES[season][s]));
      for (let i = 0; i < ls.length - 1; i++) {
        expect(
          ls[i],
          `${season} ${SCALE_STEPS[i]} → ${SCALE_STEPS[i + 1]} 휘도 역전`,
        ).toBeGreaterThan(ls[i + 1]);
      }
    }
  });

  it('채움(50~400) 위 잉크 글자가 AA 를 넘는다 — bg-lime-300 text-ink-900 이 324곳이다', () => {
    for (const season of SEASONS) {
      for (const step of [50, 100, 200, 300, 400] as const) {
        const ratio = contrast(SEASON_SCALES[season][step], INK);
        expect(ratio, `${season}-${step} 잉크 대비 ${ratio.toFixed(2)}`).toBeGreaterThanOrEqual(
          4.5,
        );
      }
    }
  });

  it('글자색(500~900)이 오늘 라임보다 대비가 나쁘지 않다', () => {
    for (const season of SEASONS) {
      for (const step of [500, 600, 700, 800, 900] as const) {
        const now = contrast(BRAND_LIME[step], WHITE);
        const next = contrast(SEASON_SCALES[season][step], WHITE);
        expect(next, `${season}-${step} 흰 배경 대비 회귀`).toBeGreaterThanOrEqual(now - 0.01);
      }
    }
  });

  it('옅은 바탕(50~200)은 거의 흰색을 유지한다 — hover 틴트 용도라 진해지면 안 된다', () => {
    for (const season of SEASONS) {
      for (const step of [50, 100, 200] as const) {
        expect(
          luminance(SEASON_SCALES[season][step]),
          `${season}-${step} 이 hover 틴트로 쓰기엔 진하다`,
        ).toBeGreaterThan(0.8);
      }
    }
  });
});
