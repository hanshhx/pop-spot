/**
 * v2.21 — 팝업 위치(주소) 문자열로 동네 분류.
 *
 * 사용자 요구: 성수인데 한남 들어가면 안 됨. 그래서 다음 규칙을 따른다.
 *
 *  1. 각 region 에 명확한 keyword 배열 + 정확도 우선순위 (priority) 부여.
 *  2. 매칭 시 모든 region 을 순회하여 "가장 정확한 한 곳" 만 반환 (첫 매치 X).
 *  3. 같은 점수면 priority 낮은 (= 더 좁은 지역) 쪽 우선. 예: "성수동 한남대로" → 성수
 *     ("성수동" 이 "한남" 보다 더 구체적인 동네 매칭).
 *  4. 행정구역 단독 (예: "성동구") 은 {@link RegionDef.broadKeywords} 로만 넣는다. 이쪽은 항상
 *     {@link BROAD_PRIORITY} 로 평가돼 <b>어떤 동네 키워드에도 진다</b> — "성동구 한남동" 은 한남이다.
 *
 * 약관 §10-2 와 일관: 이 분류는 자체 보관 위치 텍스트만 사용. 외부 검색 API 호출 없음.
 */

/**
 * 행정구역 단독 키워드의 우선순위. REGIONS 의 어떤 priority(1~3)보다 크므로 항상 진다.
 *
 * <p>v2.53 — 그전에는 yongsan 이 {@code '용산구'} 를 일반 keywords 에 넣고 <b>region 전체
 * priority 를 3으로 낮춰</b> 규칙 4를 우회했다. 지역이 하나일 때만 통하는 방식이다. 같은 식으로
 * {@code '강남구'} 를 넣으면 강남의 동네 키워드까지 함께 약해져서, {@code 서울 강남구 아이파크몰}
 * 이 용산을 이기고 <b>강남으로 오분류된다</b>(실측 확인). 예외를 region 단위가 아니라 키워드
 * 단위로 표현해야 한다.
 */
const BROAD_PRIORITY = 9;

export type RegionCode =
  | 'seongsu'
  | 'hannam'
  | 'apgujeong'
  | 'hongdae'
  | 'gangnam'
  | 'itaewon'
  | 'jamsil'
  | 'yeouido'
  | 'myeongdong'
  | 'seongbuk'
  | 'mapo'
  | 'yongsan'
  | 'other';

export type RegionDef = {
  code: RegionCode;
  /** UI 표시명. */
  label: string;
  /**
   * 영어·일본어 표시명 — 서울에 온 외국인이 가장 먼저 필요로 하는 정보다.
   *
   * <p>팝업 이름·설명은 크롤링한 한국어 원문이라 그대로 두지만, <b>지역만은 옮긴다.</b> 어느 동네
   * 얘기인지 모르면 목록 자체가 읽히지 않는다. 지역은 열한 곳뿐이라 손으로 정확히 넣을 수 있고,
   * 자동 번역과 달리 고유명사가 엉뚱하게 바뀔 일이 없다.
   *
   * <p>일본어는 <b>가타카나 음역</b>을 쓴다. 한자를 붙이고 싶어지지만(성수동 = 聖水洞) 잘못 쓰면
   * 일본인에게 다른 지명이 되고, 일본 여행 콘텐츠도 대체로 음역을 쓴다.
   */
  labelEn: string;
  labelJa: string;
  /** SEO 슬러그 (URL). */
  slug: string;
  /** 우선순위 — 낮을수록 더 좁고 구체적인 매칭. 점수 같을 때 동률 깨기. */
  priority: number;
  /**
   * 매칭 키워드. substring 매칭이라 더 긴 / 더 구체적인 키워드를 앞에 놓는다.
   * 행정구역명("성동구") 이 아니라 동네·거리·건물 이름만 여기 넣는다.
   */
  keywords: string[];
  /**
   * 행정구역 단독 키워드 — 규칙 4의 예외를 모아 두는 곳.
   *
   * <p>항상 {@link BROAD_PRIORITY} 로 평가되므로 <b>어떤 동네 키워드에도 진다.</b> 동네명이 적힌
   * 팝업은 그 동네로 가고, {@code "서울 성동구"} 처럼 구 이름만 적힌 팝업만 여기로 떨어진다.
   *
   * <p>이게 없으면 그런 팝업이 전부 {@code other} 로 빠진다 — 실측 992건 중 296건이 그랬다.
   */
  broadKeywords?: string[];
};

