import { describe, expect, it } from 'vitest';

import {
  FALLBACK_CLUSTER_MIN,
  fallbackCoordKeys,
  hasRealMapLocation,
  type Located,
} from './fallbackCoords';

const at = (lat: string, lng: string): Located => ({ latitude: lat, longitude: lng });
const many = (n: number, lat: string, lng: string) => Array.from({ length: n }, () => at(lat, lng));

describe('fallbackCoordKeys', () => {
  it('문턱을 넘긴 좌표만 가짜로 본다', () => {
    const keys = fallbackCoordKeys([
      ...many(FALLBACK_CLUSTER_MIN + 1, '37.5', '127.0'),
      ...many(FALLBACK_CLUSTER_MIN, '37.6', '127.1'),
    ]);
    expect(keys.has('37.5,127.0')).toBe(true);
    // 정확히 문턱이면 아직 가짜가 아니다 — 초과(>)여야 한다.
    expect(keys.has('37.6,127.1')).toBe(false);
  });

  it('같은 건물에서 열리는 정상적인 겹침은 남긴다', () => {
    // 더현대 서울처럼 한 건물에 여러 팝업이 서는 경우. 수십 곳을 넘지 않는다.
    expect(fallbackCoordKeys(many(12, '37.52', '126.92')).size).toBe(0);
  });

  it('좌표가 없는 행은 세지 않는다', () => {
    const keys = fallbackCoordKeys([
      ...Array.from({ length: 100 }, () => ({ latitude: null, longitude: null })),
      ...many(3, '37.5', '127.0'),
    ]);
    expect(keys.size).toBe(0);
  });

  it('좌표를 반올림하지 않는다 — 소수 자리가 다르면 다른 곳이다', () => {
    const keys = fallbackCoordKeys([
      ...many(30, '37.5000', '127.0000'),
      ...many(30, '37.5001', '127.0000'),
    ]);
    expect(keys.size).toBe(0);
  });
});

describe('hasRealMapLocation', () => {
  const none = new Set<string>();

  it('숫자로 읽히는 좌표는 통과', () => {
    expect(hasRealMapLocation(at('37.5443', '127.0557'), none)).toBe(true);
  });

  it('빈 문자열·공백은 0 이 아니라 탈락', () => {
    // Number(' ') === 0 이라 (0,0) 서아프리카 앞바다에 찍히던 자리.
    expect(hasRealMapLocation(at('', ''), none)).toBe(false);
    expect(hasRealMapLocation(at(' ', ' '), none)).toBe(false);
  });

  it('null·undefined 는 탈락', () => {
    expect(hasRealMapLocation({ latitude: null, longitude: null }, none)).toBe(false);
    expect(hasRealMapLocation({}, none)).toBe(false);
  });

  it('가짜 위치로 판정된 좌표는 좌표가 멀쩡해도 탈락', () => {
    const fallback = new Set(['37.5,127.0']);
    expect(hasRealMapLocation(at('37.5', '127.0'), fallback)).toBe(false);
    expect(hasRealMapLocation(at('37.5', '127.1'), fallback)).toBe(true);
  });
});
