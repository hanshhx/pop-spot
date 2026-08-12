// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  getServiceAvailability,
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
});
