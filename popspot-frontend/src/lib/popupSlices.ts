/**
 * v2.21 — 시점 / 카테고리 슬라이싱 유틸. 메인 BROWSE 섹션 및 SEO 랜딩 페이지에서 공통 사용.
 *
 * <p>모든 함수는 순수 — 입력 배열만으로 결과 도출, 외부 호출 없음. 시점 판정은 클라이언트
 * 로컬 시간 기준 (KST 사용자 가정).
 */

export type PeriodCode = "today" | "tomorrow" | "this-week" | "this-weekend" | "this-month";

export type PeriodDef = {
  code: PeriodCode;
  label: string;
  slug: string;
};

/**
 * v2.21-S5 — 시점 슬라이스 동적 라벨 생성.
 *
 * <p>호출 시점의 날짜로 라벨 갱신:
 *
 * <ul>
 *   <li>오늘 → "오늘 (5/27 화)"
 *   <li>내일 → "내일 (5/28 수)"
 *   <li>이번 주 → "이번 주 (5/26~6/1)"
 *   <li>주말 → "이번 주말 (5/31)" 또는 "다음 주말 (6/7)"
 *   <li>이번 달 → "5월" → 6월 되면 자동으로 "6월"
 * </ul>
 *
 * <p>SSG generateStaticParams 도 슬러그만 쓰고 라벨은 무관 — 빌드 타임에 박힌 라벨이
 * stale 돼도 슬러그 / URL 은 안 바뀜. 메인 페이지 BROWSE 는 클라이언트 사이드 호출이라
 * 즉시 갱신.
 */
export function getPeriods(now: Date = new Date()): PeriodDef[] {
  const md = (d: Date) => `${d.getMonth() + 1}/${d.getDate()}`;
  const dow = (d: Date) => ["일", "월", "화", "수", "목", "금", "토"][d.getDay()];

  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  // 이번 주: 월요일 ~ 일요일
  const offsetToMon = (today.getDay() + 6) % 7;
  const weekStart = new Date(today);
  weekStart.setDate(weekStart.getDate() - offsetToMon);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);

  // 이번 / 다음 주말: 토요일 기준. 일요일이면 "다음 주말".
  const offsetToSat = (6 - today.getDay() + 7) % 7;
  const saturday = new Date(today);
  saturday.setDate(saturday.getDate() + offsetToSat);
  const weekendLabel =
    today.getDay() === 0
      ? `다음 주말 (${md(saturday)})`
      : `이번 주말 (${md(saturday)})`;

  return [
    { code: "today", label: `오늘 (${md(today)} ${dow(today)})`, slug: "today" },
    { code: "tomorrow", label: `내일 (${md(tomorrow)} ${dow(tomorrow)})`, slug: "tomorrow" },
    {
      code: "this-week",
      label: `이번 주 (${md(weekStart)}~${md(weekEnd)})`,
      slug: "this-week",
    },
    { code: "this-weekend", label: weekendLabel, slug: "this-weekend" },
    { code: "this-month", label: `${today.getMonth() + 1}월`, slug: "this-month" },
  ];
}

/**
 * 기존 PERIODS 호환성 — 슬러그 / 코드만 필요한 곳용 (generateStaticParams 등).
 * 라벨은 빌드 타임 기준이라 사용자 표시에는 getPeriods() 사용 권장.
 */
export const PERIODS: PeriodDef[] = getPeriods();

export type CategoryCode =
  | "fashion"
  | "beauty"
  | "character"
  | "dessert"
  | "lifestyle"
  | "art"
  | "tech"
  | "other";

export type CategoryDef = {
  code: CategoryCode;
  label: string;
  slug: string;
  /** 한국어 카테고리 원문 매칭 키워드. 백엔드 category 필드가 자유 텍스트라 substring 매칭. */
  keywords: string[];
};

// 순서·명칭을 지도 카테고리와 통일: 캐릭터-패션-뷰티-푸드-문화-(라이프·테크).
// 라벨만 조정(디저트→푸드, 아트→문화)하고 slug/code/keywords 는 유지 → 기존 SEO 랜딩 URL 보존.
export const CATEGORIES: CategoryDef[] = [
  {
    code: "character",
    label: "캐릭터",
    slug: "character",
    keywords: ["캐릭터", "굿즈", "애니", "character", "CHARACTER"],
  },
  {
    code: "fashion",
    label: "패션",
    slug: "fashion",
    keywords: ["패션", "의류", "잡화", "fashion", "FASHION"],
  },
  {
    code: "beauty",
    label: "뷰티",
    slug: "beauty",
    keywords: ["뷰티", "화장품", "코스메틱", "beauty", "BEAUTY"],
  },
  {
    code: "dessert",
    label: "푸드",
    slug: "dessert",
    keywords: ["디저트", "베이커리", "카페", "푸드", "음료", "dessert", "FOOD"],
  },
  {
    code: "art",
    label: "문화",
    slug: "art",
    keywords: ["아트", "전시", "갤러리", "art", "CULTURE"],
  },
  {
    code: "lifestyle",
    label: "라이프",
    slug: "lifestyle",
    keywords: ["라이프", "리빙", "홈", "lifestyle"],
  },
  {
    code: "tech",
    label: "테크",
    slug: "tech",
    keywords: ["테크", "전자", "IT", "tech"],
  },
];