/**
 * 등록된 region 정의. 우선순위 작은 순으로 매칭.
 * priority 1-10: 명확한 동네. 99: fallback (other).
 *
 * <p><b>서울 밖(부산·경기·인천 등)은 여기에 넣지 않는다.</b> 2026-07 트렌드에 "부산 팝업 스토어" 가
 * 떠 있고 운영 DB 에도 부산 8건 / 경기 24건이 실재하지만, 이 배열에 광역 지역을 추가하면 세 군데가
 * 동시에 깨진다.
 *
 * <ul>
 *   <li>지도가 따라오지 않는다. {@code region=} 딥링크는 마커를 걸러내기만 하고 시점(viewport)은
 *       건드리지 않는다(src/components/Map/InteractiveMap.tsx — region 필터 경로에 fitToPoints 호출이
 *       없고 지도는 서울 고정 center 로 열린다). 랜딩의 "지도에서 부산 팝업 보기" 를 누르면 서울 화면에
 *       핀이 하나도 없는 빈 지도가 나온다. 홈 BROWSE 모달의 "지도에서 보기" 도 같은 경로다.
 *   <li>키워드가 어긋나면 조용히 빈 페이지가 된다. v2.53 부터 0곳 지역은 noindex + sitemap 제외라
 *       thin page 로 색인되지는 않지만, 그건 <b>빈 페이지를 감추는 것이지 만들지 않는 게 아니다.</b>
 *       광역 키워드는 정확도를 검증할 데이터 자체가 부족하다(아래 셋째 항목).
 *   <li>이 파일의 전제와 충돌한다. 위 규칙 4가 "행정구역 단독으로는 매칭 안 함" 인데 '부산'·'경기' 는
 *       정확히 그 광역 단독 매칭이다. 동네 단위 정확도("성수인데 한남 들어가면 안 됨")를 위해 만든
 *       priority 체계에 상위 개념을 끼워 넣으면 동률 규칙이 의미를 잃는다.
 * </ul>
 *
 * <p>참고로 "부산 포켓몬 팝업" 류 수요는 이미 브랜드 축이 받는다 — 브랜드 매칭은 이름 + 위치를 함께
 * 훑으므로 부산에서 열린 포켓몬 팝업도 /popups/pokemon 에 잡힌다. 서울 밖을 제대로 다루려면 이 배열이
 * 아니라 지도 viewport 이동까지 포함한 별도 광역 축이 필요하다.
 */
