import { describe, expect, it } from 'vitest';

import {
  detailRobots,
  indexableDetailGroups,
  isIndexableDetail,
  judgeIndexable,
} from './indexableDetail';

/**
 * 자격 판정의 <b>양쪽 실패</b>를 막는다.
 *
 * <p>느슨하면 주소가 "서울" 한 줄뿐인 얇은 페이지 191건이 통째로 색인돼 사이트 평가가 내려간다.
 * 빡빡하면 멀쩡한 팝업이 검색에서 빠진다. 아래 입력은 전부 라이브 {@code /api/map/markers} 에서
 * 그대로 가져온 실제 값이다.
 */

const TODAY = '2026-08-04';

describe('열어야 하는 것', () => {
  it('번지까지 있는 주소', () => {
    expect(
      isIndexableDetail(
        {
          name: '스트릿레스토랑파이터 팝업',
          location: '서울 송파구 올림픽로 240 롯데백화점 잠실점',
          endDate: '2026-08-06',
        },
        TODAY,
      ),
    ).toBe(true);
  });

  it('구 이름만 있어도 통과 — 그 정도면 찾아갈 수 있다', () => {
    expect(
      isIndexableDetail(
        { name: '오얏 팝업스토어', location: '서울 강남구', endDate: '2026-08-05' },
        TODAY,
      ),
    ).toBe(true);
  });

  it('알려진 건물·상권 이름', () => {
    expect(
      isIndexableDetail(
        { name: '짱구 대축제', location: '서울 용산 아이파크몰', endDate: '2026-08-05' },
        TODAY,
      ),
    ).toBe(true);
    expect(
      isIndexableDetail(
        { name: '치이카와 스시', location: '서울 성수동 무신사 스토어', endDate: '2026-08-09' },
        TODAY,
      ),
    ).toBe(true);
  });

  it('오늘 마감이어도 아직 열려 있다', () => {
    expect(
      isIndexableDetail(
        { name: '노스페이스키즈', location: '서울 마포구 양화로 178', endDate: TODAY },
        TODAY,
      ),
    ).toBe(true);
  });
});

describe('열면 안 되는 것', () => {
  it('주소가 "서울" 한 줄뿐 — 실측 191건(19.8%)이 이 모양이다', () => {
    const v = judgeIndexable(
      { name: '루 런칭 백화점 팝업', location: '서울', endDate: '2026-12-31' },
      TODAY,
    );
    expect(v).toEqual({ ok: false, reason: 'VAGUE_LOCATION' });
  });

  it('동네 이름조차 아닌 것', () => {
    expect(
      isIndexableDetail(
        { name: '무기와라스토어', location: '서울 ', endDate: '2026-08-09' },
        TODAY,
      ),
    ).toBe(false);
  });

  it('마감일이 없으면 "언제까지" 에 답할 수 없다', () => {
    const v = judgeIndexable(
      { name: '주술회전 팝업 스토어', location: '서울 성수동', endDate: null },
      TODAY,
    );
    expect(v).toEqual({ ok: false, reason: 'NO_END_DATE' });
  });

  it('이미 끝난 팝업 — 헛걸음을 만든다', () => {
    const v = judgeIndexable(
      { name: '지난 팝업', location: '서울 성동구 연무장길 57', endDate: '2026-08-03' },
      TODAY,
    );
    expect(v).toEqual({ ok: false, reason: 'ALREADY_ENDED' });
  });

  it('이름이 없으면 아무것도 아니다', () => {
    expect(
      judgeIndexable({ name: '  ', location: '서울 강남구', endDate: '2026-09-01' }, TODAY),
    ).toEqual({
      ok: false,
      reason: 'NO_NAME',
    });
  });
});

/**
 * 수집기가 서울이 아닌 팝업에도 "서울" 을 붙인다(알려진 백엔드 버그). 그 표기가 색인까지 새어
 * 나와, 실측(2026-09-01) 라이브 목록에서 "서울"과 비서울 지명이 함께 든 것이 92건이었다.
 */
