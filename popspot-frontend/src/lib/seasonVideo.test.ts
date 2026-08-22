import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { SEASONS } from '@/lib/season';
import { backgroundVideoSrc, hasSeasonVideo, seasonVideoPath } from './seasonVideo';

describe('seasonVideoPath', () => {
  it('이름 규칙은 계절-테마.mp4', () => {
    expect(seasonVideoPath('summer', 'dark')).toBe('/season/summer-dark.mp4');
    expect(seasonVideoPath('winter', 'light')).toBe('/season/winter-light.mp4');
  });
});

describe('backgroundVideoSrc', () => {
  it('계절 영상이 없으면 지금 쓰던 영상으로 물러선다', () => {
    // 파일이 없는데 경로만 주면 화면이 검은 사각형이 된다.
    for (const season of SEASONS) {
      if (!hasSeasonVideo(season, 'light')) {
        expect(backgroundVideoSrc(season, 'light')).toBe('/light-bg.mp4');
      }
      if (!hasSeasonVideo(season, 'dark')) {
        expect(backgroundVideoSrc(season, 'dark')).toBe('/login-bg-v2.mp4');
      }
    }
  });

  it('어느 계절·테마에도 빈 경로를 주지 않는다', () => {
    for (const season of SEASONS) {
      for (const mode of ['light', 'dark'] as const) {
        expect(backgroundVideoSrc(season, mode)).toMatch(/^\/.+\.mp4$/);
      }
    }
  });

  it('라이트와 다크는 절대 같은 파일을 쓰지 않는다', () => {
    // 밝은 화면에 밤 영상이 깔리면 글자가 안 읽힌다. 반대도 마찬가지다.
    for (const season of SEASONS) {
      expect(backgroundVideoSrc(season, 'light')).not.toBe(backgroundVideoSrc(season, 'dark'));
    }
  });

  it('있다고 적힌 조합은 파일이 실제로 있다', () => {
    // 이 목록의 유일한 실패 방식이다: 파일 없이 이름만 올리면 화면이 검은 사각형이 된다.
    // 사람이 확인하기로 한 약속은 언젠가 깨지므로 여기서 디스크를 직접 본다.
    for (const season of SEASONS) {
      for (const mode of ['light', 'dark'] as const) {
        if (!hasSeasonVideo(season, mode)) continue;
        const file = fileURLToPath(
          new URL(`../../public${seasonVideoPath(season, mode)}`, import.meta.url),
        );
        expect(existsSync(file), `${file} 가 없다`).toBe(true);
      }
    }
  });

  it('있다고 적힌 조합은 계절 경로를 쓴다', () => {
    // 목록에 넣는 순간 규칙대로 잡히는지 — 파일을 넣고 한 줄 추가하면 끝이어야 한다.
    for (const season of SEASONS) {
      for (const mode of ['light', 'dark'] as const) {
        if (hasSeasonVideo(season, mode)) {
          expect(backgroundVideoSrc(season, mode)).toBe(seasonVideoPath(season, mode));
        }
      }
    }
  });
});
