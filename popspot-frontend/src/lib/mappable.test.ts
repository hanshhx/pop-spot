import { describe, expect, it } from 'vitest';

import { mappable, markerBounds } from './mappable';
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

/**
 * 찍히는 마커가 전부 화면에 들어오도록 사각형(최소/최댓값)을 구한다.
 *
 * <p>예전엔 좌표 평균(중심점) 하나만 지도에 넘겼다 — 지도는 그 중심으로 <b>이동</b>만 하고
 * <b>줌</b>은 고정된 채였다. 성수처럼 좁은 지역은 우연히 다 들어왔지만, this-week 처럼 서울
 * 전역에 흩어진 마커는 중심이 한강 한복판이라 나머지 대부분이 화면 밖이었다 — "488곳 중 406곳
 * 표시" 라고 적어놓고 실제로 보이는 건 9곳뿐이었다.
 *
 * <p>중심 대신 <b>사각형</b>을 돌려준다 — 호출하는 쪽이 지도의 fitBounds 에 그대로 넘기면 지도가
 * 줌까지 알아서 맞춘다.
 */
describe('markerBounds', () => {
  it('여러 마커의 최소·최댓값으로 사각형을 만든다', () => {
    const got = markerBounds([
      m({ id: 1, latitude: '37.50', longitude: '127.00' }),
      m({ id: 2, latitude: '37.60', longitude: '126.90' }),
      m({ id: 3, latitude: '37.55', longitude: '127.10' }),
    ]);
    expect(got).toEqual({ minLat: 37.5, maxLat: 37.6, minLng: 126.9, maxLng: 127.1 });
  });

  it('마커가 하나면 그 좌표가 네 꼭짓점 모두다 — 넓이 0 인 사각형', () => {
    const got = markerBounds([m({ id: 1, latitude: '37.5446', longitude: '127.0559' })]);
    expect(got).toEqual({
      minLat: 37.5446,
      maxLat: 37.5446,
      minLng: 127.0559,
      maxLng: 127.0559,
    });
  });

  it('여러 마커가 같은 좌표를 공유해도 넓이 0 인 사각형을 돌려준다', () => {
    const got = markerBounds([
      m({ id: 1, latitude: '37.50', longitude: '127.00' }),
      m({ id: 2, latitude: '37.50', longitude: '127.00' }),
    ]);
    expect(got).toEqual({ minLat: 37.5, maxLat: 37.5, minLng: 127.0, maxLng: 127.0 });
  });

  it('좌표 없는 마커는 사각형 계산에서 빠진다', () => {
    const got = markerBounds([m({ id: 1 }), m({ id: 2, latitude: '37.50', longitude: '127.00' })]);
    expect(got).toEqual({ minLat: 37.5, maxLat: 37.5, minLng: 127.0, maxLng: 127.0 });
  });

  it('찍을 마커가 하나도 없으면 undefined 다', () => {
    expect(markerBounds([])).toBeUndefined();
    expect(markerBounds([m({ id: 1 })])).toBeUndefined();
  });
});