describe('서울이 아닌 것', () => {
  it.each([
    ['서울 판교현대백화점', '현대백화점이 통과시키던 것'],
    ['서울 마포구 스타필드 수원 사당점', '스타필드가 통과시키던 것'],
    ['서울 영등포구 신세계 센텀시티점', '신세계가 통과시키던 것'],
    ['서울 제주국제공항 도착층 3번 게이트앞', '길이 검사만으로 통과하던 것'],
    ['서울 부산 해운대구 우동', ''],
  ])('%s 은 색인하지 않는다', (location) => {
    expect(judgeIndexable({ name: 'x', location, endDate: '2026-12-31' }, TODAY)).toEqual({
      ok: false,
      reason: 'OUTSIDE_SEOUL',
    });
  });

  /*
   * 반대쪽 위험. 잘못 막으면 멀쩡한 팝업이 검색에서 사라지는데, 그건 오염을 남기는 것보다 나쁘다.
   * 김포공항은 강서구고, 하남돼지집·고양이는 상호다 — 그래서 목록에서 뺐다.
   */
  it.each([
    '서울 강서구 김포공항 롯데몰',
    '서울 마포구 하남돼지집 앞',
    '서울 성동구 고양이카페 성수점',
    '서울 송파구 올림픽로 300',
    '서울 성동구 연무장길 5',
  ])('서울 주소는 그대로 통과한다 — %s', (location) => {
    expect(isIndexableDetail({ name: 'x', location, endDate: '2026-12-31' }, TODAY)).toBe(true);
  });
});

describe('경계', () => {
  it('"서울 성수" 처럼 동네만 있는 것은 떨어진다 — 그 정보로는 못 간다', () => {
    expect(
      isIndexableDetail({ name: 'x', location: '서울 성수', endDate: '2026-09-01' }, TODAY),
    ).toBe(false);
  });

  it('오늘 기준은 호출부가 넘긴다 — 서버가 UTC 라 여기서 만들면 하루 어긋난다', () => {
    const m = { name: 'x', location: '서울 강남구', endDate: '2026-08-04' };
    expect(isIndexableDetail(m, '2026-08-04')).toBe(true);
    expect(isIndexableDetail(m, '2026-08-05')).toBe(false);
  });

  /**
   * 길이 검사가 지명 목록보다 먼저 돌던 버그. HAS_VENUE 26개 중 9개가 두 글자라, 등록해 둔
   * 지명이 그 앞의 {@code rest.length < 3} 에서 잘렸다. 2026-08-05 실측 25건이 여기 걸려 있었다.
   *
   * <p>이 테스트가 없으면 "두 글자는 동네인지 오타인지 모른다" 는 이유로 길이 검사를 다시 앞으로
   * 옮기는 변경이 조용히 통과한다.
   */
  it.each(['서울 명동', '서울 홍대', '서울 잠실', '서울 목동', '서울 신촌', '서울 한남'])(
    '두 글자라도 등록된 지명이면 통과한다 — %s',
    (location) => {
      expect(isIndexableDetail({ name: 'x', location, endDate: '2026-09-01' }, TODAY)).toBe(true);
    },
  );

  it('등록 안 된 두 글자는 여전히 떨어진다 — 오타와 구분할 방법이 없다', () => {
    for (const location of ['서울 성수', '서울 판교', '서울 방배']) {
      expect(isIndexableDetail({ name: 'x', location, endDate: '2026-09-01' }, TODAY)).toBe(false);
    }
  });
});

describe('detailRobots', () => {
  it('색인 자격이 있으면 index·follow 둘 다 연다', () => {
    expect(detailRobots(true)).toEqual({ index: true, follow: true });
  });

  /**
   * 이 테스트가 지키는 것은 follow 다.
   *
   * noindex + nofollow 로 두면 그 페이지 안의 '주변 팝업' 링크가 크롤러에게 전달되지 않아
   * 상세끼리 이어지는 길이 끊긴다. 실측(2026-08-29) 색인 자격 465건 중 검색에 나타난 상세는
   * 59개뿐이었고 구글은 461개를 "발견했지만 색인하지 않음" 으로 쥐고 있었다.
   *
   * follow 를 다시 false 로 되돌리는 변경은 화면에 아무 증상이 없어서 조용히 통과한다.
   */
  it('색인 자격이 없어도 길은 막지 않는다', () => {
    expect(detailRobots(false)).toEqual({ index: false, follow: true });
  });
});

