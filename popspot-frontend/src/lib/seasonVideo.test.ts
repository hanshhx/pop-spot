import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { SEASON_BG, seasonBackground, type SeasonBgManifest } from './seasonVideo';
import { SEASONS } from './season';

/**
 * 아무 칸도 채우지 않은 매니페스트.
 *
 * <p>물러섬을 확인하는 시험은 <b>실제 {@code SEASON_BG} 가 비어 있다는 사실에 기대면 안 된다.</b>
 * 처음엔 여덟 칸이 다 {@code null} 이라 기대어도 통했지만, 파일이 들어온 순간 "물러선다" 는
 * 시험이 "안 물러선다" 로 뒤집혀 깨졌다. 시험 대상은 채워진 정도가 아니라 함수의 규칙이다.
 */
const EMPTY: SeasonBgManifest = {
  spring: { light: null, dark: null },
  summer: { light: null, dark: null },
  autumn: { light: null, dark: null },
  winter: { light: null, dark: null },
};

describe('계절 배경 영상', () => {
  it('계절 파일이 없으면 기존 두 편으로 떨어진다', () => {
    // 없는 주소를 내주면 배경이 통째로 빈다 — 계절감을 더하려다 원래 있던 것까지 잃는다.
    expect(seasonBackground('spring', false, EMPTY)).toMatchObject({
      src: '/light-bg.mp4',
      seasonal: false,
    });
    expect(seasonBackground('winter', true, EMPTY)).toMatchObject({
      src: '/login-bg-v2.mp4',
      seasonal: false,
    });
  });

  it('재생 속도는 라이트 0.5 · 다크 1 을 유지한다', () => {
    expect(seasonBackground('summer', false).rate).toBe(0.5);
    expect(seasonBackground('summer', true).rate).toBe(1);
  });

  it('여덟 칸이 모두 선언돼 있다', () => {
    for (const season of SEASONS) {
      expect(SEASON_BG[season]).toHaveProperty('light');
      expect(SEASON_BG[season]).toHaveProperty('dark');
    }
  });

  it('채워진 칸만 그 경로를 쓰고, 옆 칸은 그대로 기본 영상이다', () => {
    // 파일은 한 칸씩 들어온다 — 라이트만 채운 계절이 다크까지 끌고 가면 안 된다.
    const filled: SeasonBgManifest = {
      ...EMPTY,
      autumn: { light: '/bg/autumn-light.mp4', dark: null },
    };

    expect(seasonBackground('autumn', false, filled)).toMatchObject({
      src: '/bg/autumn-light.mp4',
      seasonal: true,
    });
    expect(seasonBackground('autumn', true, filled)).toMatchObject({
      src: '/login-bg-v2.mp4',
      seasonal: false,
    });
    expect(seasonBackground('spring', false, filled)).toMatchObject({
      src: '/light-bg.mp4',
      seasonal: false,
    });
  });

  it('적어 둔 경로에는 실제로 파일이 있다', () => {
    // 이 매니페스트의 유일한 실패 방식이다. 파일 없이 경로만 올리면 배경이 비고, 실패를
    // 캐시하는 브라우저에서는 새로고침해도 안 돌아온다 — 위 주석이 걱정하는 바로 그 상황이다.
    // 넣기 전에 확인하자는 약속은 언젠가 깨지므로 여기서 디스크를 직접 본다.
    for (const season of SEASONS) {
      for (const mode of ['light', 'dark'] as const) {
        const path = SEASON_BG[season][mode];
        if (path === null) continue;
        const file = fileURLToPath(new URL(`../../public${path}`, import.meta.url));
        expect(existsSync(file), `${path} 에 파일이 없다`).toBe(true);
      }
    }
  });
});

/**
 * 정지 화면 판정.
 *
 * <p>이 규칙이 틀리면 이미지를 {@code <video>} 에 물리거나 그 반대가 되고, 둘 다 배경이 통째로
 * 빈다 — 그리고 화면에는 오류가 아니라 그냥 <b>아무것도 없음</b>으로 보인다.
 */
describe('정지 화면 판정', () => {
  it('가을은 정지 화면이다 — 카메라가 움직여 어지럽다는 신고로 바꿨다', () => {
    expect(seasonBackground('autumn', false).still).toBe(true);
    expect(seasonBackground('autumn', true).still).toBe(true);
  });

  it('나머지 계절은 영상 그대로다', () => {
    for (const season of ['spring', 'summer', 'winter'] as const) {
      expect(seasonBackground(season, false).still).toBe(false);
      expect(seasonBackground(season, true).still).toBe(false);
    }
  });

  it('기본 영상으로 떨어졌으면 영상이다', () => {
    expect(seasonBackground('autumn', false, EMPTY).still).toBe(false);
    expect(seasonBackground('autumn', true, EMPTY).still).toBe(false);
  });

  /* 확장자가 곧 규칙이다. 새 형식을 넣을 때 여기부터 고치게 된다. */
  it('이미지 확장자면 정지, 영상 확장자면 아니다', () => {
    const cases: [string, boolean][] = [
      ['/bg/x.webp', true],
      ['/bg/x.avif', true],
      ['/bg/x.png', true],
      ['/bg/x.jpg', true],
      ['/bg/x.JPEG', true],
      ['/bg/x.mp4', false],
      ['/bg/x.webm', false],
    ];
    for (const [path, still] of cases) {
      const manifest: SeasonBgManifest = { ...EMPTY, spring: { light: path, dark: null } };
      expect(seasonBackground('spring', false, manifest).still, path).toBe(still);
    }
  });
});
