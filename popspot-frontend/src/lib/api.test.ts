// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest';

import { apiFetch, AUTH_EXPIRED_EVENT } from './api';

describe('apiFetch 인증 만료 처리', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
    sessionStorage.clear();
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
});
