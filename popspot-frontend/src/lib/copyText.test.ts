// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';

import { copyText } from './copyText';

/**
 * {@code navigator.clipboard} 와 {@code document.execCommand} 를 갈아 끼우며 확인한다.
 * 원래 값을 기억해 두고 시험마다 되돌린다.
 */
const clipboardDescriptor = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
const execDescriptor = Object.getOwnPropertyDescriptor(document, 'execCommand');

function setClipboard(value: unknown) {
  Object.defineProperty(navigator, 'clipboard', { value, configurable: true, writable: true });
}

/** jsdom 에는 execCommand 가 없다. 있는 척하거나, 없는 채로 둔다. */
function setExec(value: unknown) {
  Object.defineProperty(document, 'execCommand', { value, configurable: true, writable: true });
}

afterEach(() => {
  if (clipboardDescriptor) Object.defineProperty(navigator, 'clipboard', clipboardDescriptor);
  if (execDescriptor) Object.defineProperty(document, 'execCommand', execDescriptor);
  else setExec(undefined);
  vi.restoreAllMocks();
});

describe('copyText', () => {
  it('빈 글자는 복사하지 않는다', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    setClipboard({ writeText });

    expect(await copyText('')).toBe(false);
    expect(await copyText('   ')).toBe(false);
    expect(writeText).not.toHaveBeenCalled();
  });

  it('앞뒤 공백을 떼고 복사한다', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    setClipboard({ writeText });

    expect(await copyText('  서울 성동구 연무장길 5  ')).toBe(true);
    expect(writeText).toHaveBeenCalledWith('서울 성동구 연무장길 5');
  });

  it('clipboard 가 막히면 예전 방식으로 넘어간다', async () => {
    // 카카오톡 인앱 브라우저에서 실제로 겪는 상황이다. 창에 포커스가 없을 때도 같은 오류가 난다.
    setClipboard({ writeText: vi.fn().mockRejectedValue(new Error('NotAllowedError')) });
    const exec = vi.fn().mockReturnValue(true);
    setExec(exec);

    expect(await copyText('서울 성동구')).toBe(true);
    expect(exec).toHaveBeenCalledWith('copy');
  });

  it('clipboard 가 아예 없어도 예전 방식으로 넘어간다', async () => {
    // https 가 아니면 navigator.clipboard 자체가 undefined 라 접근하는 순간 TypeError 다.
    setClipboard(undefined);
    setExec(vi.fn().mockReturnValue(true));

    expect(await copyText('서울 성동구')).toBe(true);
  });

  it('예전 방식도 없으면 false — 성공했다고 하지 않는다', async () => {
    // 실패를 성공으로 보고하면 "복사했어요" 라고 해 놓고 붙여넣기가 안 된다.
    setClipboard(undefined);
    setExec(undefined);

    expect(await copyText('서울 성동구')).toBe(false);
  });

  it('예전 방식이 실패를 돌려주면 false', async () => {
    setClipboard(undefined);
    setExec(vi.fn().mockReturnValue(false));

    expect(await copyText('서울 성동구')).toBe(false);
  });

  it('임시로 만든 입력칸을 남기지 않는다', async () => {
    setClipboard(undefined);
    setExec(vi.fn().mockReturnValue(true));

    const before = document.querySelectorAll('textarea').length;
    await copyText('서울 성동구');
    expect(document.querySelectorAll('textarea')).toHaveLength(before);
  });

  it('예전 방식이 던져도 입력칸을 치운다', async () => {
    setClipboard(undefined);
    setExec(
      vi.fn(() => {
        throw new Error('boom');
      }),
    );

    const before = document.querySelectorAll('textarea').length;
    expect(await copyText('서울 성동구')).toBe(false);
    expect(document.querySelectorAll('textarea')).toHaveLength(before);
  });
});
