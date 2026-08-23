// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { getVisitorId, isEphemeralVisitorId } from './visitorId';

/** localStorage 를 통째로 막는다 — 저장소 차단·정책·용량 초과에서 실제로 이렇게 던진다. */
function blockStorage() {
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
    throw new Error('storage blocked');
  });
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
    throw new Error('storage blocked');
  });
}

beforeEach(() => localStorage.clear());
afterEach(() => vi.restoreAllMocks());

describe('getVisitorId', () => {
  it('저장이 되면 같은 ID 를 계속 쓴다', () => {
    const first = getVisitorId();
    expect(getVisitorId()).toBe(first);
    expect(isEphemeralVisitorId(first)).toBe(false);
  });

  it('저장이 막히면 임시 ID 로 물러서되, 한 화면 안에서는 하나로 유지한다', () => {
    blockStorage();

    const a = getVisitorId();
    const b = getVisitorId();

    // 호출마다 새로 만들면 한 화면의 행동들이 서로 다른 사람의 것으로 흩어진다.
    expect(a).toBe(b);
    expect(isEphemeralVisitorId(a)).toBe(true);
  });

  it('임시 ID 는 사람 수 집계에서 골라낼 수 있다', () => {
    blockStorage();

    // 예전에는 여기서 문자열 'anon' 이 나왔다. 저장소가 막힌 사람이 전부 한 명으로 합쳐져
    // 고유 방문자는 줄고, 그 한 명은 모든 경로를 다녀간 초강력 재방문자가 됐다.
    expect(getVisitorId()).not.toBe('anon');
    expect(getVisitorId().startsWith('eph-')).toBe(true);
  });

  it('진짜 ID 는 임시로 오인되지 않는다', () => {
    expect(isEphemeralVisitorId(getVisitorId())).toBe(false);
  });
});
