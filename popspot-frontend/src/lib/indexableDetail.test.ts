import { describe, expect, it } from 'vitest';

import { isIndexableDetail, judgeIndexable } from './indexableDetail';

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
});