/**
 * 사이트맵에 실을 그룹.
 *
 * <p>여기서 지켜야 할 것은 두 가지다. 같은 행사를 두 번 올리지 않는 것, 그리고 <b>묶다가 자격
 * 있는 줄을 잃지 않는 것</b>. 뒤엣것이 이 함수에서 유일하게 틀리기 쉬운 지점이다.
 */
describe('indexableDetailGroups', () => {
  const base = {
    location: '서울 성동구 연무장길 5',
    startDate: '2026-08-01',
    endDate: '2026-09-30',
  };

  it('같은 행사는 한 줄로 묶는다', () => {
    const groups = indexableDetailGroups(
      [
        { id: 1, name: '짱구 팝업스토어', ...base },
        { id: 2, name: '짱구 팝업', ...base, location: '서울 성동구 연무장길 5-1' },
      ],
      TODAY,
    );
    expect(groups).toHaveLength(1);
    // 대표는 주소가 더 자세한 쪽이다.
    expect(groups[0].lead.id).toBe(2);
    expect(groups[0].duplicates.map((d) => d.id)).toEqual([1]);
  });

  it('다른 행사는 묶지 않는다', () => {
    const groups = indexableDetailGroups(
      [
        { id: 1, name: '짱구 팝업', ...base },
        { id: 2, name: '니케 팝업', ...base },
      ],
      TODAY,
    );
    expect(groups).toHaveLength(2);
  });

  it('색인 자격이 없는 것은 애초에 빼고 묶는다', () => {
    const groups = indexableDetailGroups(
      [
        { id: 1, name: '짱구 팝업', ...base },
        // 종료일이 없어 자격 미달
        { id: 2, name: '니케 팝업', ...base, endDate: null },
      ],
      TODAY,
    );
    expect(groups.map((g) => g.lead.id)).toEqual([1]);
  });

  /*
   * 이 시험이 이 블록의 존재 이유다.
   *
   * 대표는 <b>주소가 가장 긴 것</b>으로 뽑힌다 — 색인 자격과 아무 상관이 없다. 그래서 묶고 나서
   * 대표만 판정하면, 대표가 자격 미달인 그룹에서 자격 있는 나머지 줄까지 통째로 사라진다.
   * 아래에서 id 2 는 주소가 더 길지만 종료일이 없어 자격이 없고, id 1 은 자격이 있다.
   * 순서를 뒤집은 구현에서는 결과가 0건이 된다.
   */
  it('대표가 자격 미달이어도 자격 있는 줄을 잃지 않는다', () => {
    const groups = indexableDetailGroups(
      [
        { id: 1, name: '짱구 팝업', ...base },
        {
          id: 2,
          name: '짱구 팝업스토어',
          ...base,
          location: '서울 성동구 연무장길 5-1길 2층',
          endDate: null,
        },
      ],
      TODAY,
    );
    expect(groups).toHaveLength(1);
    expect(groups[0].lead.id).toBe(1);
  });

  /* lastModified 를 대표만 보고 정하면 묶인 줄의 최신 변경이 사이트맵에 안 실린다. */
  it('묶인 줄을 버리지 않는다', () => {
    const groups = indexableDetailGroups(
      [
        { id: 1, name: '짱구 팝업', ...base },
        { id: 2, name: '짱구 팝업', ...base, location: '서울 성동구 연무장길 5-1' },
        { id: 3, name: '짱구 팝업', ...base, location: '서울 성동구 연무장길 5-1-1' },
      ],
      TODAY,
    );
    expect(groups).toHaveLength(1);
    expect(groups[0].duplicates).toHaveLength(2);
  });

  it('빈 입력은 빈 결과', () => {
    expect(indexableDetailGroups([], TODAY)).toEqual([]);
  });
});
