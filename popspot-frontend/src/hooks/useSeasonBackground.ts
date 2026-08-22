'use client';

import { useTheme } from 'next-themes';

import { useSeason } from '@/hooks/useSeason';
import { backgroundVideoRate, backgroundVideoSrc, type ThemeMode } from '@/lib/seasonVideo';

/**
 * 지금 배경에 틀 영상 — 계절과 테마를 합쳐 하나로 답한다.
 *
 * <p>두 값이 필요한데 출처가 다르다. 계절은 서버가 {@code <html data-season>} 에 정해 둔 것이고
 * ({@link useSeason}), 테마는 브라우저에만 있다(next-themes). 둘을 화면에서 각각 읽으면 배경을
 * 쓰는 곳마다 같은 조합 규칙을 다시 적게 된다.
 *
 * <h3>{@code ready} 가 필요한 이유</h3>
 *
 * <p>{@code resolvedTheme} 은 마운트 전 {@code undefined} 다. 그대로 두면 라이트 사용자도 첫
 * 프레임에는 <b>다크 영상</b>을 받기 시작한다 — 곧 라이트로 바뀌므로 그 2MB 는 통째로 버려진다.
 * 잘못 받은 영상이 잠깐 비치는 것도 문제지만, 셀룰러에서 버려지는 전송량이 더 아깝다.
 * 그래서 "테마를 안다" 가 될 때까지 그리지 않는다. 판단 방식은 {@code useMapMode} 와 같다.
 */
export function useSeasonBackground(): { src: string; rate: number; ready: boolean } {
  const season = useSeason();
  const { resolvedTheme } = useTheme();

  const mode: ThemeMode = resolvedTheme === 'light' ? 'light' : 'dark';
  return {
    src: backgroundVideoSrc(season, mode),
    rate: backgroundVideoRate(season, mode),
    ready: resolvedTheme !== undefined,
  };
}
