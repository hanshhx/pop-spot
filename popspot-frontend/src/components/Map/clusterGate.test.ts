import { describe, expect, it } from 'vitest';

import { isClusteringDisabled } from './clusterGate';

/**
 * 랜딩 지도 클러스터링 게이트.
 *
 * <p>성수 슬라이스(112개 마커)를 655×370 카드에 그대로 펼치면 이름표가 겹쳐 뭉개진다 —
 * 실제로 봤다. forceCluster 는 그 카드에서만 폭 조건을 우회해 모바일과 같은 클러스터링을
 * 강제한다. 나머지 탈출구(줌 16 이상, showPath, PLAN 모드)는 그대로 남아야 한다.
 */
const base = {
  isMobileViewport: false,
  forceCluster: false,
  zoomLevel: 13,
  showPath: false,
  mode: 'DEFAULT' as const,
};

describe('isClusteringDisabled', () => {
  it('모바일 폭이면 forceCluster 없이도 클러스터링을 켠다', () => {
    expect(isClusteringDisabled({ ...base, isMobileViewport: true })).toBe(false);
  });

  it('데스크톱 폭이고 forceCluster 가 없으면 지금처럼 클러스터링을 끈다', () => {
    expect(isClusteringDisabled({ ...base, isMobileViewport: false })).toBe(true);
  });

  it('데스크톱 폭이어도 forceCluster 면 클러스터링을 켠다', () => {
    expect(isClusteringDisabled({ ...base, isMobileViewport: false, forceCluster: true })).toBe(
      false,
    );
  });

  it('forceCluster 라도 줌 16 이상으로 들어가면 낱개로 푼다', () => {
    expect(
      isClusteringDisabled({
        ...base,
        isMobileViewport: false,
        forceCluster: true,
        zoomLevel: 16,
      }),
    ).toBe(true);
  });
});
