import { describe, expect, it } from 'vitest';

import { SEASONS } from '@/lib/season';
import { DEFAULT_OG_IMAGE, hasSeasonOgImage, ogImageFor, seasonOgPath } from './seasonOgImage';

describe('seasonOgPath', () => {
  it('계절이 파일명에 들어간다', () => {
    // 내용만 갈아치우면 CDN 과 카카오톡이 옛 그림을 계속 내보낸다. 주소가 바뀌어야 통한다.
    expect(seasonOgPath('winter')).toBe('/og-image-winter.png');
    expect(seasonOgPath('summer')).toBe('/og-image-summer.png');
  });

  it('계절마다 주소가 다르다', () => {
    const paths = new Set(SEASONS.map(seasonOgPath));
    expect(paths.size).toBe(SEASONS.length);
  });
});

describe('ogImageFor', () => {
  it('카드가 없으면 기본 카드로 물러선다', () => {
    // 주소만 적고 파일이 없으면 공유했을 때 깨진 이미지가 나간다 — 카드가 없는 것보다 나쁘다.
    for (const season of SEASONS) {
      if (!hasSeasonOgImage(season)) expect(ogImageFor(season)).toBe(DEFAULT_OG_IMAGE);
    }
  });

  it('어느 계절에도 빈 주소를 주지 않는다', () => {
    for (const season of SEASONS) {
      expect(ogImageFor(season)).toMatch(/^\/.+\.png$/);
    }
  });

  it('있다고 적힌 계절은 계절 카드를 쓴다', () => {
    for (const season of SEASONS) {
      if (hasSeasonOgImage(season)) expect(ogImageFor(season)).toBe(seasonOgPath(season));
    }
  });
});
