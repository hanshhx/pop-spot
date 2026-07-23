'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * 가로 스크롤 레일에 <b>마우스 드래그</b> + <b>좌우 화살표</b> 네비게이션을 붙이는 훅.
 *
 * <ul>
 *   <li><b>드래그</b>: 마우스({@code pointerType==='mouse'})에서만 활성 — 터치는 네이티브 관성
 *       스크롤을 그대로 둔다(모바일에서 커스텀 드래그가 스크롤과 싸우지 않게).</li>
 *   <li><b>클릭 오발 방지</b>: 5px 넘게 끌면 {@code moved} 플래그를 세우고, 이어지는 click 을
 *       {@code onClickCapture} 에서 소거한다 — 카드를 끌고 놓았을 때 상세로 튀지 않게.</li>
 *   <li><b>화살표</b>: {@code scrollByPage(±1)} = 보이는 폭의 80% 만큼 스무스 스크롤(≈카드 3장).</li>
 *   <li><b>가시성</b>: 스크롤할 내용이 없으면({@code hasOverflow=false}) 화살표를 숨기고,
 *       양 끝({@code atStart/atEnd})에서는 해당 방향 버튼을 비활성화한다.</li>
 * </ul>
 *
 * <p><b>콜백 ref</b>를 쓰는 이유: 레일이 데이터 로딩 후 조건부로 렌더되면, 일반 객체 ref + mount-시
 * useEffect 는 요소가 아직 없을 때 실행돼 리스너를 못 붙인다. 콜백 ref 는 요소가 실제로 mount/unmount
 * 될 때 발화하므로 그 시점에 정확히 리스너와 overflow 측정을 붙인다.
 *
 * 반환값을 스크롤 컨테이너에 {@code ref={rail.ref}}, {@code {...rail.dragBind}} 로 붙이고,
 * 좌/우 버튼 onClick 에 {@code rail.scrollByPage(-1)}/{@code rail.scrollByPage(1)} 를 연결한다.
 */
export function useDragScroll<T extends HTMLElement = HTMLDivElement>() {
  const [node, setNode] = useState<T | null>(null);
  const ref = useCallback((el: T | null) => setNode(el), []);

  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(false);
  const [hasOverflow, setHasOverflow] = useState(false);

  const drag = useRef({ active: false, startX: 0, startLeft: 0, moved: false });

  useEffect(() => {
    if (!node) return;
    const update = () => {
      setHasOverflow(node.scrollWidth - node.clientWidth > 4);
      setAtStart(node.scrollLeft <= 1);
      setAtEnd(node.scrollLeft + node.clientWidth >= node.scrollWidth - 1);
    };
    update();
    node.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    // 자식(카드/이미지)이 늦게 로드돼 스크롤폭이 바뀌는 경우까지 반영.
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(update) : null;
    ro?.observe(node);
    return () => {
      node.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
      ro?.disconnect();
    };
  }, [node]);

  const scrollByPage = (dir: number) => {
    if (!node) return;
    node.scrollBy({ left: dir * Math.round(node.clientWidth * 0.8), behavior: 'smooth' });
  };

  const onPointerDown = (e: React.PointerEvent<T>) => {
    if (e.pointerType !== 'mouse' || !node) return;
    drag.current = { active: true, startX: e.clientX, startLeft: node.scrollLeft, moved: false };
    node.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent<T>) => {
    if (!drag.current.active || !node) return;
    const dx = e.clientX - drag.current.startX;
    if (Math.abs(dx) > 5) drag.current.moved = true;
    node.scrollLeft = drag.current.startLeft - dx;
  };

  const endDrag = (e: React.PointerEvent<T>) => {
    if (!drag.current.active) return;
    drag.current.active = false;
    node?.releasePointerCapture?.(e.pointerId);
  };

  const onClickCapture = (e: React.MouseEvent<T>) => {
    if (drag.current.moved) {
      e.preventDefault();
      e.stopPropagation();
      drag.current.moved = false;
    }
  };

  const dragBind = {
    onPointerDown,
    onPointerMove,
    onPointerUp: endDrag,
    onPointerLeave: endDrag,
    onClickCapture,
  };

  return { ref, dragBind, scrollByPage, atStart, atEnd, hasOverflow };
}