export const REGIONS: RegionDef[] = [
  {
    code: 'seongsu',
    label: '성수',
    labelEn: 'Seongsu',
    labelJa: 'ソンス',
    slug: 'seongsu',
    priority: 1,
    keywords: [
      '성수동',
      '성수1가',
      '성수2가',
      '성수일로',
      '성수이로',
      '성수로',
      '성수',
      '연무장',
      '서울숲',
      '뚝섬',
      '아차산로',
      // '왕십리' 단독이 아니라 '왕십리로' 다. 행당동 왕십리역 일대까지 끌어오지 않기 위해서.
      '왕십리로',
    ],
    broadKeywords: ['성동구'],
  },
  {
    code: 'hannam',
    label: '한남',
    labelEn: 'Hannam',
    labelJa: 'ハンナム',
    slug: 'hannam',
    priority: 1,
    keywords: ['한남동', '한남대로', '한남오거리', '한남'],
  },
  {
    code: 'apgujeong',
    label: '압구정',
    labelEn: 'Apgujeong',
    labelJa: 'アックジョン',
    slug: 'apgujeong',
    priority: 1,
    keywords: ['압구정동', '압구정로', '압구정역', '청담동', '청담로', '압구정', '청담'],
  },
  {
    code: 'hongdae',
    label: '홍대',
    labelEn: 'Hongdae',
    labelJa: 'ホンデ',
    slug: 'hongdae',
    priority: 1,
    keywords: [
      '홍대',
      '홍익대',
      '서교동',
      '서교',
      '동교동',
      '상수동',
      '합정동',
      '와우산로',
      '양화로',
    ],
  },
  {
    code: 'gangnam',
    label: '강남',
    labelEn: 'Gangnam',
    labelJa: 'カンナム',
    slug: 'gangnam',
    priority: 2,
    keywords: [
      '강남역',
      '강남대로',
      '역삼동',
      '역삼로',
      '신사동',
      '논현동',
      '논현로',
      '테헤란로',
      '선릉',
      '삼성역',
      '삼성동',
      '대치동',
      '도곡',
      // '코엑스' 단독 금지 — '코엑스 마곡'(강서구)이 딸려 온다. 몰 이름으로 좁힌다.
      '코엑스몰',
      '무역센터',
      '가로수길',
    ],
    broadKeywords: ['강남구'],
  },
  {
    code: 'itaewon',
    label: '이태원',
    labelEn: 'Itaewon',
    labelJa: 'イテウォン',
    slug: 'itaewon',
    priority: 1,
    keywords: ['이태원동', '이태원로', '이태원역', '녹사평', '경리단길', '이태원'],
  },
  {
    code: 'jamsil',
    label: '잠실',
    labelEn: 'Jamsil',
    labelJa: 'チャムシル',
    slug: 'jamsil',
    priority: 1,
    keywords: [
      '잠실동',
      '잠실로',
      '잠실역',
      '송파대로',
      '올림픽로',
      '롯데월드',
      '롯데월드몰',
      '잠실',
      '석촌',
    ],
    broadKeywords: ['송파구'],
  },
  {
    code: 'yeouido',
    label: '여의도',
    labelEn: 'Yeouido',
    labelJa: 'ヨイド',
    slug: 'yeouido',
    priority: 1,
    keywords: [
      '여의도동',
      '여의대로',
      '여의도역',
      '여의나루',
      '여의도',
      '여의동',
      // '더현대' 단독 금지 — '서울 강동구 더현대' 같은 오염 레코드가 붙는다.
      '더현대 서울',
      '더현대서울',
      'IFC몰',
      '파크원',
    ],
  },
  {
    code: 'myeongdong',
    label: '명동',
    labelEn: 'Myeongdong',
    labelJa: 'ミョンドン',
    slug: 'myeongdong',
    priority: 1,
    keywords: ['명동', '을지로입구', '남대문로', '을지로', '소공동', '충무로', '회현'],
    broadKeywords: ['중구'],
  },
  {
    code: 'seongbuk',
    label: '성북',
    labelEn: 'Seongbuk',
    labelJa: 'ソンブク',
    slug: 'seongbuk',
    priority: 2,
    keywords: ['성북동', '성북로', '안암동', '안암로'],
    broadKeywords: ['성북구'],
  },
  {
    code: 'mapo',
    label: '마포',
    labelEn: 'Mapo',
    labelJa: 'マポ',
    slug: 'mapo',
    priority: 3,
    keywords: ['공덕동', '마포대로', '용강동', '연남동', '망원동', '망원역', '상암'],
    broadKeywords: ['마포구'],
  },
  /**
   * v2.48 — 트렌드 검색어에 "용산 팝업 스토어" 가 잡히는데 받을 지역 랜딩이 없었다. 운영 데이터에도
   * 60건이 있다(그중 50건이 주소에 '용산구').
   *
   * <p><b>이 파일 규칙 4("행정구역 단독으로는 매칭 안 함")의 예외다.</b> 성동구·마포구와 달리 '용산'
   * 은 사람들이 실제로 검색하는 동네 이름이고(용산역·아이파크몰), 주소에 동네명 없이 "서울 용산구"
   * 로만 적힌 팝업이 상당수라 이걸 빼면 60건이 어디에도 안 잡힌다.
   *
   * <p>한남동·이태원동은 <b>모두 용산구 안에 있다.</b> 그래서 '용산구' 키워드는 그 팝업들에도 걸린다.
   * v2.53 부터 이건 {@link RegionDef.broadKeywords} 로 옮겼다 — 그전에는 region 전체 priority 를
   * 3으로 낮춰 회피했는데, 그 방식은 예외가 하나일 때만 통한다. 지금은 강남·성동·마포·중구·송파도
   * 같은 예외가 필요하고, region 단위로 낮추면 그 지역의 동네 키워드까지 함께 약해진다.
   */
  {
    code: 'yongsan',
    label: '용산',
    labelEn: 'Yongsan',
    labelJa: 'ヨンサン',
    slug: 'yongsan',
    priority: 3,
    keywords: ['용산역', '아이파크몰', '한강대로', '삼각지', '이촌동', '서빙고'],
    broadKeywords: ['용산구'],
  },
];

/**
 * 주소 문자열에서 가장 적합한 region 1개 반환.
 * 매칭 못 하면 "other" (UI 에서는 카운트만 노출, 슬라이스 카드는 만들지 않음).
 */
export function classifyRegion(location: string | null | undefined): RegionCode {
  if (!location) return 'other';
  const text = location.trim();
  if (!text) return 'other';

  let best: { code: RegionCode; priority: number; keywordLen: number } | null = null;

  for (const region of REGIONS) {
    // 행정구역 단독 키워드는 BROAD_PRIORITY 로 평가한다 — 동네 키워드에는 항상 진다.
    const candidates: [kw: string, priority: number][] = [
      ...region.keywords.map((kw): [string, number] => [kw, region.priority]),
      ...(region.broadKeywords ?? []).map((kw): [string, number] => [kw, BROAD_PRIORITY]),
    ];

    for (const [kw, priority] of candidates) {
      if (text.includes(kw)) {
        const candidate = { code: region.code, priority, keywordLen: kw.length };
        if (!best) {
          best = candidate;
          continue;
        }
        // 더 좁은 priority 우선, 같으면 더 긴 keyword (더 구체적) 우선.
        if (
          candidate.priority < best.priority ||
          (candidate.priority === best.priority && candidate.keywordLen > best.keywordLen)
        ) {
          best = candidate;
        }
      }
    }
  }

  return best?.code ?? 'other';
}

/** UI 헬퍼: code → label / slug. */
export function regionLabel(code: RegionCode): string {
  return REGIONS.find((r) => r.code === code)?.label ?? '기타';
}

export function regionBySlug(slug: string): RegionDef | undefined {
  return REGIONS.find((r) => r.slug === slug);
}
