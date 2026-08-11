// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest';

import { loadMapMarkers, resetMapMarkerCacheForTest } from './mapMarkers';

const rows = [
  {
    id: 1,
    name: '테스트 팝업',
    location: '서울 성동구',
    latitude: '37.54',
    longitude: '127.05',
    category: 'CHARACTER',
    startDate: '2026-08-01',
    endDate: '2026-08-31',
  },
];

describe('loadMapMarkers', () => {
  afterEach(() => {
    resetMapMarkerCacheForTest();
    vi.restoreAllMocks();
  });

  it('동시에 부른 지도와 BROWSE가 요청 하나를 공유한다', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(Response.json(rows));

    const [forMap, forBrowse] = await Promise.all([loadMapMarkers(), loadMapMarkers()]);

    expect(fetchMock).toHaveBeenCalledOnce();
    expect(forMap).toEqual(rows);
    expect(forBrowse).toBe(forMap);
  });

  it('같은 탭의 다음 호출은 저장된 결과를 즉시 돌려준다', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(Response.json(rows));

    await loadMapMarkers();
    await loadMapMarkers();

    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it('오류 본문이나 다른 모양의 JSON을 핀 데이터로 받아들이지 않는다', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(Response.json({ error: 'bad gateway' }));

    await expect(loadMapMarkers()).rejects.toThrow('invalid response');
  });

  it('최신 요청이 실패하면 만료된 세션 캐시라도 빈 지도 대신 사용한다', async () => {
    sessionStorage.setItem(
      'popspot:map-markers:v1',
      JSON.stringify({ savedAt: Date.now() - 10 * 60 * 1000, markers: rows }),
    );
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('', { status: 500 }));

    await expect(loadMapMarkers()).resolves.toEqual(rows);
  });

  it('브라우저 저장소가 차단돼도 네트워크 목록으로 지도를 채운다', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('storage blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('storage blocked');
    });
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(Response.json(rows));

    await expect(loadMapMarkers()).resolves.toEqual(rows);
    expect(fetchMock).toHaveBeenCalledOnce();
  });
});
