// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/authStorage', () => ({ getAuthToken: () => null }));
vi.mock('@/lib/visitorId', () => ({ getVisitorId: () => 'visitor-1' }));
vi.mock('@/lib/api', () => ({ apiUrl: (endpoint: string) => `/proxied${endpoint}` }));

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

/**
 * {@code fetch} 의 then/catch 가 돌 틈을 준다.
 *
 * <p>{@code vi.waitFor(fetch 가 불렸는가)} 는 <b>호출된 순간</b> 통과하므로, 그 뒤에 바로
 * "계수기가 비어 있다" 를 보면 아직 핸들러가 안 돌아서 통과해 버린다 — 없는 것을 확인하는
 * 검사는 "아직 안 일어났다" 와 "일어나지 않는다" 를 구별하지 못한다.
 */
async function settle(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 50));
}

beforeEach(() => {
  window.localStorage.clear();
  vi.restoreAllMocks();
});

describe('trackVisitEvent', () => {
  /*
   * 이 검사가 가장 값비싼 고장을 막는다. 예전에는 주소를 백엔드 기본 주소에 직접 이어 붙였는데,
   * 운영에서 그 값이 Tailscale 호스트라 tailnet 밖의 방문자에게는 언제나 실패했다 — 행동
   * 이벤트가 몇 주째 한 건도 안 들어오고 있었고 아무 신호도 없었다.
   */
  it('주소를 직접 만들지 않고 apiUrl 이 정한 곳으로 보낸다', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }));

    trackVisitEvent('popup_open', { popupId: 1 });

    await vi.waitFor(() => expect(globalThis.fetch).toHaveBeenCalled());
    expect(vi.mocked(globalThis.fetch).mock.calls[0][0]).toBe('/proxied/api/visits/events');
  });

  it('200 이면 잃은 것으로 세지 않는다', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }));

    trackVisitEvent('popup_open', { popupId: 1 });

    await vi.waitFor(() => expect(globalThis.fetch).toHaveBeenCalled());
    await settle();
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
    await settle();
    expect(lastBody()).not.toHaveProperty('dropped');
    expect(window.localStorage.getItem(DROPPED_KEY)).toBeNull();
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

  /*
   * 배포 직후 운영에서 바로 나온 오탐이다 — 응답은 204 인데 네트워크 기록은 net::ERR_ABORTED.
   * keepalive 요청은 문서가 사라져도 전송이 끝나므로, 이걸 손실로 세면 카드를 눌러 상세로
   * 넘어갈 때마다 유실이 하나씩 쌓인다.
   */
  it('페이지 이동으로 끊긴 것은 손실로 세지 않는다', async () => {
    const abort = Object.assign(new Error('aborted'), { name: 'AbortError' });
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(abort));

    trackVisitEvent('popup_open', { popupId: 1 });

    await vi.waitFor(() => expect(globalThis.fetch).toHaveBeenCalled());
    await settle();
    expect(window.localStorage.getItem(DROPPED_KEY)).toBeNull();
  });

  /* 보고까지 실패하면 그 보고분 하나가 더 얹혀야 한다 — 세어 둔 것을 잃으면 안 된다. */
  it('보고가 실패하면 손실이 더 쌓인다', async () => {
    window.localStorage.setItem(DROPPED_KEY, '4');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 503 }));

    trackVisitEvent('popup_open', { popupId: 1 });

    await vi.waitFor(() => expect(window.localStorage.getItem(DROPPED_KEY)).toBe('5'));
  });
});
