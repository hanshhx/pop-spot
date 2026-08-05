import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { fetchHomePopups } from './homeData';

/**
 * 서버 목록 가져오기의 <b>실패 방식</b>을 못박는다.
 *
 * <p>이 함수는 홈의 첫 화면을 채우는 자리라, 잘 되는 것보다 <b>안 될 때 어떻게 되는지</b>가 중요하다.
 * 여기서 예외가 새면 백엔드가 죽은 날 홈이 통째로 500 이 된다 — 예전에는 클라이언트에서 받아와서
 * 화면이 비기만 했는데, 서버로 옮기면서 오히려 더 나빠지는 것이다.
 *
 * <p>2026-08-05 에 실제로 백엔드가 502 로 내려간 상태에서 이 코드를 넣었기 때문에, 그 상황이
 * 정확히 이 테스트의 첫 항목이다.
 */
describe('fetchHomePopups', () => {
  const ORIGINAL = process.env.NEXT_PUBLIC_API_URL;

  beforeEach(() => {
    process.env.NEXT_PUBLIC_API_URL = 'https://backend.example';
  });

  afterEach(() => {
    process.env.NEXT_PUBLIC_API_URL = ORIGINAL;
    vi.unstubAllGlobals();
  });

  it('백엔드가 502 면 빈 배열 — 홈을 500 으로 만들지 않는다', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('', { status: 502 })),
    );
    await expect(fetchHomePopups()).resolves.toEqual([]);
  });

  it('네트워크가 끊겨도 예외를 밖으로 던지지 않는다', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('ECONNREFUSED');
      }),
    );
    await expect(fetchHomePopups()).resolves.toEqual([]);
  });

  it('응답이 배열이 아니면 빈 배열 — 모양이 바뀌어도 화면이 터지지 않는다', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Response.json({ error: 'nope' })),
    );
    await expect(fetchHomePopups()).resolves.toEqual([]);
  });

  it('API 주소가 없거나 형식이 틀리면 아예 요청하지 않는다', async () => {
    const spy = vi.fn();
    vi.stubGlobal('fetch', spy);

    process.env.NEXT_PUBLIC_API_URL = '';
    await expect(fetchHomePopups()).resolves.toEqual([]);

    process.env.NEXT_PUBLIC_API_URL = 'vm-113.tailc57dd4.ts.net'; // 스킴 없음
    await expect(fetchHomePopups()).resolves.toEqual([]);

    expect(spy).not.toHaveBeenCalled();
  });

  it('정상 응답이면 목록을 그대로 돌려준다', async () => {
    const rows = [{ popupId: 1, name: '테스트 팝업' }];
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Response.json(rows)),
    );
    await expect(fetchHomePopups()).resolves.toEqual(rows);
  });

  it('캐시 재검증 주기를 함께 넘긴다 — 이게 빠지면 백엔드가 죽었을 때 버텨 주지 못한다', async () => {
    const spy = vi.fn(async () => Response.json([]));
    vi.stubGlobal('fetch', spy);

    await fetchHomePopups();

    const [, init] = spy.mock.calls[0] as unknown as [string, { next?: { revalidate?: number } }];
    expect(init?.next?.revalidate).toBeGreaterThan(0);
  });
});
