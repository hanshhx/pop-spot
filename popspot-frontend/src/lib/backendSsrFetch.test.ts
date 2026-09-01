import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  errorCode,
  fetchBackend,
  resetBackendBuildState,
  shouldRetryViaDoh,
} from './backendSsrFetch';

/**
 * 이 판정이 느슨하면 <b>고칠 수 없는 실패</b>에도 우회로를 태워 서버 렌더가 두 배로 기다린다.
 * 빡빡하면 정작 이름 해석 장애 때 우회로가 안 돌아, 크롤러가 2026-08-11 스냅샷을 받아 간다.
 */

describe('errorCode', () => {
  /* fetch(undici) 는 한 겹 안쪽에 담는다. 이게 실제로 우리가 만나는 모양이다. */
  it('fetch 의 cause.code 를 읽는다', () => {
    expect(
      errorCode(Object.assign(new Error('fetch failed'), { cause: { code: 'ENOTFOUND' } })),
    ).toBe('ENOTFOUND');
  });

  it('node:https 의 code 도 읽는다', () => {
    expect(errorCode(Object.assign(new Error('x'), { code: 'ECONNREFUSED' }))).toBe('ECONNREFUSED');
  });

  /* 둘 다 있으면 안쪽이 진짜 원인이다 — 바깥은 "fetch failed" 같은 껍데기다. */
  it('둘 다 있으면 안쪽을 쓴다', () => {
    const e = Object.assign(new Error('x'), { code: 'OUTER', cause: { code: 'ENOTFOUND' } });
    expect(errorCode(e)).toBe('ENOTFOUND');
  });

  it('코드가 없으면 undefined', () => {
    expect(errorCode(new Error('그냥 오류'))).toBeUndefined();
    expect(errorCode(null)).toBeUndefined();
    expect(errorCode('문자열')).toBeUndefined();
  });
});

describe('shouldRetryViaDoh', () => {
  it.each(['ENOTFOUND', 'EAI_AGAIN', 'ECONNREFUSED', 'UND_ERR_CONNECT_TIMEOUT'])(
    '%s 은 이름 해석 문제라 우회로를 쓴다',
    (code) => {
      expect(shouldRetryViaDoh(Object.assign(new Error('x'), { cause: { code } }))).toBe(true);
    },
  );

  /*
   * 아래는 이름을 이미 푼 뒤에 난 실패다. 우회로가 도울 것이 없고, 한 번 더 기다리기만 한다.
   * 특히 시간 초과는 백엔드가 느린 것이지 못 찾은 것이 아니다.
   */
  it.each(['ECONNRESET', 'ETIMEDOUT', 'EPIPE', 'ABORT_ERR', 'CERT_HAS_EXPIRED'])(
    '%s 은 우회로를 쓰지 않는다',
    (code) => {
      expect(shouldRetryViaDoh(Object.assign(new Error('x'), { cause: { code } }))).toBe(false);
    },
  );

  it('코드 없는 오류는 우회로를 쓰지 않는다', () => {
    expect(shouldRetryViaDoh(new Error('그냥 오류'))).toBe(false);
    expect(shouldRetryViaDoh(undefined)).toBe(false);
  });
});

/**
 * 2026-09-01 배포가 통째로 실패했다. 백엔드가 있는 기계가 죽자 SEO 페이지 887개가 <b>각자</b>
 * 백엔드를 부르며 매번 10초 넘게 기다렸고, 페이지당 60초 제한을 넘겨 빌드가 죽었다.
 *
 * <p>성공은 Next 가 캐시하지만 <b>실패는 아무도 기억하지 않아서</b> 887번을 되풀이한다.
 * 그래서 시간을 줄이는 것만으로는 부족하고, 실패를 기억해야 한다.
 */
describe('빌드는 백엔드를 기다리지 않는다', () => {
  const URL_UNDER_TEST = 'https://backend.example.com/api/map/markers';

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    resetBackendBuildState();
  });

  /** 연결이 끊기는 실패. 우회로 대상이 아니라 한 번에 끝난다(오늘 실제로 본 모양이다). */
  function alwaysFails() {
    const spy = vi.fn(async () => {
      throw Object.assign(new Error('fetch failed'), { cause: { code: 'ECONNRESET' } });
    });
    vi.stubGlobal('fetch', spy);
    return spy;
  }

  const failOnce = async () => {
    await expect(fetchBackend(URL_UNDER_TEST, 60)).rejects.toThrow();
  };

  it('세 번 연속 실패하면 그 뒤로는 두드리지 않는다', async () => {
    vi.stubEnv('NEXT_PHASE', 'phase-production-build');
    const spy = alwaysFails();

    for (let i = 0; i < 3; i++) await failOnce();
    expect(spy).toHaveBeenCalledTimes(3);

    /* 뒤따라오는 페이지 수백 개. 하나도 백엔드로 나가면 안 된다. */
    for (let i = 0; i < 50; i++) await failOnce();
    expect(spy).toHaveBeenCalledTimes(3);
  });

  /*
   * 운영에서는 포기하면 안 된다. 한 번 끊겼다고 그 함수가 사는 동안 백엔드를 버리면,
   * 백엔드가 돌아와도 그 인스턴스는 계속 스냅샷을 내보낸다.
   */
  it('운영에서는 몇 번을 실패해도 계속 시도한다', async () => {
    const spy = alwaysFails();

    for (let i = 0; i < 10; i++) await failOnce();

    expect(spy).toHaveBeenCalledTimes(10);
  });

  /* 순간적인 딸꾹질 하나로 SEO 페이지 전체가 스냅샷이 되면 손해가 크다. */
  it('중간에 한 번이라도 되면 다시 센다', async () => {
    vi.stubEnv('NEXT_PHASE', 'phase-production-build');
    let ok = false;
    const spy = vi.fn(async () => {
      if (ok) return new Response('[]', { status: 200 });
      throw Object.assign(new Error('fetch failed'), { cause: { code: 'ECONNRESET' } });
    });
    vi.stubGlobal('fetch', spy);

    await failOnce();
    await failOnce();
    ok = true;
    await expect(fetchBackend(URL_UNDER_TEST, 60)).resolves.toBeInstanceOf(Response);
    ok = false;

    /* 여기서 포기했다면 아래 세 번이 백엔드로 안 나간다. */
    for (let i = 0; i < 3; i++) await failOnce();

    expect(spy).toHaveBeenCalledTimes(6);
  });

  /*
   * 운영에는 시간을 못 박지 않는다. 여기서 더 짧게 끊으면 백엔드가 느리기만 한 순간에도
   * 방문자에게 저장된 자료를 보여주게 된다.
   */
  it('시간 제한은 빌드에만 건다', async () => {
    const seen: (RequestInit | undefined)[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init?: RequestInit) => {
        seen.push(init);
        return new Response('[]', { status: 200 });
      }),
    );

    await fetchBackend(URL_UNDER_TEST, 60);
    expect(seen[0]?.signal).toBeUndefined();

    vi.stubEnv('NEXT_PHASE', 'phase-production-build');
    await fetchBackend(URL_UNDER_TEST, 60);
    expect(seen[1]?.signal).toBeInstanceOf(AbortSignal);
  });
});
