import { afterEach, describe, expect, it, vi } from 'vitest';

import { GET, HEAD } from './route';

/**
 * <b>이 중계는 바이트 경계를 옮기는 일이다.</b> pmtiles 는 머리말이 가리키는 오프셋으로
 * 목차를 읽고, 목차가 가리키는 오프셋으로 타일을 읽는 형식이라, {@code Content-Range} 가
 * 한 바이트만 어긋나도 목차가 깨진다. 그래서 검사하는 것은 "원본이 준 경계를 그대로
 * 옮기는가" 하나다.
 *
 * <p>브라우저가 원본을 직접 못 받는 이유(GitHub 릴리스에 CORS 헤더가 없다)는 route.ts 주석 참고.
 */

const req = (headers: Record<string, string> = {}) =>
  new Request('https://popspot.co.kr/seoul.pmtiles', { headers });

function upstream(status: number, headers: Record<string, string> = {}) {
  return new Response(status === 204 ? null : 'BODY', { status, headers });
}

afterEach(() => vi.unstubAllGlobals());

describe('Range 를 원본까지 그대로 나른다', () => {
  it('요청의 Range 를 원본에 그대로 붙인다', async () => {
    const spy = vi.fn(async (_u: string, _i?: RequestInit) =>
      upstream(206, { 'content-range': 'bytes 0-99/58967083' }),
    );
    vi.stubGlobal('fetch', spy);

    await GET(req({ range: 'bytes=0-99' }));

    const init = spy.mock.calls[0][1] as RequestInit;
    expect((init.headers as Record<string, string>).Range).toBe('bytes=0-99');
  });

  it('원본의 Content-Range 를 다시 계산하지 않고 옮긴다', async () => {
    vi.stubGlobal('fetch', async () =>
      upstream(206, { 'content-range': 'bytes 16384-32767/58967083', 'content-length': '16384' }),
    );

    const res = await GET(req({ range: 'bytes=16384-32767' }));

    expect(res.status).toBe(206);
    expect(res.headers.get('content-range')).toBe('bytes 16384-32767/58967083');
    expect(res.headers.get('content-length')).toBe('16384');
    expect(res.headers.get('accept-ranges')).toBe('bytes');
  });

  it('Range 가 없어도 막지 않는다 — 이 주소가 이제 정본이라 거부하면 지도가 안 뜬다', async () => {
    const spy = vi.fn(async (_u: string, _i?: RequestInit) =>
      upstream(200, { 'content-length': '58967083' }),
    );
    vi.stubGlobal('fetch', spy);

    const res = await GET(req());

    expect(res.status).toBe(200);
    const init = spy.mock.calls[0][1] as RequestInit;
    expect((init.headers as Record<string, string>).Range).toBeUndefined();
  });
});

describe('캐시 — 엣지가 받아 두면 원본 왕복도 Worker 호출도 준다', () => {
  it('1년 불변으로 내보낸다', async () => {
    vi.stubGlobal('fetch', async () => upstream(206, { 'content-range': 'bytes 0-9/100' }));
    const res = await GET(req({ range: 'bytes=0-9' }));
    expect(res.headers.get('cache-control')).toBe('public, max-age=31536000, immutable');
  });

  it('원본이 죽었을 때는 캐시하지 않는다 — 장애를 1년 동안 들고 있으면 안 된다', async () => {
    vi.stubGlobal('fetch', async () => upstream(500));
    const res = await GET(req({ range: 'bytes=0-9' }));
    expect(res.headers.get('cache-control')).toBe('no-store');
  });
});

describe('원본이 실패하면 조용히 비우지 않는다', () => {
  it('404 는 502 로 바꾼다 — 우리 주소는 있는데 원본이 사라진 상황이다', async () => {
    vi.stubGlobal('fetch', async () => upstream(404));
    expect((await GET(req({ range: 'bytes=0-9' }))).status).toBe(502);
  });

  it('그 밖의 실패는 상태를 그대로 넘겨 화면이 알아채게 둔다', async () => {
    vi.stubGlobal('fetch', async () => upstream(503));
    expect((await GET(req({ range: 'bytes=0-9' }))).status).toBe(503);
  });
});

describe('HEAD — 본문 없이 같은 헤더', () => {
  it('앱이 크기를 먼저 물어볼 때를 위해 받는다', async () => {
    vi.stubGlobal('fetch', async () =>
      upstream(206, { 'content-range': 'bytes 0-0/58967083', 'content-length': '1' }),
    );

    const res = await HEAD(req({ range: 'bytes=0-0' }));

    expect(res.status).toBe(206);
    expect(res.headers.get('content-range')).toBe('bytes 0-0/58967083');
    expect(await res.text()).toBe('');
  });
});
