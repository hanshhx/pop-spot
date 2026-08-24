import { describe, expect, it } from 'vitest';

import { mappable } from './mappable';
import type { PublicMapMarker } from './mapMarkers';

/**
 * 지도에 찍을 수 있는 것만 고른다.
 *
 * <p>랜딩은 "지도 한눈에" 라고 말하지만 좌표는 3분의 1 가까이 비어 있다(성수 98곳 중 65곳).
 * 없는 것을 숨기면 지도가 조용히 짧아지고, 방문자는 목록에 있는 팝업이 왜 지도에 없는지 알 수
 * 없다. 그래서 <b>고르되 센다</b> — 화면이 "98곳 중 65곳" 이라고 적을 수 있게 둘 다 돌려준다.
 *
 * <p>{@code (0, 0)} 은 서아프리카 앞바다다. 좌표가 깨진 행이 그리로 모이면 서울 지도는 비고
 * 대서양에 핀이 뭉친다 — 빈 값보다 나쁜 종류의 거짓말이다.
 */
const m = (o: Partial<PublicMapMarker> & { id: number }): PublicMapMarker => ({
  name: `팝업 ${o.id}`,
  location: '서울 성동구',
  latitude: null,
  longitude: null,
  category: null,
  startDate: null,
  endDate: null,
  ...o,
});

describe('mappable', () => {
  it('좌표가 있는 것만 고르고, 전체 개수는 그대로 센다', () => {
    const got = mappable([
      m({ id: 1, latitude: '37.5446', longitude: '127.0559' }),
      m({ id: 2 }),
      m({ id: 3, latitude: '37.5444', longitude: '127.0374' }),
    ]);
    expect(got.shown.map((x) => x.id)).toEqual([1, 3]);
    expect(got.total).toBe(3);
  });

  it('한쪽만 있으면 못 찍는다', () => {
    const got = mappable([m({ id: 1, latitude: '37.5446' })]);
    expect(got.shown).toEqual([]);
    expect(got.total).toBe(1);
  });

  it('공백만 든 문자열은 좌표가 아니다 — Number(" ") 가 0 이라 그냥 두면 통과한다', () => {
    const got = mappable([m({ id: 1, latitude: ' ', longitude: ' ' })]);
    expect(got.shown).toEqual([]);
  });

  it('숫자가 아닌 글자는 거른다', () => {
    expect(mappable([m({ id: 1, latitude: '서울', longitude: '성수' })]).shown).toEqual([]);
  });

  it('빈 목록은 0 중 0 이다', () => {
    expect(mappable([])).toEqual({ shown: [], total: 0 });
  });

  it('원본 순서를 흔들지 않는다 — 부모가 정한 순서를 여기서 다시 정하지 않는다', () => {
    const got = mappable([
      m({ id: 9, latitude: '37.5', longitude: '127.0' }),
      m({ id: 2, latitude: '37.6', longitude: '127.1' }),
    ]);
    expect(got.shown.map((x) => x.id)).toEqual([9, 2]);
  });
});
