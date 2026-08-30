import { describe, expect, it } from 'vitest';

import { mix, parseHex, toHex } from './colorMix';

describe('parseHex', () => {
  it('6자리와 3자리를 모두 읽는다', () => {
    expect(parseHex('#0f171b')).toEqual([15, 23, 27]);
    expect(parseHex('0f171b')).toEqual([15, 23, 27]);
    expect(parseHex('#abc')).toEqual([170, 187, 204]);
  });

  it('hex 가 아니면 null', () => {
    // CSS 변수는 비어 있을 수도, rgb() 형태일 수도 있다. 그때 예외를 던지면 지도가 안 뜬다.
    for (const bad of ['', '  ', 'rgb(0,0,0)', '#12345', '#gggggg', 'var(--x)']) {
      expect(parseHex(bad), JSON.stringify(bad)).toBeNull();
    }
  });
});

describe('toHex', () => {
  it('항상 두 자리씩 채운다', () => {
    // padStart 가 없으면 #0f171b 가 #f171b 가 되어 조용히 깨진 색이 된다.
    expect(toHex([15, 23, 27])).toBe('#0f171b');
    expect(toHex([0, 0, 0])).toBe('#000000');
  });

  it('범위를 벗어난 값을 잘라낸다', () => {
    expect(toHex([-20, 300, 128.6])).toBe('#00ff81');
  });
});

describe('mix', () => {
  it('양 끝은 원래 색', () => {
    expect(mix('#000000', '#ffffff', 0)).toBe('#000000');
    expect(mix('#000000', '#ffffff', 1)).toBe('#ffffff');
  });

  it('중간은 반씩', () => {
    expect(mix('#000000', '#ffffff', 0.5)).toBe('#808080');
  });

  it('읽을 수 없는 색이 섞이면 첫 색을 그대로 돌려준다', () => {
    // 색 하나가 덜 예쁜 것이 지도가 통째로 안 뜨는 것보다 낫다.
    expect(mix('#0f171b', 'var(--nope)', 0.5)).toBe('#0f171b');
    expect(mix('rgb(1,2,3)', '#ffffff', 0.5)).toBe('rgb(1,2,3)');
  });

  it('t 가 범위를 벗어나도 양 끝을 넘지 않는다', () => {
    expect(mix('#000000', '#ffffff', -3)).toBe('#000000');
    expect(mix('#000000', '#ffffff', 9)).toBe('#ffffff');
  });
});
