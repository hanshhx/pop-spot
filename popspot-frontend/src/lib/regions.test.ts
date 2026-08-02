import { describe, expect, it } from 'vitest';

import { REGIONS, classifyRegion } from '@/lib/regions';

/**
 * 동네 분류 규칙을 고정한다.
 *
 * `classifyRegion` 은 **여섯 곳이 공유한다** — 랜딩 페이지·sitemap·RSS·지도 칩·홈 BROWSE 카운트·
 * 마커 필터. 여기서 한 글자 틀리면 그 전부가 동시에 틀어지는데, 화면에는 오류가 아니라 그냥
 * "다른 동네에 뜬 팝업" 으로 보인다.
 *
 * 아래 주소 문자열은 **운영 데이터 1,420건 스냅샷에서 실제로 가져온 것들**이다. 지어낸 예시가
 * 아니라서, 규칙을 바꿨을 때 진짜로 무엇이 깨지는지 드러난다.
 */

describe('행정구역 단독 키워드는 동네 키워드에 진다', () => {
  it('구 이름만 적힌 주소는 그 구의 지역으로 간다 — 예전엔 전부 other 였다', () => {
    expect(classifyRegion('서울 성동구')).toBe('seongsu');
    expect(classifyRegion('서울 강남구')).toBe('gangnam');
    expect(classifyRegion('서울 마포구')).toBe('mapo');
    expect(classifyRegion('서울 중구')).toBe('myeongdong');
    expect(classifyRegion('서울 성북구')).toBe('seongbuk');
    expect(classifyRegion('서울 용산구')).toBe('yongsan');
  });

  it('동네명이 함께 있으면 동네가 이긴다 — 규칙 4의 핵심', () => {
    // 한남동·이태원동은 용산구 안에 있다. 구 이름에 끌려가면 안 된다.
    expect(classifyRegion('서울 용산구 한남동 683-142')).toBe('hannam');
    expect(classifyRegion('서울 용산구 이태원')).toBe('itaewon');
    // 성동구 안의 성수동.
    expect(classifyRegion('서울 성동구 성수동2가 315-70')).toBe('seongsu');
  });

  it('다른 구의 건물이 들어와도 건물 쪽이 이긴다 — broadKeywords 가 약한지 확인', () => {
    // 실측 사고 케이스. '강남구' 를 일반 keywords 에 넣으면 여기서 gangnam 으로 오분류된다.
    expect(classifyRegion('서울 강남구 아이파크몰 3층')).toBe('yongsan');
  });
});

describe('실측 데이터에서 회수되는 것들', () => {
  it('성수 — 연무장길·서울숲·뚝섬이 이제 잡힌다', () => {
    expect(classifyRegion('서울 성동구 연무장길 41')).toBe('seongsu');
    expect(classifyRegion('서울 서울숲2길 32-14')).toBe('seongsu');
    expect(classifyRegion('서울 뚝섬로 312')).toBe('seongsu');
  });

  it('여의도 — 더현대 서울이 이제 여의도로 간다', () => {
    expect(classifyRegion('서울 영등포구 더현대 서울')).toBe('yeouido');
    expect(classifyRegion('서울 여의도 IFC몰 B3')).toBe('yeouido');
  });

  it('마포 — 연남·망원·상암. 0곳이던 지역이 살아난다', () => {
    expect(classifyRegion('서울 마포구 연남동 227-15')).toBe('mapo');
    expect(classifyRegion('서울 망원역 2번 출구')).toBe('mapo');
  });

  it('연남·망원은 홍대가 아니라 마포다 — 행정구역을 따른다', () => {
    // 홍대에 몰면 홍대만 커지고 마포는 계속 thin 이다. 지역 하나를 살리는 쪽을 택했다.
    expect(classifyRegion('서울 마포구 연남동')).not.toBe('hongdae');
  });
});

describe('일부러 잡지 않는 것들 — 오분류가 더 나쁘다', () => {
  it('코엑스 마곡은 강남이 아니다 — 그래서 코엑스 단독 키워드를 안 쓴다', () => {
    expect(classifyRegion('서울 강서구 코엑스 마곡')).toBe('other');
  });

  it('타임스퀘어는 영등포동이지 여의도가 아니다', () => {
    expect(classifyRegion('서울 영등포구 타임스퀘어')).toBe('other');
  });

  it('강동구 더현대 같은 오염 레코드는 여의도로 끌어오지 않는다', () => {
    expect(classifyRegion('서울 강동구 더현대')).toBe('other');
  });

  it('빈 값·null 은 other', () => {
    expect(classifyRegion(null)).toBe('other');
    expect(classifyRegion('')).toBe('other');
    expect(classifyRegion('   ')).toBe('other');
  });
});

describe('정의 자체의 불변식', () => {
  it('code 와 slug 가 같다 — 어긋나면 URL 과 필터가 따로 논다', () => {
    for (const r of REGIONS) {
      expect(r.slug).toBe(r.code);
    }
  });

  it('슬러그가 겹치지 않는다', () => {
    const slugs = REGIONS.map((r) => r.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it('세 언어 표시명이 모두 채워져 있다', () => {
    for (const r of REGIONS) {
      expect(r.label, r.code).toBeTruthy();
      expect(r.labelEn, r.code).toBeTruthy();
      expect(r.labelJa, r.code).toBeTruthy();
    }
  });

  it('행정구역명이 일반 keywords 에 섞여 있지 않다 — 섞이면 그 지역이 통째로 약해진다', () => {
    // 끝 글자가 '구' 인지로 판정하면 '을지로입구'(역 이름)까지 걸린다. 25개 구 이름과 정확히 맞춘다.
    const SEOUL_GU = new Set([
      '종로구',
      '중구',
      '용산구',
      '성동구',
      '광진구',
      '동대문구',
      '중랑구',
      '성북구',
      '강북구',
      '도봉구',
      '노원구',
      '은평구',
      '서대문구',
      '마포구',
      '양천구',
      '강서구',
      '구로구',
      '금천구',
      '영등포구',
      '동작구',
      '관악구',
      '서초구',
      '강남구',
      '송파구',
      '강동구',
    ]);

    for (const r of REGIONS) {
      for (const kw of r.keywords) {
        expect(SEOUL_GU.has(kw), `${r.code}: '${kw}' 는 broadKeywords 로 옮길 것`).toBe(false);
      }
    }
  });

  it('broadKeywords 에는 행정구역명만 들어간다 — 동네명을 넣으면 이길 것이 못 이긴다', () => {
    for (const r of REGIONS) {
      for (const kw of r.broadKeywords ?? []) {
        expect(kw.endsWith('구'), `${r.code}: '${kw}'`).toBe(true);
      }
    }
  });
});
