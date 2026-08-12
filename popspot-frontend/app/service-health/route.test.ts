import { afterEach, describe, expect, it, vi } from 'vitest';

import { GET } from './route';

describe('GET /service-health', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('백엔드 health가 UP일 때만 복구된 것으로 판단한다', async () => {
    vi.stubEnv('NEXT_PUBLIC_API_URL', 'https://backend.example.com');
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(Response.json({ status: 'UP' }));

    const response = await GET();

    await expect(response.json()).resolves.toEqual({ available: true });
    expect(response.headers.get('Cache-Control')).toBe('no-store, max-age=0');
    expect(fetchMock).toHaveBeenCalledWith(
      'https://backend.example.com/actuator/health',
      expect.objectContaining({ cache: 'no-store' }),
    );
  });

  it('프록시 200이어도 health 본문이 UP이 아니면 장애를 유지한다', async () => {
    vi.stubEnv('NEXT_PUBLIC_API_URL', 'https://backend.example.com');
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('<html>proxy page</html>'));

    const response = await GET();

    await expect(response.json()).resolves.toEqual({ available: false });
  });

  it('백엔드가 응답하지 않아도 내부 주소를 노출하지 않고 200 상태 JSON을 반환한다', async () => {
    vi.stubEnv('NEXT_PUBLIC_API_URL', 'https://private-backend.example.com');
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('connection refused'));

    const response = await GET();

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ available: false });
  });
});
