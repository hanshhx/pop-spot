// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/authStorage', () => ({ getAuthToken: () => null }));
vi.mock('@/lib/visitorId', () => ({ getVisitorId: () => 'visitor-1' }));
vi.mock('@/lib/api', () => ({ API_BASE_URL: 'https://example.test' }));

import { DROPPED_KEY } from './beaconDrops';
import { trackVisitEvent } from './visitEvent';

/**
 * <b>고장이 성공처럼 보이지 않게 한다.</b>
 *
 * <p>{@code fetch} 는 500 에도 resolve 한다. {@code res.ok} 를 안 보면 백엔드가 죽어 있어도 이
 * 코드는 "보냈다" 로 여기고, 기록이 통째로 비는 구간이 아무 신호 없이 지나간다 —
 * 2026-08-13~19 이 정확히 그랬다. 그 구간을 나중에 보고 "유입이 줄었네" 하고 엉뚱한 곳을
 * 의심하게 된다.
 */

function lastBody(): Record<string, unknown> {
  const call = vi.mocked(globalThis.fetch).mock.calls.at(-1);
  return JSON.parse(String((call?.[1] as RequestInit).body));
}

beforeEach(() => {
  window.localStorage.clear();
  vi.restoreAllMocks();
});

describe('trackVisitEvent', () => {
  it('200 이면 잃은 것으로 세지 않는다', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }));

    trackVisitEvent('popup_open', { popupId: 1 });

    await vi.waitFor(() => expect(globalThis.fetch).toHaveBeenCalled());
    expect(window.localStorage.getItem(DROPPED_KEY)).toBeNull();
  });

  /* 이 검사가 이 파일의 존재 이유다. */
  it('500 이어도 성공으로 치지 않는다 — 잃은 것으로 센다', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500 }));

    trackVisitEvent('popup_open', { popupId: 1 });

    await vi.waitFor(() => expect(window.localStorage.getItem(DROPPED_KEY)).toBe('1'));
  });

  it('네트워크가 끊겨도 잃은 것으로 센다', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));

    trackVisitEvent('popup_open', { popupId: 1 });

    await vi.waitFor(() => expect(window.localStorage.getItem(DROPPED_KEY)).toBe('1'));
  });

  it('잃은 것이 없으면 dropped 를 안 붙인다 — 평상시 본문을 늘리지 않는다', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }));

    trackVisitEvent('popup_open', { popupId: 1 });

    await vi.waitFor(() => expect(globalThis.fetch).toHaveBeenCalled());
    expect(lastBody()).not.toHaveProperty('dropped');
  });

  /* 서버가 살아나는 첫 요청에 그동안의 손실이 따라 들어가야 한다. */
  it('잃은 것이 있으면 다음 성공 요청에 실어 보내고, 받아들여지면 비운다', async () => {
    window.localStorage.setItem(DROPPED_KEY, '4');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }));

    trackVisitEvent('popup_open', { popupId: 1 });

    await vi.waitFor(() => expect(globalThis.fetch).toHaveBeenCalled());
    expect(lastBody().dropped).toBe(4);
    await vi.waitFor(() => expect(window.localStorage.getItem(DROPPED_KEY)).toBeNull());
  });

  /* 보고까지 실패하면 그 보고분 하나가 더 얹혀야 한다 — 세어 둔 것을 잃으면 안 된다. */
  it('보고가 실패하면 손실이 더 쌓인다', async () => {
    window.localStorage.setItem(DROPPED_KEY, '4');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 503 }));

    trackVisitEvent('popup_open', { popupId: 1 });

    await vi.waitFor(() => expect(window.localStorage.getItem(DROPPED_KEY)).toBe('5'));
  });
});