/* ============================== 시점 ============================== */

/** ISO yyyy-MM-dd 또는 yyyy.MM.dd 또는 null 안전 파싱. */
/**
 * 날짜 문자열 → Date. 달력에 실재하는 날짜만 통과시킨다.
 *
 * <p>{@code new Date(y, m-1, d)} 는 범위를 넘는 값을 조용히 이월한다 — {@code 2026-02-31} 은 3월 3일이,
 * {@code 2026-99-99} 는 몇 년 뒤가 된다. 크롤러가 원문에서 뽑은 날짜라 이런 값이 들어올 수 있는데,
 * 이월된 날짜로 D-day 를 계산하면 이미 끝난 팝업이 '진행 중' 으로 보인다.
 * 만들어진 Date 의 연·월·일이 입력과 같은지 되돌려 확인해 그런 값을 걸러낸다.
 */
export function parseDate(s: string | null | undefined): Date | null {
  if (!s) return null;
  const normalized = s.trim().replace(/\./g, "-").slice(0, 10);
  const parts = normalized.split("-");
  if (parts.length !== 3) return null;
  const [y, m, d] = parts.map((v) => Number.parseInt(v, 10));
  if (!y || !m || !d) return null;
  const date = new Date(y, m - 1, d);
  // 이월이 일어났으면 입력과 달라진다 → 존재하지 않는 날짜.
  if (date.getFullYear() !== y || date.getMonth() !== m - 1 || date.getDate() !== d) return null;
  return date;
}

/** KST(UTC+9) 기준 오늘 00:00. 서버 TZ(Vercel=UTC)·브라우저 TZ 와 무관하게 KST 달력 날짜를 쓴다. */
export function kstTodayStart(): Date {
  const k = new Date(Date.now() + 9 * 3600 * 1000);
  return new Date(k.getUTCFullYear(), k.getUTCMonth(), k.getUTCDate());
}

/**
 * 이미 끝난 팝업인가. 종료일이 없거나 해석 불가면 false — 날짜 미상일 뿐 종료 근거가 아니므로
 * 추측해서 숨기지 않는다.
 */
export function isExpired(endDate: string | null | undefined, today: Date): boolean {
  const end = parseDate(endDate);
  if (!end) return false;
  return startOfDay(end).getTime() < today.getTime();
}

export function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/** 팝업이 특정 날짜에 열려있나? start ≤ date ≤ end. */
function isOpenOn(start: Date | null, end: Date | null, date: Date): boolean {
  if (!start || !end) return false;
  const t = date.getTime();
  return start.getTime() <= t && t <= end.getTime();
}

/** 어느 시점 슬라이스에 속하는지. 여러 슬라이스에 동시에 포함될 수 있음 (오늘 = 이번 주 = 이번 달). */
export function matchesPeriod(
  startDate: string | null | undefined,
  endDate: string | null | undefined,
  period: PeriodCode,
  now: Date = new Date(),
): boolean {
  const start = parseDate(startDate);
  const end = parseDate(endDate);
  if (!start || !end) return false;

  const today = startOfDay(now);
  const day = today.getDay(); // 0 일 ~ 6 토

  switch (period) {
    case "today":
      return isOpenOn(start, end, today);
    case "tomorrow": {
      const t = new Date(today);
      t.setDate(t.getDate() + 1);
      return isOpenOn(start, end, t);
    }
    case "this-week": {
      // 월요일 ~ 일요일 범위 중 단 하루라도 겹치면 매치.
      const weekStart = new Date(today);
      const offsetToMon = (day + 6) % 7; // 일=0 → 6, 월=1 → 0
      weekStart.setDate(weekStart.getDate() - offsetToMon);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 6);
      return start <= weekEnd && end >= weekStart;
    }
    case "this-weekend": {
      // 토~일 두 날 중 하나라도 열리면.
      const weekStart = new Date(today);
      const offsetToSat = (6 - day + 7) % 7;
      weekStart.setDate(weekStart.getDate() + offsetToSat);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 1);
      return start <= weekEnd && end >= weekStart;
    }
    case "this-month": {
      const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
      const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);
      return start <= monthEnd && end >= monthStart;
    }
  }
}

