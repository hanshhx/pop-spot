'use client';

import { useEffect, useRef } from 'react';

/**
 * 다이얼로그의 열림 상태에 history 항목 하나를 묶는다.
 *
 * <p><b>왜 필요한가.</b> {@code useState} 로만 여닫는 다이얼로그는 history 에 아무 흔적도 안
 * 남긴다. 모바일에서 뒤로가기를 누르면 다이얼로그가 아니라 <b>그 전 페이지(대개 사이트 밖)</b>
 * 로 나가 버린다. URL 은 바꾸지 않는다({@code pushState(state, '', location.href)}) — 쿼리
 * 파라미터를 붙이면 홈 스크롤 복원({@code homeReturnScroll.ts}, {@code saved.search ===
 * location.search} 로 판정)과 어떻게 얽힐지 이번 작업 범위에서 다 따지지 못해 위험하다.
 *
 * <p><b>"사용자가 닫음" 과 "다른 페이지로 가려고 닫음" 을 구분한다.</b> Escape·바깥 클릭·닫기
 * 버튼은 전부 Radix 의 {@code onOpenChange(false)} 하나로 들어와서 그 안에서는 구분할 수 없다.
 * 그래서 이 훅이 돌려주는 {@link HistoryBackedModal.onOpenChange} 는 "사용자가 닫음" 전용이다
 * — 우리가 push 한 항목이 아직 살아 있으면 {@code history.back()} 으로 소비해 스택에 쌓이지
 * 않게 한다. 다른 페이지로 옮겨가려는 클릭(예: 카드 클릭)은 이 함수를 부르지 말고
 * {@link HistoryBackedModal.notifyNavigatingAway} 를 먼저 불러 "이미 처리됨" 으로 표시한 뒤
 * 직접 라우팅해야 한다 — 그래야 {@code history.back()} 과 다음 페이지로의 이동이 경합하지
 * 않는다. {@code back()} 은 비동기라, 그 뒤에 바로 push 하면 뒤로 갔다가 다시 앞으로 가는
 * 경쟁이 생겨 스택이 어떤 순서로 끝날지 타이밍에 좌우된다 — 그 경합 자체를 만들지 않는 것이
 * 이 설계의 핵심이다.
 *
 * <p><b>React StrictMode 이중 실행.</b> 개발 모드에서 컴포넌트가 새로 마운트될 때 React 가
 * effect 를 (설치 → 정리 → 재설치) 순서로 두 번 부른다. {@code pushedRef} 는 그 정리 단계에서
 * 리셋하지 않으므로, 두 번째 설치는 "이미 push 했다" 를 보고 다시 push 하지 않는다 — 항목이
 * 두 개 쌓이는 것을 막는다. (리스너는 매번 다시 붙여도 안전하다 — 정리에서 반드시 떼기 때문에
 * 중복 리스너가 남지 않는다.)
 */
export interface HistoryBackedModal {
  /** {@code <Dialog onOpenChange>} 에 그대로 꽂는다 — 사용자가 직접 닫는 경로 전용. */
  onOpenChange: (next: boolean) => void;
  /**
   * 다른 페이지로 이동하려고 닫을 때, 라우팅 직전에 부른다. 이걸 부른 뒤에는 원래
   * {@code onOpenChange}(파라미터로 받은 것) 를 직접 불러 상태만 닫고, 이 훅의
   * {@link onOpenChange} 는 부르지 않는다 — 그래야 {@code history.back()} 이 끼어들지 않는다.
   */
  notifyNavigatingAway: () => void;
}

export function useHistoryBackedModal(
  open: boolean,
  onOpenChange: (open: boolean) => void,
): HistoryBackedModal {
  const pushedRef = useRef(false);
  // 매 렌더 최신 onOpenChange 를 잡아 두어, popstate 리스너가 클로저에 갇힌 옛 콜백을 부르지
  // 않게 한다. ref 갱신은 렌더 중이 아니라 effect 안에서 한다 — react-hooks/refs 가 렌더 중
  // ref.current 대입을 금지한다(동시성 렌더링에서 안전하지 않다).
  const onOpenChangeRef = useRef(onOpenChange);
  useEffect(() => {
    onOpenChangeRef.current = onOpenChange;
  });

  useEffect(() => {
    if (!open) return;
    if (!pushedRef.current) {
      window.history.pushState({ popspotModal: true }, '', window.location.href);
      pushedRef.current = true;
    }
    const handlePopState = () => {
      // 브라우저가 이미 우리가 push 한 항목을 떠났다(사용자가 뒤로가기를 눌렀다) — 여기서
      // history.back() 을 또 부르면 한 번 더 뒤로 가 버린다. 상태만 맞춘다.
      pushedRef.current = false;
      onOpenChangeRef.current(false);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [open]);

  const handleOpenChange = (next: boolean) => {
    if (!next && pushedRef.current) {
      pushedRef.current = false;
      window.history.back();
    }
    onOpenChange(next);
  };

  const notifyNavigatingAway = () => {
    pushedRef.current = false;
  };

  return { onOpenChange: handleOpenChange, notifyNavigatingAway };
}
