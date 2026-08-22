'use client';

import { useTheme } from 'next-themes';

/**
 * 지도를 만들어도 되는 시점인가.
 *
 * <p>{@code resolvedTheme} 은 마운트 전 {@code undefined} 다. 게이트 없이 지도를 만들면 라이트
 * 사용자는 '다크로 떴다가 라이트로 재도색되는' 깜빡임을 본다. 이 판단이 InteractiveMap 과
 * DetailMap 에 각각 복사돼 있어, 새 소비자가 생길 때마다 같은 버그를 재현할 위험이 있었다.
 *
 * <p>준비 여부는 별도 mounted state 대신 {@code resolvedTheme} 확정 자체로 판단한다. 상태·이펙트가
 * 없어 더 단순하고, "마운트됐다" 가 아니라 "테마를 안다" 는 실제로 필요한 조건을 정확히 표현한다.
 *
 * <p>예전에는 여기서 지도에 넘길 {@code mode} 도 같이 돌려줬다. 지금은 지도가 {@code <html>} 의
 * 클래스를 직접 읽는다 — 색을 만드는 CSS 변수와 같은 출처여야 어긋나지 않기 때문이다.
 * 경위는 {@code lib/documentTheme} 주석에 있다.
 */
export function useMapReady(): boolean {
  const { resolvedTheme } = useTheme();
  return resolvedTheme !== undefined;
}