/* ============================== 카테고리 ============================== */

export function classifyCategory(category: string | null | undefined): CategoryCode {
  if (!category) return "other";
  const text = category.trim().toLowerCase();
  if (!text) return "other";

  for (const cat of CATEGORIES) {
    for (const kw of cat.keywords) {
      if (text.includes(kw.toLowerCase())) return cat.code;
    }
  }
  return "other";
}

export function categoryLabel(code: CategoryCode): string {
  return CATEGORIES.find((c) => c.code === code)?.label ?? "기타";
}

export function categoryBySlug(slug: string): CategoryDef | undefined {
  return CATEGORIES.find((c) => c.slug === slug);
}

/* ============================== 브랜드 / IP / 장소 (검색 트렌드 기반) ============================== */

export type BrandDef = {
  slug: string;
  label: string;
  /** 팝업 이름/위치에 이 중 하나라도 포함되면 매칭(대소문자 무시). */
  keywords: string[];
};

/**
 * 사람들이 많이 검색하는 IP·캐릭터·장소 브랜드. 각 slug 는 {@code /popups/[slug]} 브랜드 랜딩이 되고,
 * 매칭 팝업이 0곳이면 thin content 방지로 noindex(진행 중일 때만 색인). 구글 트렌드(2026-07) 고관심·급상승어 기반.
 */
