'use client';

import { useEffect, type RefObject } from 'react';

import { mapBottomInset } from '@/lib/mapBottomInset';

/**
 * 지도 카드가 하단 도크와 겹치는 만큼을 재서 {@code --map-bottom-inset} 에 넣는다.
 *
 * <p>계산은 {@link mapBottomInset} 이 하고, 여기는 <b>언제 다시 재는지</b>만 맡는다 —
 * 스크롤·리사이즈. 카드는 문서 흐름 안에 있고 도크는 화면에 떠 있어서, 둘 사이 거리가
 * 스크롤에 따라 계속 변한다.
 *
 * <p>CSS 쪽 고정값은 그대로 둔다. 이 훅이 돌기 전(첫 그림)이나 JS 가 죽었을 때 쓰는 값이다 —
 * 한 지점에서만 맞지만 0 보다는 낫다.
 */
export function useMapBottomInset(ref: RefObject<HTMLElement | null>, enabled = true) {
  useEffect(() => {
    const el = ref.current;
    if (!el || !enabled || typeof window === 'undefined') return;

    // lg 부터는 도크가 없다(BottomDock 은 lg:hidden). 그 폭에서는 CSS 가 0 으로 되돌린다.
    const wide = window.matchMedia('(min-width: 1024px)');

    let frame = 0;
    const measure = () => {
      frame = 0;
      if (wide.matches) {
        el.style.removeProperty('--map-bottom-inset');
        return;
      }
      // 도크를 직접 잰다. 높이가 바뀌어도 따라오고, 숨겨져 있으면 겹칠 일도 없다.
      const dock = document.querySelector<HTMLElement>('[data-bottom-dock]');
      const rect = dock?.getBoundingClientRect();
      if (!rect || rect.height < 1) {
        el.style.removeProperty('--map-bottom-inset');
        return;
      }
      const inset = mapBottomInset({
        cardBottom: el.getBoundingClientRect().bottom,
        dockTop: rect.top,
      });
      el.style.setProperty('--map-bottom-inset', `${inset}px`);
    };

    // 스크롤마다 레이아웃을 읽으면 스크롤이 끊긴다. 한 프레임에 한 번만 잰다.
    const schedule = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(measure);
    };

    measure();
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    wide.addEventListener('change', schedule);

    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      wide.removeEventListener('change', schedule);
      // 붙여 둔 값을 떼어 CSS 기본값으로 돌려놓는다.
      el.style.removeProperty('--map-bottom-inset');
    };
  }, [ref, enabled]);
}
