import { afterEach, describe, expect, it, vi } from 'vitest';

import { GET, resetServiceHealthCacheForTest } from './route';

describe('GET /service-health', () => {
  afterEach(() => {
    // 대표 id 기억이 다음 시험으로 새면 호출 순서가 달라져 조용히 통과한다.
    resetServiceHealthCacheForTest();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('백엔드 health가 UP일 때만 복구된 것으로 판단한다', async () => {
    vi.stubEnv('NEXT_PUBLIC_API_URL', 'https://backend.example.com');
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(Response.json({ status: 'UP' }))
      .mockResolvedValueOnce(Response.json([{ id: 1890, name: '대표 팝업' }]))
      .mockResolvedValueOnce(Response.json({ id: 1890, name: '대표 팝업' }));

    const response = await GET();

    await expect(response.json()).resolves.toEqual({ available: true });
    expect(response.headers.get('Cache-Control')).toBe('no-store, max-age=0');
    expect(fetchMock).toHaveBeenCalledWith(
      'https://backend.example.com/actuator/health',
      expect.objectContaining({ cache: 'no-store' }),
    );
    expect(fetchMock).toHaveBeenCalledWith(
      'https://backend.example.com/api/popups/1890',
      expect.objectContaining({ cache: 'no-store' }),
    );
  });

  it('프로세스가 UP이어도 실제 목록이나 상세가 실패하면 복구로 판단하지 않는다', async () => {
    vi.stubEnv('NEXT_PUBLIC_API_URL', 'https://backend.example.com');
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(Response.json({ status: 'UP' }))
      .mockResolvedValueOnce(new Response('', { status: 502 }))
      .mockResolvedValueOnce(Response.json({ id: 1890, name: '대표 팝업' }));

    const response = await GET();

    await expect(response.json()).resolves.toEqual({ available: false });
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

  it('대표를 한 번 고른 뒤에는 목록을 다시 받지 않는다', async () => {
    // 목록 응답은 341KB 고 상세는 133바이트다. 탭마다 60초에 한 번 도는 확인이라,
    // 매번 목록을 받으면 확인이 스스로 만든 부하로 제한시간에 걸린다(2026-08-21 실측 실패율 50%).
    vi.stubEnv('NEXT_PUBLIC_API_URL', 'https://backend.example.com');
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      // 1회차 — health · markers · detail
      .mockResolvedValueOnce(Response.json({ status: 'UP' }))
      .mockResolvedValueOnce(Response.json([{ id: 1890, name: '대표 팝업' }]))
      .mockResolvedValueOnce(Response.json({ id: 1890, name: '대표 팝업' }))
      // 2회차 — health · detail 만 부르면 통과한다
      .mockResolvedValueOnce(Response.json({ status: 'UP' }))
      .mockResolvedValueOnce(Response.json({ id: 1890, name: '대표 팝업' }));

    await expect((await GET()).json()).resolves.toEqual({ available: true });
    await expect((await GET()).json()).resolves.toEqual({ available: true });

    const markerCalls = fetchMock.mock.calls.filter((call) =>
      String(call[0]).includes('/api/map/markers'),
    );
    expect(markerCalls).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledTimes(5);
  });

  it('기억해 둔 팝업이 사라지면 기억을 비워 다음에 다시 고른다', async () => {
    vi.stubEnv('NEXT_PUBLIC_API_URL', 'https://backend.example.com');
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      // 1회차 — 대표를 고르고 성공
      .mockResolvedValueOnce(Response.json({ status: 'UP' }))
      .mockResolvedValueOnce(Response.json([{ id: 1890, name: '대표 팝업' }]))
      .mockResolvedValueOnce(Response.json({ id: 1890, name: '대표 팝업' }))
      // 2회차 — 그 팝업이 404. 이번 확인은 실패하고 기억을 비운다
      .mockResolvedValueOnce(Response.json({ status: 'UP' }))
      .mockResolvedValueOnce(new Response('', { status: 404 }))
      // 3회차 — 기억이 비었으므로 목록을 다시 받아 새 대표를 고른다
      .mockResolvedValueOnce(Response.json({ status: 'UP' }))
      .mockResolvedValueOnce(Response.json([{ id: 2024, name: '다른 팝업' }]))
      .mockResolvedValueOnce(Response.json({ id: 2024, name: '다른 팝업' }));

    await expect((await GET()).json()).resolves.toEqual({ available: true });
    await expect((await GET()).json()).resolves.toEqual({ available: false });
    await expect((await GET()).json()).resolves.toEqual({ available: true });

    const markerCalls = fetchMock.mock.calls.filter((call) =>
      String(call[0]).includes('/api/map/markers'),
    );
    expect(markerCalls).toHaveLength(2);
    expect(fetchMock).toHaveBeenCalledWith(
      'https://backend.example.com/api/popups/2024',
      expect.objectContaining({ cache: 'no-store' }),
    );
  });
});
