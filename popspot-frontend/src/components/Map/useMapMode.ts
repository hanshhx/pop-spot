'use client';

import { useTheme } from 'next-themes';
import type { MapMode } from './mapStyle';

/**
 * 지도 소비자 공통 훅 — 사이트 전역 테마를 지도 mode 로 바꾸고, 테마가 확정된 뒤에만 지도를 만들게 한다.
 *
 * <p>next-themes 의 {@code resolvedTheme} 은 마운트 전 undefined 라 첫 렌더는 무조건 dark 가 된다.
 * 게이트 없이 지도를 만들면 라이트 사용자는 '다크로 떴다가 라이트로 재도색되는' 깜빡임을 본다.
 * 이 로직이 InteractiveMap 과 DetailMap 에 각각 복사돼 있어, 새 소비자가 생길 때마다 같은 버그를
 * 재현할 위험이 있었으므로 훅으로 묶었다.
 *
 * <p>준비 여부는 별도 mounted state 대신 {@code resolvedTheme} 확정 자체로 판단한다. 상태·이펙트가
 * 없어 더 단순하고, "마운트됐다" 가 아니라 "테마를 안다" 는 실제로 필요한 조건을 정확히 표현한다.
 *
 * @returns mode 지도 테마, ready 지도를 만들어도 되는 시점(false 면 렌더 보류)
 */
export function useMapMode(): { mode: MapMode; ready: boolean } {
  const { resolvedTheme } = useTheme();
  return {
    mode: resolvedTheme === 'light' ? 'light' : 'dark',
    ready: resolvedTheme !== undefined,
  };
}
