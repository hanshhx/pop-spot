import { describe, expect, it } from 'vitest';

import { isApproximateLocation } from './locationPrecision';

/**
 * 아래 주소는 전부 <b>운영 데이터에서 그대로 가져온 것</b>이다(2026-08-09, 마커 1047곳).
 *
 * <p>이 판정이 틀리는 두 방향의 대가가 다르다. 건물 주소를 "대략" 으로 보면 정확한 핀이 흐리게
 * 나올 뿐이지만, 동네 이름을 "정확" 으로 보면 <b>사용자를 엉뚱한 데로 보낸다.</b> 그래서 애매하면
 * 대략 쪽으로 기운다.
 */
describe('isApproximateLocation', () => {
  it('동네 이름까지만 있으면 대략 위치다 — 지오코더가 그 동네 한복판을 찍는다', () => {
    // 각각 운영에서 98곳·51곳·18곳·14곳이 한 점에 뭉쳐 있던 주소들이다.
    for (const loc of [
      '서울',
      '서울 성수동',
      '서울 성동구 성수동',
      '서울 성동구',
      '서울 명동',
      '서울 홍대',
      '서울특별시 마포구',
      // REGIONS(화면 칩 12개)에는 없지만 동네 이름인 것들. 운영에서 실제로 나왔다.
      '서울 신촌',
      '서울 마곡',
      '서울 영등포',
      '서울 북촌',
      '서울 광화문',
      // 서울이 아닌데 "서울" 이 붙어 들어온 것 — 좌표가 확실히 틀렸으므로 더더욱 대략이다.
      '서울 판교',
      '서울 해운대',
    ]) {
      expect(isApproximateLocation(loc), loc).toBe(true);
    }
  });

  /** 짧은 주소라도 <b>건물</b>이면 정확하다. 동네와 건물을 갯수로 가를 수 없다는 뜻이다. */
  it('두 단어여도 건물 이름이면 정확한 위치다', () => {
    for (const loc of ['서울 코엑스', '서울 DDP', '서울 롯데월드타워', '서울 마리오아울렛']) {
      expect(isApproximateLocation(loc), loc).toBe(false);
    }
  });

  it('건물을 가리키면 정확한 위치다', () => {
    for (const loc of [
      '서울 영등포 더현대 서울 지하 2층',
      '서울 마포구 홍대 AK PLAZA',
      '용산 아이파크몰, 서울',
      '서울 영등포구 더현대 서울 지하 2층 아이코닉 존',
      '서울 성동구 성수동 코사이어티',
    ]) {
      expect(isApproximateLocation(loc), loc).toBe(false);
    }
  });

  it('번지·층수가 있으면 동네 이름이 아니다', () => {
    expect(isApproximateLocation('서울 영등포구 여의대로 108')).toBe(false);
    expect(isApproximateLocation('서울 성동구 연무장길 5길 9')).toBe(false);
  });

  /** 주소를 모르는 것과 동네만 아는 것은 사용자에게 같은 뜻이다 — 정확한 핀을 믿으면 안 된다. */
  it('주소가 비어 있으면 대략으로 본다', () => {
    expect(isApproximateLocation('')).toBe(true);
    expect(isApproximateLocation('   ')).toBe(true);
    expect(isApproximateLocation(null)).toBe(true);
    expect(isApproximateLocation(undefined)).toBe(true);
  });

  it('쉼표·괄호가 섞여도 낱말로 갈라 본다', () => {
    expect(isApproximateLocation('서울, 성수동')).toBe(true);
    expect(isApproximateLocation('(서울) 성동구')).toBe(true);
  });
});
