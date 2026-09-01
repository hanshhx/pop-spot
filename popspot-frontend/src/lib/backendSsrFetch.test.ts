import { describe, expect, it } from 'vitest';

import { errorCode, shouldRetryViaDoh } from './backendSsrFetch';

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
