'use client';

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

import { isSeason, seasonOfNow, type Season } from './season';

/**
 * 지금 화면이 입고 있는 계절을 앱 전체가 하나로 공유한다.
 *
 * <p>컴포넌트마다 {@code document.documentElement.dataset.season} 을 직접 읽지 않는 이유는
 * <b>서버 렌더</b> 때문이다. 서버에는 {@code document} 가 없어서 각자 읽으면 첫 HTML 이 기본
 * 계절로 그려지고 하이드레이션에서 어긋난다. 그래서 루트 레이아웃(서버)이 정한 값을 여기로
 * 내려보내고, 모두 그걸 읽는다.
 *
 * <p>관리자 화면과 {@code ?season=} 은 살아 있는 문서의 속성을 직접 갈아 끼우므로, 그 변경도
 * 따라가도록 속성을 관찰한다 — 새로고침 없이 계절이 바뀌어야 4계절을 눈으로 비교할 수 있다.
 */
const SeasonContext = createContext<Season | null>(null);

export function SeasonProvider({ season, children }: { season: Season; children: ReactNode }) {
  /* 서버가 준 값이 기본이고, 문서 속성이 그와 달라졌을 때만 이 state 가 값을 가진다. 서버 값을
     state 로 복사해 두면 다음 서버 렌더에서 계절이 바뀌어도 옛 값이 남는다. */
  const [override, setOverride] = useState<Season | null>(null);

  useEffect(() => {
    const root = document.documentElement;
    const sync = () => {
      const next = root.dataset.season;
      setOverride(isSeason(next) && next !== season ? next : null);
    };
    sync();
    const observer = new MutationObserver(sync);
    observer.observe(root, { attributes: true, attributeFilter: ['data-season'] });
    return () => observer.disconnect();
  }, [season]);

  return <SeasonContext.Provider value={override ?? season}>{children}</SeasonContext.Provider>;
}

/** 지금 계절. Provider 밖(테스트·단독 렌더)에서는 월 기준으로 떨어진다. */
export function useSeason(): Season {
  return useContext(SeasonContext) ?? seasonOfNow();
}
