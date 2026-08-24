import { describe, expect, it } from 'vitest';

import { isProvenOutsideSeoul } from './seoulGuard';

/**
 * 실측 데이터로 <b>양쪽</b>을 못박는다.
 *
 * <p>못 잡으면 틀린 주소가 그대로 나가고, 잘못 잡으면 멀쩡한 서울 팝업에 "서울 밖" 배지가 붙는다.
 * 아래 입력은 전부 라이브 {@code /api/map/markers} 에서 그대로 가져온 실제 값이다.
 */

describe('isProvenOutsideSeoul — 잡아야 하는 것', () => {
  it('좌표가 서울 경계 밖', () => {
    // 실측: 대전신세계로 지오코딩된 건
    expect(isProvenOutsideSeoul({ latitude: '36.3752', longitude: '127.3860' })).toBe(true);
    // 부산 서면
    expect(isProvenOutsideSeoul({ latitude: '35.156', longitude: '129.058' })).toBe(true);
  });

  it('좌표가 없어도 주소 표기로 잡는다 — 실측 대전신세계 3건이 전부 좌표가 없다', () => {
    expect(isProvenOutsideSeoul({ location: '서울 대전신세계' })).toBe(true);
    expect(isProvenOutsideSeoul({ location: '서울 대전신세계 Art&Science 6층 아트테라스' })).toBe(
      true,
    );
  });

  it('좌표가 틀리게 찍혀 있어도 주소 표기로 잡는다 — 판교 8건이 서울 한복판 좌표를 갖고 있다', () => {
    expect(
      isProvenOutsideSeoul({
        location: '서울 판교현대백화점',
        latitude: '37.5126645361942',
        longitude: '127.0',
      }),
    ).toBe(true);
  });

  it('행정 단위가 붙은 지명', () => {
    expect(isProvenOutsideSeoul({ location: '서울 수원시' })).toBe(true);
    expect(isProvenOutsideSeoul({ location: '서울 하남시' })).toBe(true);
    expect(isProvenOutsideSeoul({ location: '서울 순천시' })).toBe(true);
    expect(isProvenOutsideSeoul({ location: '서울 성남시 분당구' })).toBe(true);
    expect(
      isProvenOutsideSeoul({
        location: '서울 경기도 성남시 판교역로146번길 20 현대백화점 판교점 B층',
      }),
    ).toBe(true);
  });

  it('백화점 브랜드가 도시 뒤에 붙은 것도 잡는다', () => {
    expect(isProvenOutsideSeoul({ location: '서울 마포구 스타필드 수원 사당점' })).toBe(true);
    expect(isProvenOutsideSeoul({ location: '서울 수원 스타필드 1층 다이소' })).toBe(true);
  });

  it('서울에 같은 이름이 없는 곳', () => {
    expect(isProvenOutsideSeoul({ location: '서울 제주국제공항 도착층 3번 게이트앞' })).toBe(true);
  });
});

describe('isProvenOutsideSeoul — 잡으면 안 되는 것', () => {
  it('건물 이름에 지명이 섞인 진짜 서울 주소', () => {
    // 창원빌딩은 서울 성북구에 있다. 맨 지명을 보면 이게 걸린다.
    expect(
      isProvenOutsideSeoul({
        location: '서울 성북구 성북로 108 창원빌딩 3층',
        latitude: '37.5905',
        longitude: '127.0035',
      }),
    ).toBe(false);
    expect(isProvenOutsideSeoul({ location: '서울 마포구 대구탕골목' })).toBe(false);
    expect(isProvenOutsideSeoul({ location: '서울 종로구 부산집' })).toBe(false);
  });

  it('김포공항은 서울 강서구다', () => {
    expect(isProvenOutsideSeoul({ location: '서울 김포공항 롯데몰' })).toBe(false);
  });

  it('시장·시청·시민 은 "시" 로 끝나는 지명이 아니다', () => {
    expect(isProvenOutsideSeoul({ location: '서울 광장시장' })).toBe(false);
  });

  it('평범한 서울 주소', () => {
    expect(isProvenOutsideSeoul({ location: '서울 성동구 성수동' })).toBe(false);
    expect(isProvenOutsideSeoul({ location: '서울 송파구 올림픽로 240 롯데백화점 잠실점' })).toBe(
      false,
    );
    expect(isProvenOutsideSeoul({ location: '서울 영등포구 더현대 서울' })).toBe(false);
  });

  it('아무 정보도 없으면 밖이 아니다 — 모르는 것은 밖이 아니다', () => {
    expect(isProvenOutsideSeoul({})).toBe(false);
    expect(isProvenOutsideSeoul({ location: '서울' })).toBe(false);
    expect(isProvenOutsideSeoul({ latitude: null, longitude: null, location: null })).toBe(false);
  });

  it('서울 4극단은 경계 안이다', () => {
    const corners = [
      ['37.428', '127.05'], // 원지동
      ['37.715', '127.05'], // 도봉동
      ['37.55', '126.764'], // 오곡동
      ['37.55', '127.184'], // 강일동
    ];
    for (const [lat, lng] of corners) {
      expect(isProvenOutsideSeoul({ latitude: lat, longitude: lng }), `${lat},${lng}`).toBe(false);
    }
  });
});
