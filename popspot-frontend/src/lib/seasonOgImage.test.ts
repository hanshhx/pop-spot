import { describe, expect, it } from 'vitest';

import { SEASONS } from './season';
import {
  DEFAULT_OG_IMAGE,
  hasSeasonOgImage,
  ogImageFor,
  seasonOgPath,
  shareCardFor,
} from './seasonOgImage';

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

/**
 * 공유 카드가 <b>비지 않는다</b>는 약속.
 *
 * <p>Next 의 metadata 는 자식의 openGraph 가 부모 것을 통째로 대체한다. 그래서 자식이 images 를
 * 빠뜨리면 루트의 카드까지 같이 사라지는데, 화면에는 아무 증상이 없다 — 카톡에 붙여 봐야 안다.
 */
describe('shareCardFor', () => {
  it('확인된 사진이 있으면 그것을 쓴다', () => {
    expect(shareCardFor('https://cdn.example.com/real.jpg')).toBe(
      'https://cdn.example.com/real.jpg',
    );
  });

  /* 지금 라이브의 모든 팝업이 여기 해당한다 — PEXELS 1,184 · PLACEHOLDER 221, 진짜 사진 0장. */
  it('확인된 사진이 없으면 브랜드 카드로 물러선다', () => {
    expect(shareCardFor(null)).toBe(DEFAULT_OG_IMAGE);
    expect(shareCardFor(undefined)).toBe(DEFAULT_OG_IMAGE);
  });

  it('빈 문자열·공백도 없는 것으로 본다', () => {
    expect(shareCardFor('')).toBe(DEFAULT_OG_IMAGE);
    expect(shareCardFor('   ')).toBe(DEFAULT_OG_IMAGE);
  });

  it('앞뒤 공백은 털어 낸다', () => {
    expect(shareCardFor('  https://cdn.example.com/a.jpg  ')).toBe('https://cdn.example.com/a.jpg');
  });
});
