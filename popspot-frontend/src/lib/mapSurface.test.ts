import { describe, expect, it } from 'vitest';

import { hasUsableCoordinates, mapSurface } from './mapSurface';

describe('mapSurface', () => {
  it('준비되고 좌표가 있으면 지도', () => {
    expect(mapSurface(true, true)).toBe('map');
  });

  it('좌표는 있는데 아직 못 그리면 기다리는 그림', () => {
    // 이 시험이 이 파일의 존재 이유다.
    //
    // 예전에는 이 경우가 'empty' 로 흘러가, 좌표가 멀쩡한 팝업도 불러오는 동안
    // "위치 정보가 없습니다" 를 보여줬다. 서버 HTML 에도 그대로 실렸다.
    expect(mapSurface(false, true)).toBe('loading');
    expect(mapSurface(false, true)).not.toBe('empty');
  });

  it('좌표가 없으면 없다고 말한다', () => {
    expect(mapSurface(true, false)).toBe('empty');
  });

  it('좌표가 없으면 준비 여부와 상관없이 없다', () => {
    // 없는 것은 기다린다고 생기지 않는다.
    expect(mapSurface(false, false)).toBe('empty');
  });
});

describe('hasUsableCoordinates', () => {
  it('숫자 두 개면 쓴다', () => {
    expect(hasUsableCoordinates(37.5445, 127.056)).toBe(true);
  });

  it('문자열로 와도 읽는다', () => {
    // API 는 좌표를 문자열로 준다.
    expect(hasUsableCoordinates('37.5445', '127.056')).toBe(true);
  });

  it('한쪽만 있으면 안 쓴다', () => {
    expect(hasUsableCoordinates(37.5445, null)).toBe(false);
    expect(hasUsableCoordinates(null, 127.056)).toBe(false);
  });

  it('빈 문자열은 0 이 아니라 없는 것이다', () => {
    // Number('') 는 0 이다. 그냥 숫자로 바꾸면 적도가 팝업 위치가 된다.
    expect(hasUsableCoordinates('', '')).toBe(false);
    expect(hasUsableCoordinates('37.5445', '')).toBe(false);
  });

  it('숫자가 아니면 안 쓴다', () => {
    expect(hasUsableCoordinates('알 수 없음', '127.056')).toBe(false);
    expect(hasUsableCoordinates(NaN, 127.056)).toBe(false);
  });

  it('0 은 서울일 수 없다', () => {
    // 빈 좌표를 0 으로 메워 온 데이터면 여기서 걸러야 한다 —
    // 적도 한가운데에 핀을 찍느니 없다고 하는 편이 낫다.
    expect(hasUsableCoordinates(0, 127.056)).toBe(false);
    expect(hasUsableCoordinates(37.5445, 0)).toBe(false);
  });
});
