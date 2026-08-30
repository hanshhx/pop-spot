import { describe, expect, it } from 'vitest';

import { SEASONS } from '@/lib/season';
import { BRAND_LIME, SEASON_SCALES } from '@/lib/seasonPalette';
import { tintOnSurface, tokensFor, type LimeTokens } from './tokens';

/**
 * 웹에는 {@code seasonPalette.test.ts} 가 있다 — {@code globals.css} 의 계절 블록과
 * {@code SEASON_SCALES} 가 어긋나면 잡는 테스트다. 앱에는 CSS 가 없으니 그 테스트를 그대로 가져올
 * 수 없는데, <b>막으려던 사고는 그대로 있다</b>: 색 값이 두 곳에 적혀 서로 갈리는 것.
 *
 * <p>앱에서 그 두 곳은 {@code lib/seasonPalette.ts}(라임 스케일)와 {@code theme/tokens.ts}(시안이
 * 부르는 이름)다. 아래가 둘을 묶어 둔다.
 */

/** 시안의 이름 → 스케일 단계. */
const STEP_OF: Record<keyof LimeTokens, 50 | 100 | 200 | 300 | 400 | 500 | 700> = {
  l0: 50,
  l1: 100,
  l2: 200,
  l3: 300,
  l4: 400,
  l5: 500,
  l7: 700,
};

describe('tokensFor', () => {
  it('브랜드의 라임은 BRAND_LIME 을 그대로 쓴다', () => {
    const t = tokensFor('brand', false);
    for (const [name, step] of Object.entries(STEP_OF)) {
      expect(t[name as keyof LimeTokens]).toBe(BRAND_LIME[step]);
    }
  });

  it.each(SEASONS)('%s 의 라임은 SEASON_SCALES 를 그대로 쓴다', (season) => {
    const t = tokensFor(season, false);
    for (const [name, step] of Object.entries(STEP_OF)) {
      expect(t[name as keyof LimeTokens]).toBe(SEASON_SCALES[season][step]);
    }
  });

  it('계절은 표면색을 바꾸고 카드 흰색은 건드리지 않는다', () => {
    expect(tokensFor('brand', false).bg).toBe('#f5f3ee');
    expect(tokensFor('summer', false).bg).toBe('#f5fafb');
    for (const season of SEASONS) {
      expect(tokensFor(season, false).sf).toBe('#ffffff');
    }
  });

  /* 다크에서 라임을 낮추면 계절색이 두 벌이 되어 대비 검증을 여덟 번 해야 한다. tokens.ts 의
     DARK_SURFACE 주석이 말하는 규칙이고, 지키는지 여기서 본다. */
  it.each(SEASONS)('다크는 %s 의 라임을 건드리지 않는다', (season) => {
    const light = tokensFor(season, false);
    const dark = tokensFor(season, true);
    for (const name of Object.keys(STEP_OF) as (keyof LimeTokens)[]) {
      expect(dark[name]).toBe(light[name]);
    }
    expect(dark.bg).not.toBe(light.bg);
  });

  it('겨울만 라임 위 글자가 흰색이다', () => {
    expect(tokensFor('winter', false).hif).toBe('#ffffff');
    for (const season of ['spring', 'summer', 'autumn'] as const) {
      expect(tokensFor(season, false).hif).not.toBe('#ffffff');
    }
  });
});

describe('tintOnSurface', () => {
  /* 시안의 color-mix(in srgb, var(--l3) 8%, var(--sf)) 자리. 계산이 되는지, 그리고 라이트/다크가
     서로 다른 값을 내는지 — 다크에서 흰 배경이 그대로 나오면 안 읽음 카드가 눈을 찌른다. */
  it('라임을 카드 면에 섞어 hex 를 돌려준다', () => {
    expect(tintOnSurface(tokensFor('brand', false), 8)).toMatch(/^#[0-9a-f]{6}$/);
  });

  it('0% 는 카드 면 그대로, 100% 는 라임 그대로', () => {
    const t = tokensFor('brand', false);
    expect(tintOnSurface(t, 0)).toBe('#ffffff');
    expect(tintOnSurface(t, 100)).toBe(t.l3);
  });

  it('다크에서는 어두운 쪽으로 섞인다', () => {
    const light = tintOnSurface(tokensFor('brand', false), 8);
    const dark = tintOnSurface(tokensFor('brand', true), 8);
    expect(dark).not.toBe(light);
  });
});
