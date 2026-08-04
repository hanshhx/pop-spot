import { describe, expect, it } from 'vitest';

import { groupSameEvent, type GroupableEvent } from './groupSameEvent';

/**
 * 묶는 규칙의 <b>양쪽 실패</b>를 모두 막는다.
 *
 * <p>덜 묶으면 목록이 지금처럼 같은 행사로 도배되고, 더 묶으면 <b>다른 행사가 사라진다.</b> 둘 중
 * 나쁜 쪽은 후자다 — 안 보이는 것은 아무도 신고하지 못한다. 그래서 "합치지 않는다" 쪽 테스트를
 * 더 촘촘히 둔다.
 */

const ev = (o: Partial<GroupableEvent> & { id: number; name: string }): GroupableEvent => ({
  location: null,
  startDate: '2026-08-01',
  endDate: '2026-08-31',
  ...o,
});

describe('groupSameEvent', () => {
  it('표기만 다른 같은 행사를 한 줄로 묶는다', () => {
    // 실제 운영 데이터. 다섯 줄 전부 홍대 사멸회유 같은 행사다.
    const groups = groupSameEvent([
      ev({ id: 1, name: '주술회전사멸회유 팝업', location: '서울 FANBASE 홍대' }),
      ev({ id: 2, name: '주술회전 사멸회유', location: '서울 홍대' }),
      ev({ id: 3, name: '주술회전 (사멸회유)', location: '서울 마포구 양화로 178' }),
      ev({ id: 4, name: '주술회전(사멸회유) 팝업스토어', location: '서울 홍대입구역 4번출구' }),
      ev({ id: 5, name: '주술회전 사멸회유 팝업스토어', location: '서울특별시 마포구 양화로' }),
    ]);

    expect(groups).toHaveLength(1);
    expect(groups[0].duplicates).toHaveLength(4);
  });

  it('대표는 주소가 가장 자세한 것 — 사람에게 쓸모 있는 쪽을 남긴다', () => {
    const groups = groupSameEvent([
      ev({ id: 1, name: '스트릿 레스토랑 파이터', location: '서울' }),
      ev({
        id: 2,
        name: '스트릿레스토랑파이터 팝업',
        location: '서울 송파구 올림픽로 240 롯데백화점 잠실점',
      }),
    ]);

    expect(groups[0].lead.id).toBe(2);
  });

  it('기간이 안 겹치면 안 묶는다 — 같은 브랜드의 다음 시즌은 다른 방문지다', () => {
    const groups = groupSameEvent([
      ev({ id: 1, name: '산리오 팝업', startDate: '2026-01-01', endDate: '2026-01-31' }),
      ev({ id: 2, name: '산리오 팝업', startDate: '2026-08-01', endDate: '2026-08-31' }),
    ]);

    expect(groups).toHaveLength(2);
  });

  it('같은 이름이라도 동네가 다르면 안 묶는다 — 강남과 성수는 다른 방문지다', () => {
    const groups = groupSameEvent([
      ev({ id: 1, name: '구찌 에디트 룸', location: '서울 강남구 신세계백화점' }),
      ev({ id: 2, name: '구찌 에디트 룸', location: '서울 성동구 성수동' }),
    ]);

    expect(groups).toHaveLength(2);
  });

  it('한쪽 주소를 모르면 갈라놓지 않는다 — 모르는 것은 다른 것이 아니다', () => {
    const groups = groupSameEvent([
      ev({ id: 1, name: '치이카와 스시', location: '서울' }),
      ev({ id: 2, name: '치이카와 스시 팝업스토어', location: '서울 성수동 무신사 스토어' }),
    ]);

    expect(groups).toHaveLength(1);
  });

  it('연도가 다르면 다른 행사다 — 숫자는 지우지 않는다', () => {
    const groups = groupSameEvent([
      ev({ id: 1, name: 'K리그 산리오 썸머캠프' }),
      ev({ id: 2, name: '2026 K리그 산리오 썸머캠프' }),
    ]);

    expect(groups).toHaveLength(2);
  });

  it('이름이 표기 문자뿐이라 비어도 서로 합치지 않는다', () => {
    // normalizeName 이 빈 문자열을 뱉는 경우. 빈 키끼리 전부 합쳐지면 목록이 한 줄이 된다.
    const groups = groupSameEvent([
      ev({ id: 1, name: '팝업' }),
      ev({ id: 2, name: '스토어' }),
      ev({ id: 3, name: '전시' }),
    ]);

    expect(groups).toHaveLength(3);
  });

  it('입력 순서를 유지한다 — 호출부가 마감임박순으로 정렬해 둔 것을 뒤집지 않는다', () => {
    const groups = groupSameEvent([
      ev({ id: 10, name: '가 팝업' }),
      ev({ id: 20, name: '나 팝업' }),
      ev({ id: 30, name: '가 팝업스토어' }),
      ev({ id: 40, name: '다 팝업' }),
    ]);

    expect(groups.map((g) => g.lead.id)).toEqual([10, 20, 40]);
  });

  it('묶을 것이 없으면 원본 그대로 — 개수도 순서도 안 바뀐다', () => {
    const items = [ev({ id: 1, name: '가' }), ev({ id: 2, name: '나' }), ev({ id: 3, name: '다' })];
    const groups = groupSameEvent(items);

    expect(groups).toHaveLength(3);
    expect(groups.every((g) => g.duplicates.length === 0)).toBe(true);
  });
});
