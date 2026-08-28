// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest';

import { apiFetch, AUTH_EXPIRED_EVENT, shouldUseDirectBackend } from './api';
import {
  getServiceAvailability,
  resetServiceAvailabilityForTest,
  setServiceAvailability,
} from './serviceAvailability';

describe('apiFetch 인증 만료 처리', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
    sessionStorage.clear();
    resetServiceAvailabilityForTest();
  });

  it('토큰이 있는 요청의 401에서 캐시를 지우고 만료 이벤트를 한 번 보낸다', async () => {
    sessionStorage.setItem('token', 'expired-token');
    localStorage.setItem('user', JSON.stringify({ userId: 'user-1' }));
    const expired = vi.fn();
    window.addEventListener(AUTH_EXPIRED_EVENT, expired, { once: true });
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response('{"message":"expired"}', { status: 401 }));

    await apiFetch('/api/protected');

    expect(fetchMock).toHaveBeenCalledOnce();
    const [, options] = fetchMock.mock.calls[0];
    expect((options?.headers as Record<string, string>).Authorization).toBe('Bearer expired-token');
    expect(sessionStorage.getItem('token')).toBeNull();
    expect(localStorage.getItem('user')).toBeNull();
    expect(expired).toHaveBeenCalledOnce();
  });

  it('권한 부족을 뜻하는 403에서는 로그인 상태를 지우지 않는다', async () => {
    sessionStorage.setItem('token', 'valid-token');
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('{"message":"forbidden"}', { status: 403 }),
    );

    await apiFetch('/api/mates/1/chat');

    expect(sessionStorage.getItem('token')).toBe('valid-token');
  });

  it('서버 장애가 확인된 동안은 실제 API를 다시 호출하지 않는다', async () => {
    sessionStorage.setItem('token', 'still-valid-token');
    setServiceAvailability('unavailable');
    const fetchMock = vi.spyOn(globalThis, 'fetch');

    const response = await apiFetch('/api/wishlist/user-1');

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({ error: 'Service Unavailable' });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(sessionStorage.getItem('token')).toBe('still-valid-token');
  });

  it('게이트웨이 장애 응답을 받으면 공유 상태를 장애로 바꾼다', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 502 }));

    const response = await apiFetch('/api/protected', { method: 'POST' });

    expect(response.status).toBe(502);
    expect(getServiceAvailability()).toBe('unavailable');
  });

  it('일반 500 응답이 health의 장애 판정을 정상으로 덮지 않는다', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 500 }));

    const response = await apiFetch('/api/failing-feature', { method: 'POST' });

    expect(response.status).toBe(500);
    expect(getServiceAvailability()).toBe('checking');
  });
});

describe('배달되지 않은 502의 재시도', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    sessionStorage.clear();
    resetServiceAvailabilityForTest();
  });

  /** Vercel 엣지가 호스트명을 못 풀었을 때 실제로 오는 응답. */
  const dnsFailure = () =>
    new Response(null, { status: 502, headers: { 'x-vercel-error': 'DNS_HOSTNAME_EMPTY' } });

  it('POST라도 백엔드에 닿지 못한 502면 다시 보내고, 붙으면 성공으로 끝난다', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(dnsFailure())
      .mockResolvedValueOnce(new Response('{"ok":true}', { status: 200 }));

    const response = await apiFetch('/api/v1/auth/login/totp', { method: 'POST' });

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(getServiceAvailability()).toBe('available');
  });

  /**
   * 이게 이 기능의 <b>경계</b>다. 헤더가 없는 502 는 서버가 이미 처리했을 수 있다 — 로그인을
   * 두 번 보내면 세션이, 제보를 두 번 보내면 글이 두 개 생긴다. 증명될 때만 넓어져야 한다.
   */
  it('까닭을 알 수 없는 502에서는 POST를 다시 보내지 않는다', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(null, { status: 502 }));

    const response = await apiFetch('/api/v1/reports', { method: 'POST' });

    expect(response.status).toBe(502);
    expect(fetchMock).toHaveBeenCalledOnce();
  });
});

describe('운영 출처에서 백엔드 직행', () => {
  it('운영 도메인에서는 직행한다', () => {
    expect(shouldUseDirectBackend('popspot.co.kr', undefined)).toBe(true);
  });

  /**
   * 백엔드 app.allowed-origins 가 허용하는 출처에서만 직행해야 한다. 프리뷰 배포와 로컬은
   * 허용 목록에 없어서, 직행하면 CORS 로 전부 막힌다 — 리라이트보다 나쁜 상태가 된다.
   */
  it('프리뷰·로컬에서는 직행하지 않는다', () => {
    expect(shouldUseDirectBackend('popspot-git-main.vercel.app', undefined)).toBe(false);
    expect(shouldUseDirectBackend('localhost', undefined)).toBe(false);
    expect(shouldUseDirectBackend('www.popspot.co.kr', undefined)).toBe(false);
  });

  /** 되돌리는 길. 코드 수정 없이 Vercel 환경변수만으로 예전 동작으로 돌아갈 수 있어야 한다. */
  it('NEXT_PUBLIC_API_DIRECT=0 이면 운영 도메인에서도 직행하지 않는다', () => {
    expect(shouldUseDirectBackend('popspot.co.kr', '0')).toBe(false);
  });
});
