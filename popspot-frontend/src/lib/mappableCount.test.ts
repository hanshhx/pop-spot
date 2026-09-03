import { describe, expect, it } from 'vitest';

import { countGoAble, FALLBACK_CLUSTER_MIN, fallbackCoordKeys, isMappable } from './mappableCount';

/**
 * 검색 결과의 "N곳" 과 화면의 "N개" 는 <b>같은 수</b>여야 한다.
 *
 * <p>2026-09-03 에 어긋남을 만들 뻔했다. 메타는 "열려 있는가" 만 보고 1,191을 냈는데 화면은 좌표와
 * 중복까지 걸러 1,005를 세고 있었다. 검색에서 1,191을 보고 들어온 사람은 화면에서 1,005를 보고
 * 첫 3초에 신뢰를 잃는다.
 *
 * <p>여기서 지키는 것은 <b>셀 수 있는 것이 아니라 갈 수 있는 것을 센다</b>는 원칙이다.
 */

const 오늘 = new Date('2026-09-03T00:00:00+09:00');
const 열림 = { startDate: '2026-09-01', endDate: '2026-09-30' };
const 끝남 = { startDate: '2026-08-01', endDate: '2026-08-15' };

let seq = 0;
/* 이름은 groupSameEvent 가 같은 행사를 묶는 데 쓴다 — 서로 다른 이름이어야 따로 센다. */
const at = (lat: string, lng: string, extra: object = 열림) => ({
  id: ++seq,
  name: `팝업 ${seq}`,
  latitude: lat,
  longitude: lng,
  ...extra,
});

describe('fallbackCoordKeys', () => {
  /* 수백 곳이 한 점에 뭉쳐 있으면 실제 주소가 아니라 "서울 어딘가" 를 뜻하는 대표값이다. */
  it('한 좌표에 많이 뭉친 것을 지역 중심점으로 본다', () => {
    const 뭉침 = Array.from({ length: FALLBACK_CLUSTER_MIN + 1 }, () => at('37.5', '127.0'));

    expect(fallbackCoordKeys(뭉침).has('37.5,127.0')).toBe(true);
  });

  it('기준 이하면 진짜 위치로 본다', () => {
    const 조금 = Array.from({ length: FALLBACK_CLUSTER_MIN }, () => at('37.5', '127.0'));

    expect(fallbackCoordKeys(조금).size).toBe(0);
  });
});

describe('isMappable', () => {
  it('좌표가 없거나 읽히지 않으면 뺀다 — 눌러도 지도에서 못 찾는다', () => {
    const 없음 = new Set<string>();

    expect(isMappable({ latitude: null, longitude: null }, 없음)).toBe(false);
    expect(isMappable({ latitude: '', longitude: '' }, 없음)).toBe(false);
    expect(isMappable({ latitude: '없음', longitude: '없음' }, 없음)).toBe(false);
    expect(isMappable({ latitude: '37.5', longitude: '127.0' }, 없음)).toBe(true);
  });

  it('지역 중심점이면 뺀다', () => {
    expect(isMappable({ latitude: '37.5', longitude: '127.0' }, new Set(['37.5,127.0']))).toBe(
      false,
    );
  });
});

describe('countGoAble', () => {
  it('열려 있고 좌표가 있는 것만 센다', () => {
    const list = [
      at('37.51', '127.01'),
      at('37.52', '127.02'),
      at('37.53', '127.03', 끝남), // 끝남
      { ...열림, id: 999, name: '좌표 없는 팝업', latitude: null, longitude: null },
    ];

    expect(countGoAble(list, 오늘)).toBe(2);
  });

  /* 같은 행사가 이름만 다른 여러 줄로 들어와도 갈 수 있는 곳은 한 곳이다. */
  it('지역 중심점에 뭉친 것은 통째로 뺀다', () => {
    const 뭉침 = Array.from({ length: FALLBACK_CLUSTER_MIN + 5 }, () => at('37.5', '127.0'));
    const 진짜 = [at('37.61', '127.11'), at('37.62', '127.12')];

    expect(countGoAble([...뭉침, ...진짜], 오늘)).toBe(2);
  });

  it('자료가 없으면 0', () => {
    expect(countGoAble([], 오늘)).toBe(0);
    expect(countGoAble(null, 오늘)).toBe(0);
    expect(countGoAble(undefined, 오늘)).toBe(0);
  });
});
