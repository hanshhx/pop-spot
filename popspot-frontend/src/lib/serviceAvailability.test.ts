// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  availabilityAfterFailure,
  getServiceAvailability,
  shouldRunHealthCheck,
  resetServiceAvailabilityForTest,
  serviceUnavailableResponse,
  setServiceAvailability,
  subscribeServiceAvailability,
  UNAVAILABLE_TTL_MS_FOR_TEST,
} from './serviceAvailability';

describe('serviceAvailability', () => {
  afterEach(() => resetServiceAvailabilityForTest());

  it('상태가 실제로 바뀔 때만 구독자에게 알린다', () => {
    const listener = vi.fn();
    const unsubscribe = subscribeServiceAvailability(listener);

    setServiceAvailability('unavailable');
    setServiceAvailability('unavailable');

    expect(getServiceAvailability()).toBe('unavailable');
    expect(listener).toHaveBeenCalledOnce();
    unsubscribe();
  });

  it('차단된 요청에도 호출부가 읽을 수 있는 JSON 503을 돌려준다', async () => {
    const response = serviceUnavailableResponse();

    expect(response.status).toBe(503);
    expect(response.headers.get('Retry-After')).toBe('15');
    await expect(response.json()).resolves.toMatchObject({ error: 'Service Unavailable' });
  });

  it('기본은 꺼짐이다 — 값을 안 주면 상태 확인을 돌리지 않는다', () => {
    vi.stubEnv('NEXT_PUBLIC_SERVICE_HEALTH_ENABLED', '');
    expect(shouldRunHealthCheck()).toBe(false);
  });

  it("'true' 일 때만 켜진다", () => {
    vi.stubEnv('NEXT_PUBLIC_SERVICE_HEALTH_ENABLED', 'true');
    expect(shouldRunHealthCheck()).toBe(true);
    // 오타나 다른 값으로 조용히 켜지지 않는다.
    vi.stubEnv('NEXT_PUBLIC_SERVICE_HEALTH_ENABLED', '1');
    expect(shouldRunHealthCheck()).toBe(false);
    vi.stubEnv('NEXT_PUBLIC_SERVICE_HEALTH_ENABLED', 'TRUE');
    expect(shouldRunHealthCheck()).toBe(false);
  });

  it('두 번까지의 실패로는 장애를 선언하지 않는다', () => {
    expect(availabilityAfterFailure(1)).toBeNull();
    expect(availabilityAfterFailure(2)).toBeNull();
  });

  it('연속 세 번 실패하면 장애로 선언한다', () => {
    expect(availabilityAfterFailure(3)).toBe('unavailable');
    expect(availabilityAfterFailure(4)).toBe('unavailable');
  });
});

describe('장애 판정은 스스로 풀린다', () => {
  afterEach(() => {
    vi.useRealTimers();
    resetServiceAvailabilityForTest();
  });

  /**
   * 이 테스트가 막는 것은 <b>닫힌 고리</b>다.
   *
   * apiFetch 는 unavailable 인 동안 요청을 아예 안 보내는데, 판정을 푸는 유일한 코드가
   * "응답이 500 미만이면 available" 이다. 즉 스스로 풀릴 방법이 없어서, 한 번 걸리면 그 탭은
   * 새로고침 전까지 아무것도 못 한다 — 서버가 멀쩡해져도 그렇다. 관리자 화면처럼 요청을 한꺼번에
   * 보내는 곳이 제일 먼저 통째로 잠겼다.
   */
  it('unavailable 은 유효기간이 지나면 checking 으로 돌아간다', () => {
    vi.useFakeTimers();
    setServiceAvailability('unavailable');
    expect(getServiceAvailability()).toBe('unavailable');

    vi.advanceTimersByTime(UNAVAILABLE_TTL_MS_FOR_TEST + 1);

    expect(getServiceAvailability()).toBe('checking');
  });

  /** 푸는 것이 목적이지 잊는 것이 목적은 아니다 — 유효기간 안에는 그대로 잠겨 있어야 한다. */
  it('유효기간 안에는 잠긴 채로 있는다', () => {
    vi.useFakeTimers();
    setServiceAvailability('unavailable');

    vi.advanceTimersByTime(UNAVAILABLE_TTL_MS_FOR_TEST - 1);

    expect(getServiceAvailability()).toBe('unavailable');
  });

  /** 정상 복구가 먼저 오면 타이머가 남아 방금 살아난 상태를 다시 checking 으로 되돌리면 안 된다. */
  it('먼저 available 이 되면 유효기간 타이머는 그것을 덮지 않는다', () => {
    vi.useFakeTimers();
    setServiceAvailability('unavailable');
    setServiceAvailability('available');

    vi.advanceTimersByTime(UNAVAILABLE_TTL_MS_FOR_TEST + 1);

    expect(getServiceAvailability()).toBe('available');
  });
});
