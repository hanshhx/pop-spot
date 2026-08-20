// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import LoopingBgVideo from './LoopingBgVideo';

const waitForMediaWork = () => new Promise((resolve) => window.setTimeout(resolve, 40));
(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

describe('LoopingBgVideo', () => {
  let container: HTMLDivElement;
  let root: Root;
  let playCall = 0;
  let failStandby = false;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    playCall = 0;
    failStandby = false;

    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) =>
      window.setTimeout(() => callback(performance.now()), 0),
    );
    vi.stubGlobal('cancelAnimationFrame', (id: number) => window.clearTimeout(id));
    vi.stubGlobal('matchMedia', () => ({
      matches: true,
      media: '',
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));

    Object.defineProperty(HTMLMediaElement.prototype, 'readyState', {
      configurable: true,
      get: () => HTMLMediaElement.HAVE_ENOUGH_DATA,
    });
    Object.defineProperty(HTMLMediaElement.prototype, 'paused', {
      configurable: true,
      get: () => false,
    });
    vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => undefined);
    vi.spyOn(HTMLMediaElement.prototype, 'play').mockImplementation(function (
      this: HTMLMediaElement,
    ) {
      playCall += 1;
      if (failStandby && playCall > 1) return Promise.reject(new Error('standby failed'));
      window.setTimeout(() => this.dispatchEvent(new Event('playing')), 0);
      return Promise.resolve();
    });
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('화면 조건 확인 뒤 영상이 생겨도 첫 영상만 표시한다', async () => {
    await act(async () => root.render(<LoopingBgVideo src="/background.mp4" />));
    await act(async () => waitForMediaWork());

    const videos = container.querySelectorAll('video');
    expect(videos).toHaveLength(2);
    expect(videos[0].style.opacity).toBe('1');
    expect(videos[1].style.opacity).toBe('0');
  });

  it('예비 영상 재생에 실패하면 정상 영상을 검은 화면으로 덮지 않는다', async () => {
    await act(async () => root.render(<LoopingBgVideo src="/background.mp4" />));
    await act(async () => waitForMediaWork());

    const videos = container.querySelectorAll('video');
    const active = videos[0];
    const standby = videos[1];
    Object.defineProperty(active, 'duration', { configurable: true, value: 10 });
    active.currentTime = 9;
    failStandby = true;

    await act(async () => {
      active.dispatchEvent(new Event('timeupdate', { bubbles: true }));
      await waitForMediaWork();
    });

    expect(active.style.opacity).toBe('1');
    expect(standby.style.opacity).toBe('0');
  });
});
