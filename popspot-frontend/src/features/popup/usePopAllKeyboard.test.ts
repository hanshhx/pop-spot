// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { popAllKeyAction } from './usePopAllKeyboard';

/** 지정한 태그의 요소를 만들어 문서에 붙인다 — 이벤트 target 자리에 넣기 위한 것. */
function el(tag: string): HTMLElement {
  const node = document.createElement(tag);
  document.body.appendChild(node);
  return node;
}

describe('popAllKeyAction', () => {
  it('슬래시는 검색창으로 포커스를 옮기라는 뜻이다', () => {
    expect(popAllKeyAction('/', el('div'))).toBe('focusSearch');
  });

  it('오른쪽 화살표는 다음 페이지다', () => {
    expect(popAllKeyAction('ArrowRight', el('div'))).toBe('nextPage');
  });

  it('왼쪽 화살표는 이전 페이지다', () => {
    expect(popAllKeyAction('ArrowLeft', el('div'))).toBe('prevPage');
  });

  it('다루지 않는 키에는 아무 일도 시키지 않는다', () => {
    expect(popAllKeyAction('a', el('div'))).toBeNull();
    expect(popAllKeyAction('Enter', el('div'))).toBeNull();
    expect(popAllKeyAction('ArrowUp', el('div'))).toBeNull();
  });

  it('Esc 는 다루지 않는다', () => {
    // Radix Dialog 가 이미 처리한다. 여기서 또 잡으면 두 번 닫히거나 서로 막는다.
    expect(popAllKeyAction('Escape', el('div'))).toBeNull();
  });

  it('입력칸 안에서는 슬래시를 가로채지 않는다', () => {
    // 이름에 슬래시가 든 팝업을 영영 검색할 수 없게 되는 것이 이 실수의 대가다.
    expect(popAllKeyAction('/', el('input'))).toBeNull();
  });

  it('입력칸 안에서 화살표는 커서 이동이지 페이지 이동이 아니다', () => {
    expect(popAllKeyAction('ArrowRight', el('input'))).toBeNull();
  });

  it('여러 줄 입력칸에서도 양보한다', () => {
    expect(popAllKeyAction('/', el('textarea'))).toBeNull();
  });

  it('선택 상자에서도 양보한다', () => {
    // 화살표로 항목을 고르는 중에 페이지가 넘어가면 고르던 것을 잃는다.
    expect(popAllKeyAction('ArrowRight', el('select'))).toBeNull();
  });

  it('편집 가능한 영역에서도 양보한다', () => {
    const node = el('div');
    node.setAttribute('contenteditable', 'true');
    expect(popAllKeyAction('/', node)).toBeNull();
  });

  it('값 없는 contenteditable 도 편집 가능으로 본다', () => {
    // <div contenteditable> 는 참이다.
    const node = el('div');
    node.setAttribute('contenteditable', '');
    expect(popAllKeyAction('/', node)).toBeNull();
  });

  it('contenteditable="false" 는 편집 불가이므로 단축키가 그대로 동작한다', () => {
    // 명시적으로 "편집 불가" 라고 적어 둔 것을 편집 칸으로 세면 단축키가 통째로 죽는다.
    const node = el('div');
    node.setAttribute('contenteditable', 'false');
    expect(popAllKeyAction('/', node)).toBe('focusSearch');
  });

  it('target 이 없으면 단축키로 본다', () => {
    expect(popAllKeyAction('ArrowRight', null)).toBe('nextPage');
  });

  it('요소가 아닌 target 에도 넘어지지 않는다', () => {
    // keydown 의 target 이 document 나 window 인 경우가 있다.
    expect(popAllKeyAction('ArrowRight', document)).toBe('nextPage');
  });
});
