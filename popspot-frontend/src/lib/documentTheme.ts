'use client';

import { useEffect, useState } from 'react';

/**
 * 지금 문서가 다크인가 — {@code <html>} 의 클래스를 <b>직접</b> 본다.
 *
 * <h3>왜 next-themes 의 resolvedTheme 을 쓰지 않는가</h3>
 *
 * <p>둘은 같은 값을 다른 시점에 말한다. {@code resolvedTheme} 은 React 상태라 렌더 때 정해지고,
 * {@code .dark} 클래스는 next-themes 가 DOM 에 쓰는 시점에 정해진다. CSS 변수를 읽어 색을 만드는
 * 쪽(지도)은 <b>클래스가 정한 값</b>을 보게 되므로, 상태를 기준으로 삼으면 한 프레임씩 어긋난다.
 *
 * <p>그 어긋남만이면 다음 전환에 풀린다. 문제는 "이미 적용했다" 를 기억하는 자리가 있을 때다 —
 * 상태 기준으로 키를 적어 두면, 클래스가 뒤늦게 제자리를 찾아도 키는 그대로라 다시 칠하지
 * 않는다. 지도가 <b>뒤집힌 채로 고정</b>됐던 것이 이 조합이었다. 색을 만든 출처와 "적용됨" 을
 * 기록하는 출처는 같아야 한다.
 *
 * <p>{@code data-season} 을 지켜보는 {@link SeasonProvider} 와 같은 방식이다 — 살아 있는 문서의
 * 속성이 바뀌는 것을 관찰해야, 관리자 화면이나 {@code ?season=} 처럼 React 를 거치지 않고
 * 바뀌는 경로도 따라갈 수 있다.
 */
export function useDocumentDark(): boolean {
  /* 첫 렌더부터 맞히려고 DOM 에서 초기값을 읽는다. 이 훅을 쓰는 지도는 ssr:false 로만 로드되므로
     서버에서 불릴 일이 없고, 그래서 여기서 document 를 봐도 하이드레이션이 어긋나지 않는다. */
  const [dark, setDark] = useState(
    () => typeof document !== 'undefined' && document.documentElement.classList.contains('dark'),
  );

  useEffect(() => {
    const root = document.documentElement;
    const sync = () => setDark(root.classList.contains('dark'));

    sync();
    const observer = new MutationObserver(sync);
    observer.observe(root, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  return dark;
}
