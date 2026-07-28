/**
 * v2.21 — 팝업 위치(주소) 문자열로 동네 분류.
 *
 * 사용자 요구: 성수인데 한남 들어가면 안 됨. 그래서 다음 규칙을 따른다.
 *
 *  1. 각 region 에 명확한 keyword 배열 + 정확도 우선순위 (priority) 부여.
 *  2. 매칭 시 모든 region 을 순회하여 "가장 정확한 한 곳" 만 반환 (첫 매치 X).
 *  3. 같은 점수면 priority 낮은 (= 더 좁은 지역) 쪽 우선. 예: "성수동 한남대로" → 성수
 *     ("성수동" 이 "한남" 보다 더 구체적인 동네 매칭).
 *  4. 행정구역 단독 (예: "성동구") 으로는 매칭 안 함 — 동네명이 명시돼야 슬라이스 카운트.
 *
 * 약관 §10-2 와 일관: 이 분류는 자체 보관 위치 텍스트만 사용. 외부 검색 API 호출 없음.
 */

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
   * 행정구역명("성동구") 보다 동네명("성수동") 이 우선.
   */
  keywords: string[];
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
 *   <li>0건이어도 색인된다. app/popups/[slug]/page.tsx 가 noindex 를 붙이는 대상은 brand 와
 *       region-category 뿐이라, region 슬러그는 결과가 0곳이어도 sitemap 에 그대로 올라간다. 광역
 *       키워드를 잘못 잡으면 thin page 를 제 손으로 색인시키는 셈이다.
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
    keywords: ['성수동', '성수1가', '성수2가', '성수일로', '성수이로', '성수로'],
  },
  {
    code: 'hannam',
    label: '한남',
    labelEn: 'Hannam',
    labelJa: 'ハンナム',
    slug: 'hannam',
    priority: 1,
    keywords: ['한남동', '한남대로', '한남오거리'],
  },
  {
    code: 'apgujeong',
    label: '압구정',
    labelEn: 'Apgujeong',
    labelJa: 'アックジョン',
    slug: 'apgujeong',
    priority: 1,
    keywords: ['압구정동', '압구정로', '압구정역', '청담동', '청담로'],
  },
  {
    code: 'hongdae',
    label: '홍대',
    labelEn: 'Hongdae',
    labelJa: 'ホンデ',
    slug: 'hongdae',
    priority: 1,
    keywords: ['홍대', '홍익대', '서교동', '동교동', '상수동', '합정동', '와우산로', '양화로'],
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
    ],
  },
  {
    code: 'itaewon',
    label: '이태원',
    labelEn: 'Itaewon',
    labelJa: 'イテウォン',
    slug: 'itaewon',
    priority: 1,
    keywords: ['이태원동', '이태원로', '이태원역', '녹사평', '경리단길'],
  },
  {
    code: 'jamsil',
    label: '잠실',
    labelEn: 'Jamsil',
    labelJa: 'チャムシル',
    slug: 'jamsil',
    priority: 1,
    keywords: ['잠실동', '잠실로', '잠실역', '송파대로', '올림픽로', '롯데월드'],
  },
  {
    code: 'yeouido',
    label: '여의도',
    labelEn: 'Yeouido',
    labelJa: 'ヨイド',
    slug: 'yeouido',
    priority: 1,
    keywords: ['여의도동', '여의대로', '여의도역', '여의나루'],
  },
  {
    code: 'myeongdong',
    label: '명동',
    labelEn: 'Myeongdong',
    labelJa: 'ミョンドン',
    slug: 'myeongdong',
    priority: 1,
    keywords: ['명동', '을지로입구', '남대문로'],
  },
  {
    code: 'seongbuk',
    label: '성북',
    labelEn: 'Seongbuk',
    labelJa: 'ソンブク',
    slug: 'seongbuk',
    priority: 2,
    keywords: ['성북동', '성북로', '안암동', '안암로'],
  },
  {
    code: 'mapo',
    label: '마포',
    labelEn: 'Mapo',
    labelJa: 'マポ',
    slug: 'mapo',
    priority: 3,
    keywords: ['공덕동', '마포대로', '용강동'],
  },
  /**
   * v2.48 — 트렌드 검색어에 "용산 팝업 스토어" 가 잡히는데 받을 지역 랜딩이 없었다. 운영 데이터에도
   * 60건이 있다(그중 50건이 주소에 '용산구').
   *
   * <p><b>이 파일 규칙 4("행정구역 단독으로는 매칭 안 함")의 예외다.</b> 성동구·마포구와 달리 '용산'
   * 은 사람들이 실제로 검색하는 동네 이름이고(용산역·아이파크몰), 주소에 동네명 없이 "서울 용산구"
   * 로만 적힌 팝업이 상당수라 이걸 빼면 60건이 어디에도 안 잡힌다.
   *
   * <p>한남동·이태원동은 <b>모두 용산구 안에 있다.</b> 그래서 '용산구' 키워드는 그 팝업들에도 걸리는데,
   * 이 파일의 동률 규칙이 이미 이를 처리한다 — 한남·이태원은 priority 1 이라 priority 3 인 여기를
   * 이긴다. 규칙을 어기는 대신 <b>규칙이 감당하도록 우선순위를 넓게</b> 잡았다. 동네명이 명시된
   * 팝업은 그 동네로, "용산구" 로만 적힌 팝업은 여기로 온다.
   */
  {
    code: 'yongsan',
    label: '용산',
    labelEn: 'Yongsan',
    labelJa: 'ヨンサン',
    slug: 'yongsan',
    priority: 3,
    keywords: ['용산구', '용산역', '아이파크몰', '한강대로', '삼각지', '이촌동', '서빙고'],
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
    for (const kw of region.keywords) {
      if (text.includes(kw)) {
        const candidate = { code: region.code, priority: region.priority, keywordLen: kw.length };
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
