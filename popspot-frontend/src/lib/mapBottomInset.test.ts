import { describe, expect, it } from 'vitest';

import { DOCK_GAP_PX, dockTopFrom, mapBottomInset } from './mapBottomInset';

describe('mapBottomInset', () => {
  it('카드 바닥이 도크보다 위면 0 — 비켜설 이유가 없다', () => {
    // 0 이 아니라 늘 무언가를 비우면, 겹치지도 않는데 컨트롤이 카드 안에서 붕 뜬다.
    expect(mapBottomInset({ cardBottom: 600, dockTop: 734 })).toBe(0);
  });

  it('딱 붙어 있어도 틈만큼은 비운다', () => {
    expect(mapBottomInset({ cardBottom: 734, dockTop: 734 })).toBe(DOCK_GAP_PX);
  });

  it('카드가 화면 밖으로 내려간 만큼 더 비운다', () => {
    // 실제로 재 본 값이다 — 카드 바닥 859, 도크 윗변 734.
    expect(mapBottomInset({ cardBottom: 859, dockTop: 734 })).toBe(125 + DOCK_GAP_PX);
  });

  it('스크롤로 카드가 올라가면 비우는 양도 줄어든다', () => {
    const far = mapBottomInset({ cardBottom: 859, dockTop: 734 });
    const near = mapBottomInset({ cardBottom: 780, dockTop: 734 });
    expect(near).toBeLessThan(far);
    expect(near).toBe(46 + DOCK_GAP_PX);
  });

  it('값이 없으면 0 — 화면을 망가뜨리지 않는다', () => {
    expect(mapBottomInset({ cardBottom: NaN, dockTop: 734 })).toBe(0);
    expect(mapBottomInset({ cardBottom: 800, dockTop: NaN })).toBe(0);
  });

  it('틈을 바꾸면 결과가 따라온다', () => {
    expect(mapBottomInset({ cardBottom: 800, dockTop: 700, gap: 0 })).toBe(100);
    expect(mapBottomInset({ cardBottom: 800, dockTop: 700, gap: 20 })).toBe(120);
  });
});

describe('dockTopFrom', () => {
  it('실측값과 맞는다', () => {
    // 375x812 화면에서 재 본 도크 — 높이 70, 바닥에서 8 띄움 → 윗변 734.
    expect(dockTopFrom(812, 70, 8)).toBe(734);
  });

  it('sm 이상에서 도크가 커지면 윗변도 올라온다', () => {
    expect(dockTopFrom(812, 78, 8)).toBe(726);
  });
});
