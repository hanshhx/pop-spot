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
  | 'other';

export type RegionDef = {
  code: RegionCode;
  /** UI 표시명. */
  label: string;
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
 */
export const REGIONS: RegionDef[] = [
  {
    code: 'seongsu',
    label: '성수',
    slug: 'seongsu',
    priority: 1,
    keywords: ['성수동', '성수1가', '성수2가', '성수일로', '성수이로', '성수로'],
  },
  {
    code: 'hannam',
    label: '한남',
    slug: 'hannam',
    priority: 1,
    keywords: ['한남동', '한남대로', '한남오거리'],
  },
  {
    code: 'apgujeong',
    label: '압구정',
    slug: 'apgujeong',
    priority: 1,
    keywords: ['압구정동', '압구정로', '압구정역', '청담동', '청담로'],
  },
  {
    code: 'hongdae',
    label: '홍대',
    slug: 'hongdae',
    priority: 1,
    keywords: ['홍대', '홍익대', '서교동', '동교동', '상수동', '합정동', '와우산로', '양화로'],
  },
  {
    code: 'gangnam',
    label: '강남',
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
    slug: 'itaewon',
    priority: 1,
    keywords: ['이태원동', '이태원로', '이태원역', '녹사평', '경리단길'],
  },
  {
    code: 'jamsil',
    label: '잠실',
    slug: 'jamsil',
    priority: 1,
    keywords: ['잠실동', '잠실로', '잠실역', '송파대로', '올림픽로', '롯데월드'],
  },
  {
    code: 'yeouido',
    label: '여의도',
    slug: 'yeouido',
    priority: 1,
    keywords: ['여의도동', '여의대로', '여의도역', '여의나루'],
  },
  {
    code: 'myeongdong',
    label: '명동',
    slug: 'myeongdong',
    priority: 1,
    keywords: ['명동', '을지로입구', '남대문로'],
  },
  {
    code: 'seongbuk',
    label: '성북',
    slug: 'seongbuk',
    priority: 2,
    keywords: ['성북동', '성북로', '안암동', '안암로'],
  },
  {
    code: 'mapo',
    label: '마포',
    slug: 'mapo',
    priority: 3,
    keywords: ['공덕동', '마포대로', '용강동'],
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
