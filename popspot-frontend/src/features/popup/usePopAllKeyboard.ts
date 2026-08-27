'use client';

import { useEffect, type RefObject } from 'react';

export type PopAllKeyAction = 'focusSearch' | 'prevPage' | 'nextPage' | null;

/**
 * 지금 글자를 받고 있는 칸인가 — 그렇다면 단축키가 끼어들면 안 된다.
 *
 * <p>편집 가능 여부를 <b>두 가지로</b> 본다. {@code isContentEditable} 은 상속까지 계산해 주지만
 * 브라우저가 레이아웃에서 얻는 값이라 테스트 환경(jsdom)에는 없다. 속성만 보면 상속을 놓친다.
 * 둘을 함께 보면 어느 쪽에서도 빠지지 않는다. {@code contenteditable="false"} 는 명시적으로
 * "편집 불가" 라는 뜻이므로 참으로 세지 않는다.
 */
function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if (target.isContentEditable) return true;
  const attr = target.getAttribute('contenteditable');
  return attr !== null && attr !== 'false';
}

/**
 * 키 하나가 POP-ALL 에서 무엇을 뜻하는가. <b>판단만 하고 아무것도 하지 않는다.</b>
 *
 * <p>훅에서 떼어낸 이유는 이 판단이 전부이기 때문이다 — 어떤 키가 무엇을 하고, <b>언제
 * 양보하는가</b>. 양보 규칙이 특히 중요하다. 글자를 받는 칸 안에서 단축키가 이기면 이름에
 * 슬래시가 든 팝업을 검색할 수 없고 검색어 안에서 커서도 못 옮긴다 — 단축키가 아예 없는 것보다
 * 나쁘다.
 *
 * <p>Esc 는 다루지 않는다. Radix Dialog 가 이미 처리하고 있고, 여기서 또 잡으면 두 번
 * 닫히거나(history 항목이 두 개 소비된다) 서로 막는다.
 */
export function popAllKeyAction(key: string, target: EventTarget | null): PopAllKeyAction {
  if (isTyping(target)) return null;
  if (key === '/') return 'focusSearch';
  if (key === 'ArrowRight') return 'nextPage';
  if (key === 'ArrowLeft') return 'prevPage';
  return null;
}

/**
 * {@link popAllKeyAction} 의 판단을 실제 동작에 잇는 배선.
 *
 * <p><b>{@code enabled} 가 왜 필요한가.</b> 리스너는 {@code document} 에 붙는다 — 모달이 아니라
 * 문서 전체다. 모달이 닫혔는데도 이 컴포넌트가 아직 마운트돼 있으면(닫는 애니메이션이 도는 동안,
 * 그리고 그 애니메이션이 rAF 에 묶여 있어 숨은 탭에서는 끝나지 않는다) 홈 화면에서 누른 화살표가
 * 보이지도 않는 목록의 페이지를 넘기고 슬래시가 보이지 않는 입력칸으로 포커스를 옮긴다.
 */
export function usePopAllKeyboard({
  enabled,
  searchRef,
  onPrevPage,
  onNextPage,
}: {
  enabled: boolean;
  searchRef: RefObject<HTMLInputElement | null>;
  onPrevPage: () => void;
  onNextPage: () => void;
}): void {
  useEffect(() => {
    if (!enabled) return;
    const onKeyDown = (e: KeyboardEvent) => {
      const action = popAllKeyAction(e.key, e.target);
      if (!action) return;
      // 브라우저 기본 동작(슬래시 빠른검색, 화살표 스크롤)을 막는다.
      e.preventDefault();
      if (action === 'focusSearch') searchRef.current?.focus();
      else if (action === 'nextPage') onNextPage();
      else onPrevPage();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [enabled, searchRef, onPrevPage, onNextPage]);
}
