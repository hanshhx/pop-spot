import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { resolveSeason, SEASONS } from './season';

/**
 * 지정 계절 밖으로는 못 나가게 하는 두 겹의 잠금을 붙잡는다.
 *
 * <p>운영에서 보여줄 계절은 <b>관리자가 정한 것과 월 자동, 둘뿐</b>이어야 한다. 방문자가
 * 주소로 계절을 바꿀 수 있으면 링크가 공유되는 순간 통제를 잃고, 토큰이 하나라도 비면
 * 배너가 흰 바탕에 흰 글자가 된다.
 */

const ROOT = join(__dirname, '../..');
const CSS = readFileSync(join(ROOT, 'app/globals.css'), 'utf8');

/** 컴포넌트가 실제로 쓰는 --s-* 토큰을 소스에서 모은다. */
function tokensUsedInComponents(): Set<string> {
  const files = [
    'app/HomeClient.tsx',
    'src/components/layout/SeasonBadge.tsx',
    'src/components/main/PopupCard.tsx',
    'src/components/main/SeasonBanner.tsx',
    'src/features/admin/SeasonThemePanel.tsx',
    'src/components/Map/mapStyle.ts',
  ];
  const found = new Set<string>();
  for (const f of files) {
    const src = readFileSync(join(ROOT, f), 'utf8');
    for (const m of src.matchAll(/--s-[a-z0-9-]+/g)) found.add(m[0]);
  }
  return found;
}

/** :root 기본값 블록(계절 속성이 없는 것)만 떼어 온다. */
function rootDefaults(): string {
  const at = CSS.indexOf('계절 토큰 기본값');
  const start = CSS.indexOf(':root {', at);
  return CSS.slice(start, CSS.indexOf('}', start));
}

describe('계절 안전망', () => {
  it('컴포넌트가 쓰는 --s-* 토큰이 :root 기본값에 전부 있다', () => {
    const defaults = rootDefaults();
    const used = tokensUsedInComponents();
    expect(used.size).toBeGreaterThan(5);
    for (const token of used) {
      expect(
        defaults,
        `${token} 이 기본값에 없다 — data-season 이 빠지면 이 값이 무효가 된다`,
      ).toContain(`${token}:`);
    }
  });

  it('네 계절 블록도 같은 토큰을 빠짐없이 정의한다', () => {
    const used = tokensUsedInComponents();
    for (const season of SEASONS) {
      const at = CSS.indexOf(`:root[data-season='${season}']`);
      const block = CSS.slice(at, CSS.indexOf('}', at));
      for (const token of used) {
        expect(block, `${season} 블록에 ${token} 이 없다`).toContain(`${token}:`);
      }
    }
  });

  it('주소 오버라이드는 운영 번들에서 빠진다', () => {
    const src = readFileSync(join(ROOT, 'src/components/SeasonQueryOverride.tsx'), 'utf8');
    // 이 가드가 사라지면 방문자가 주소만으로 계절을 바꾸고 쿠키에 1년 남긴다.
    expect(src).toContain("process.env.NODE_ENV === 'production'");
    const guard = src.indexOf("process.env.NODE_ENV === 'production'");
    expect(src.indexOf('document.cookie'), '쿠키 쓰기가 가드보다 앞에 있다').toBeGreaterThan(guard);
    expect(src.indexOf('dataset.season ='), '속성 쓰기가 가드보다 앞에 있다').toBeGreaterThan(
      guard,
    );
  });

  it('어떤 입력이 와도 결과는 네 계절 중 하나다', () => {
    const junk = [null, undefined, '', 'nonsense', 'SUMMER', '여름', '../winter', '<script>', '0'];
    for (const override of junk) {
      for (const setting of junk) {
        expect(SEASONS).toContain(resolveSeason(override, setting, new Date(2026, 7, 22)));
      }
    }
  });
});
