/**
 * 지도 안의 것들이 하단 도크를 피하려면 아래에서 얼마를 비워야 하는지 계산한다.
 *
 * <p>지도 컨트롤과 목록 시트는 지도 카드 기준({@code absolute})으로 놓인다. 그런데 도크는
 * 화면 기준({@code fixed})으로 떠 있다. 그래서 <b>비켜설 거리가 스크롤에 따라 달라진다</b> —
 * 카드 바닥이 화면 안에 있으면 조금만, 화면 밖으로 내려가 있으면 그만큼 더.
 *
 * <p>CSS 만으로 고정값을 주면 한 지점에서만 맞는다. 실제로 그렇게 해 봤더니 컨트롤은 비켜섰는데
 * 시트는 목록이 11px 만 남았다 — 카드 바닥이 화면보다 47px 아래였기 때문이다.
 *
 * <p>시트를 {@code fixed} 로 바꾸는 방법은 통하지 않는다. 홈에서 지도를 감싼 섹션이
 * framer-motion 으로 {@code transform} 을 갖고 있어서, 화면이 아니라 그 섹션이 기준이 된다.
 */

/** 도크와 컨트롤 사이에 남길 틈. */
export const DOCK_GAP_PX = 8;

export type InsetInput = {
  /** 지도 카드 아래끝의 화면 기준 위치(px). {@code getBoundingClientRect().bottom}. */
  cardBottom: number;
  /** 도크 윗변의 화면 기준 위치(px). */
  dockTop: number;
  gap?: number;
};

/**
 * @returns 카드 바닥에서 비워야 할 높이(px). 도크와 안 겹치면 0.
 *
 * <p>0 을 돌려주는 것이 중요하다 — 겹치지도 않는데 컨트롤을 올려 두면 카드 안에서 붕 뜬다.
 */
export function mapBottomInset({ cardBottom, dockTop, gap = DOCK_GAP_PX }: InsetInput): number {
  if (!Number.isFinite(cardBottom) || !Number.isFinite(dockTop)) return 0;
  // 컨트롤의 아래끝 = cardBottom - inset. 이것이 dockTop - gap 보다 위여야 한다.
  return Math.max(0, Math.round(cardBottom - dockTop + gap));
}

/**
 * 도크 윗변 위치. 도크는 바닥에서 {@code safeBottom} 만큼 띄워져 있고 높이가 {@code dockHeight} 다.
 *
 * <p>도크를 DOM 에서 못 찾았을 때 쓰는 계산이다. 찾을 수 있으면 실제 사각형을 쓰는 편이 낫다 —
 * 높이가 바뀌어도 따라간다.
 */
export function dockTopFrom(viewportHeight: number, dockHeight: number, safeBottom: number): number {
  return viewportHeight - safeBottom - dockHeight;
}
