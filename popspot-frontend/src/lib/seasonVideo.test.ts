import { describe, expect, it } from 'vitest';

import { SEASON_BG, seasonBgVideo } from './seasonVideo';
import { SEASONS } from './season';

describe('계절 배경 영상', () => {
  it('계절 파일이 없으면 기존 두 편으로 떨어진다', () => {
    // 없는 주소를 내주면 배경이 통째로 빈다 — 계절감을 더하려다 원래 있던 것까지 잃는다.
    expect(seasonBgVideo('spring', false)).toMatchObject({
      src: '/light-bg.mp4',
      seasonal: false,
    });
    expect(seasonBgVideo('winter', true)).toMatchObject({
      src: '/login-bg-v2.mp4',
      seasonal: false,
    });
  });

  it('재생 속도는 라이트 0.5 · 다크 1 을 유지한다', () => {
    expect(seasonBgVideo('summer', false).rate).toBe(0.5);
    expect(seasonBgVideo('summer', true).rate).toBe(1);
  });

  it('여덟 칸이 모두 선언돼 있다', () => {
    for (const season of SEASONS) {
      expect(SEASON_BG[season]).toHaveProperty('light');
      expect(SEASON_BG[season]).toHaveProperty('dark');
    }
  });

  it('채워진 칸만 그 경로를 쓰고, 옆 칸은 그대로 기본 영상이다', () => {
    // 파일은 한 칸씩 들어온다 — 라이트만 채운 계절이 다크까지 끌고 가면 안 된다.
    const filled = { ...SEASON_BG, autumn: { light: '/bg/autumn-light.mp4', dark: null } };

    expect(seasonBgVideo('autumn', false, filled)).toMatchObject({
      src: '/bg/autumn-light.mp4',
      seasonal: true,
    });
    expect(seasonBgVideo('autumn', true, filled)).toMatchObject({
      src: '/login-bg-v2.mp4',
      seasonal: false,
    });
    expect(seasonBgVideo('spring', false, filled)).toMatchObject({
      src: '/light-bg.mp4',
      seasonal: false,
    });
  });
});