export const BRANDS: BrandDef[] = [
  { slug: "stellive", label: "스텔라이브", keywords: ["스텔라이브", "스텔 라이브"] },
  { slug: "overwatch", label: "오버워치", keywords: ["오버워치", "오버 워치", "overwatch", "옵치"] },
  { slug: "pokemon", label: "포켓몬", keywords: ["포켓몬", "pokemon", "피카츄", "메타몽", "이브이"] },
  {
    slug: "sanrio",
    label: "산리오",
    keywords: ["산리오", "sanrio", "쿠로미", "시나모롤", "마이멜로디", "폼폼푸린", "헬로키티", "포차코"],
  },
  { slug: "genshin", label: "원신", keywords: ["원신", "genshin"] },
  { slug: "toy-story", label: "토이스토리", keywords: ["토이스토리", "토이 스토리", "toy story"] },
  { slug: "demon-slayer", label: "귀멸의 칼날", keywords: ["귀멸의 칼날", "귀멸의칼날", "귀칼"] },
  { slug: "jujutsu-kaisen", label: "주술회전", keywords: ["주술회전", "주술 회전"] },
  { slug: "nikke", label: "니케", keywords: ["니케", "nikke"] },
  { slug: "project-sekai", label: "프로젝트 세카이", keywords: ["프로젝트 세카이", "프세카", "project sekai"] },
  { slug: "hatsune-miku", label: "하츠네 미쿠", keywords: ["하츠네 미쿠", "하츠네미쿠", "미쿠", "miku"] },
  { slug: "djmax", label: "디맥", keywords: ["디맥", "djmax", "디제이맥스"] },
  { slug: "roblox", label: "로블록스", keywords: ["로블록스", "roblox"] },
  { slug: "blue-archive", label: "블루아카이브", keywords: ["블루아카이브", "블루 아카이브", "블아"] },
  { slug: "disney", label: "디즈니", keywords: ["디즈니", "disney"] },
  { slug: "kakao-friends", label: "카카오프렌즈", keywords: ["카카오프렌즈", "춘식이"] },
  { slug: "line-friends", label: "라인프렌즈", keywords: ["라인프렌즈"] },
  { slug: "one-piece", label: "원피스", keywords: ["원피스", "one piece"] },
  // 2026-07 트렌드 신규 — 좀비고는 "팝업 스토어" 다음가는 검색량(35)으로 급상승 중.
  {
    slug: "zombie-high",
    label: "좀비고등학교",
    keywords: ["좀비고", "좀비 고", "좀비고등학교"],
  },
  { slug: "kim-hamzzi", label: "김햄찌", keywords: ["김햄찌", "김 햄찌"] },
  { slug: "oasis", label: "오아시스", keywords: ["오아시스", "oasis"] },
  { slug: "tft", label: "롤토체스", keywords: ["롤체", "롤토체스", "teamfight"] },
  {
    slug: "arknights",
    label: "명일방주",
    keywords: ["명일방주", "명방", "arknights"],
  },
  { slug: "t1", label: "T1", keywords: ["t1 팝업", "티원"] },
  { slug: "the-hyundai", label: "더현대 서울", keywords: ["더현대", "더 현대"] },
  { slug: "yongsan-ipark", label: "용산 아이파크몰", keywords: ["용산 아이파크", "아이파크몰"] },
  { slug: "coex", label: "코엑스", keywords: ["코엑스", "coex"] },
  { slug: "starfield", label: "스타필드", keywords: ["스타필드"] },
  { slug: "lotte-world-mall", label: "롯데월드몰", keywords: ["롯데월드몰", "롯데월드 몰"] },
  { slug: "ak-plaza", label: "AK플라자", keywords: ["ak플라자", "ak 플라자"] },
  // 2026-07 트렌드 신규(최근 3개월 급상승·고관심) — 넥슨·호요버스·애니·K-pop IP 다수.
  { slug: "maplestory", label: "메이플스토리", keywords: ["메이플스토리", "메이플 스토리", "메이플", "maplestory"] },
  { slug: "honkai-star-rail", label: "붕괴 스타레일", keywords: ["스타레일", "스타 레일", "붕괴 스타레일", "honkai"] },
  { slug: "umamusume", label: "우마무스메", keywords: ["우마무스메", "우마 무스메", "umamusume"] },
  { slug: "wuthering-waves", label: "명조", keywords: ["명조", "wuthering"] },
  { slug: "chiikawa", label: "치이카와", keywords: ["치이카와", "치이 카와", "chiikawa"] },
  { slug: "naruto", label: "나루토", keywords: ["나루토", "naruto"] },
  { slug: "jojo", label: "죠죠", keywords: ["죠죠", "조조의 기묘한", "jojo"] },
  { slug: "dungeon-meshi", label: "던전밥", keywords: ["던전밥", "던전 밥"] },
  { slug: "yumeiro-patissiere", label: "꿈빛 파티시엘", keywords: ["꿈빛 파티시엘", "꿈빛파티시엘"] },
  { slug: "nmixx", label: "엔믹스", keywords: ["엔믹스", "nmixx"] },
  { slug: "yorushika", label: "요루시카", keywords: ["요루시카", "요루 시카", "yorushika"] },
  { slug: "sega", label: "세가", keywords: ["세가", "sega"] },
  // 2026-07 트렌드 3차(최근 1달·1주 급상승, 웹리서치로 정체 확인 + 충돌 없는 키워드).
  { slug: "omniscient-reader", label: "전지적 독자 시점", keywords: ["전독시", "전지적 독자", "전지적독자"] },
  { slug: "lookism", label: "외모지상주의", keywords: ["외모지상주의", "외지주"] },
  { slug: "hearts2hearts", label: "하츠투하츠", keywords: ["하츠투하츠", "하투하", "hearts2hearts"] },
  { slug: "alien-stage", label: "에일리언 스테이지", keywords: ["에일리언 스테이지", "에이스테", "alien stage"] },
  { slug: "cutie-street", label: "큐티 스트리트", keywords: ["큐티 스트리트", "cutie street", "큐스토"] },
  { slug: "ghost-story-commute", label: "괴담출근", keywords: ["괴담출근", "괴담에 떨어져도 출근", "괴출 팝업"] },
  { slug: "minive", label: "미니브", keywords: ["미니브", "minive"] },
  { slug: "angyeong-mandu", label: "안경만두", keywords: ["안경만두"] },
  { slug: "ganadi", label: "가나디", keywords: ["가나디"] },
  { slug: "latale", label: "라테일", keywords: ["라테일"] },
  { slug: "street-restaurant-fighter", label: "스트릿 레스토랑 파이터", keywords: ["스트릿 레스토랑 파이터", "스트릿레스토랑파이터"] },
  { slug: "gintama", label: "은혼", keywords: ["은혼", "긴타마", "gintama"] },
  { slug: "hells-kitchen", label: "헬스키친", keywords: ["헬스키친"] },
  { slug: "digimon", label: "디지몬", keywords: ["디지몬", "digimon"] },
  { slug: "spider-man", label: "스파이더맨", keywords: ["스파이더맨", "spider-man", "spiderman"] },
  { slug: "ive", label: "아이브", keywords: ["아이브"] },
  { slug: "fromis-9", label: "프로미스나인", keywords: ["프로미스나인", "fromis_9", "fromis"] },
  { slug: "yoasobi", label: "요아소비", keywords: ["요아소비", "yoasobi"] },
  { slug: "project-i", label: "프로젝트아이", keywords: ["프로젝트아이", "프로젝트 아이", "프젝아"] },
  { slug: "offside", label: "오프사이드", keywords: ["오프사이드"] },
];

const BRAND_BY_SLUG = new Map(BRANDS.map((b) => [b.slug, b]));

export function brandBySlug(slug: string): BrandDef | undefined {
  return BRAND_BY_SLUG.get(slug);
}

export function periodBySlug(slug: string): PeriodDef | undefined {
  return PERIODS.find((p) => p.slug === slug);
}
