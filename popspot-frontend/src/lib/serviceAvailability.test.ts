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
