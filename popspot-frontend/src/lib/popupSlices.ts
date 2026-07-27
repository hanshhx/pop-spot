/**
 * v2.21 — 시점 / 카테고리 슬라이싱 유틸. 메인 BROWSE 섹션 및 SEO 랜딩 페이지에서 공통 사용.
 *
 * <p>모든 함수는 순수 — 입력 배열만으로 결과 도출, 외부 호출 없음. 시점 판정은 클라이언트
 * 로컬 시간 기준 (KST 사용자 가정).
 */

export type PeriodCode = 'today' | 'tomorrow' | 'this-week' | 'this-weekend' | 'this-month';

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
  const dow = (d: Date) => ['일', '월', '화', '수', '목', '금', '토'][d.getDay()];

  const today = kstCalendarDate(now);
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
    today.getDay() === 0 ? `다음 주말 (${md(saturday)})` : `이번 주말 (${md(saturday)})`;

  return [
    { code: 'today', label: `오늘 (${md(today)} ${dow(today)})`, slug: 'today' },
    { code: 'tomorrow', label: `내일 (${md(tomorrow)} ${dow(tomorrow)})`, slug: 'tomorrow' },
    {
      code: 'this-week',
      label: `이번 주 (${md(weekStart)}~${md(weekEnd)})`,
      slug: 'this-week',
    },
    { code: 'this-weekend', label: weekendLabel, slug: 'this-weekend' },
    { code: 'this-month', label: `${today.getMonth() + 1}월`, slug: 'this-month' },
  ];
}

/**
 * 기존 PERIODS 호환성 — 슬러그 / 코드만 필요한 곳용 (generateStaticParams 등).
 * 라벨은 빌드 타임 기준이라 사용자 표시에는 getPeriods() 사용 권장.
 */
export const PERIODS: PeriodDef[] = getPeriods();

export type CategoryCode =
  'fashion' | 'beauty' | 'character' | 'dessert' | 'lifestyle' | 'art' | 'tech' | 'other';

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
    code: 'character',
    label: '캐릭터',
    slug: 'character',
    keywords: ['캐릭터', '굿즈', '애니', 'character', 'CHARACTER'],
  },
  {
    code: 'fashion',
    label: '패션',
    slug: 'fashion',
    keywords: ['패션', '의류', '잡화', 'fashion', 'FASHION'],
  },
  {
    code: 'beauty',
    label: '뷰티',
    slug: 'beauty',
    keywords: ['뷰티', '화장품', '코스메틱', 'beauty', 'BEAUTY'],
  },
  {
    code: 'dessert',
    label: '푸드',
    slug: 'dessert',
    keywords: ['디저트', '베이커리', '카페', '푸드', '음료', 'dessert', 'FOOD'],
  },
  {
    code: 'art',
    label: '문화',
    slug: 'art',
    keywords: ['아트', '전시', '갤러리', 'art', 'CULTURE'],
  },
  {
    code: 'lifestyle',
    label: '라이프',
    slug: 'lifestyle',
    keywords: ['라이프', '리빙', '홈', 'lifestyle'],
  },
  {
    code: 'tech',
    label: '테크',
    slug: 'tech',
    keywords: ['테크', '전자', 'IT', 'tech'],
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
/** YYYY-M-D (자리수 1~2 허용). 크롤러가 "2026-7-5" 처럼 0 을 뺀 형태로 주는 경우가 있어 열어둔다. */
const DATE_SHAPE = /^(\d{4})-(\d{1,2})-(\d{1,2})$/;

export function parseDate(s: string | null | undefined): Date | null {
  if (!s) return null;

  // 1) 구분자 정규화 후 시각 성분을 떼어낸다("2026-07-25T09:00:00Z", "2026-07-25 09:00").
  //    잘라내기(slice)로 길이를 맞추면 안 된다 — "2026-002-28" 을 "2026-002-2" 로 만들어
  //    2월 2일이라는 엉뚱한 날짜를 조용히 만들어낸다.
  const head = s.trim().replace(/\./g, '-').split(/[T\s]/)[0];

  // 2) 모양을 먼저 확정한다. parseInt 는 "2x" 를 2 로 읽어 "2026-2x-28" 을 2월 28일로
  //    통과시키므로, 숫자 변환 전에 정규식으로 걸러야 한다.
  const match = DATE_SHAPE.exec(head);
  if (!match) return null;

  const y = Number(match[1]);
  const m = Number(match[2]);
  const d = Number(match[3]);
  if (!y || !m || !d) return null;

  // 3) 달력에 실재하는 날짜인지. new Date 는 범위를 넘는 값을 조용히 이월하므로
  //    ("2026-02-31" → 3월 2일, "2026-99-99" → 2034년) 되돌려 대조한다.
  const date = new Date(y, m - 1, d);
  if (date.getFullYear() !== y || date.getMonth() !== m - 1 || date.getDate() !== d) return null;
  return date;
}

/**
 * 임의 시각을 KST 달력 날짜(00:00)로. 서버 TZ(Vercel=UTC)·브라우저 TZ 와 무관하다.
 *
 * <p>v2.43 — {@link getPeriods} 와 {@link matchesPeriod} 가 이 함수 대신 서버 TZ 기준
 * {@code new Date(y, m, d)} 를 쓰고 있었다. 서버가 한국에 있으면 결과가 같아 드러나지 않지만,
 * Vercel(UTC)에서는 <b>매일 KST 00:00~09:00 의 9시간 동안 "오늘" 이 어제가 된다</b>
 * (UTC 7/26 16:30 = KST 7/27 01:30 인데 서버는 7/26 으로 본다). 실제로 배포 직후
 * /popups/jamsil-today 제목이 "오늘 (7/26 일)" 로 나왔다 — KST 로는 7/27 월요일이었다.
 *
 * <p>같은 파일의 {@link isExpired} 는 이미 KST 기준이었다. 한 파일 안에 기준이 두 개 섞여
 * "만료 판정은 오늘, 시점 분류는 어제" 인 상태였다.
 *
 * <p>반환값은 "KST 달력 날짜를 현지 자정으로 표현한" Date 다 — {@link parseDate} 가 날짜
 * 문자열을 같은 방식({@code new Date(y, m-1, d)})으로 만들므로 그대로 비교할 수 있다.
 */
export function kstCalendarDate(now: Date = new Date()): Date {
  const k = new Date(now.getTime() + 9 * 3600 * 1000);
  return new Date(k.getUTCFullYear(), k.getUTCMonth(), k.getUTCDate());
}

/** KST(UTC+9) 기준 오늘 00:00. */
export function kstTodayStart(): Date {
  return kstCalendarDate();
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

/**
 * <b>지금 문이 열려 있는가.</b> 홈 목록·랭킹·지도가 공유하는 단일 기준.
 *
 * <p>v2.44 — 그 전까지는 {@link isExpired} 만 써서 "끝났다는 근거가 없으면 남긴다" 였다. 실측
 * 1,355건 중 <b>864건(64%)이 종료일이 없고 그중 568건은 시작일마저 없어</b>, 랭킹이 "전체 1,355"
 * 로 표시됐다. 서울에 팝업이 그만큼 동시에 열려 있을 리 없다. 본문이 "…성수동에서 열렸다" 처럼
 * 과거형인 것도 섞여 있었다 — 수집 시점에 날짜를 못 뽑은 잔여물이다.
 *
 * <p>기준을 "열려 있다는 근거가 있으면 남긴다" 로 뒤집는다. 제외는 세 가지다.
 *
 * <ul>
 *   <li><b>이미 종료</b> — 원래 하던 일.
 *   <li><b>아직 시작 전</b> — 열려 있지 않다. 캘린더·시점 랜딩(/popups/tomorrow 등)이 예정 팝업을
 *       따로 다루므로 접근 경로는 남는다.
 *   <li><b>날짜 정보가 아예 없음</b> — 열렸다고 볼 근거도 끝났다고 볼 근거도 없다. 예전 주석은
 *       남기는 근거로 "추측해서 지우지 않는다" 를 들었는데, <b>남기는 것도 "열려 있다" 는 추측</b>
 *       이라는 점에서 같다. 둘 중 하나를 골라야 한다면 닫힌 곳을 열렸다고 보여주는 쪽이 더 나쁘다 —
 *       찾아갔는데 없는 경험은 되돌릴 수 없다.
 * </ul>
 *
 * <p>시작일만 있고 종료일이 없는 것은 남긴다 — 상시 운영이거나 종료일만 못 뽑은 경우이고, 적어도
 * "문을 열었다" 는 근거는 있다.
 *
 * <p>이 판정을 한곳에 두는 이유는 이 파일이 원래 말하던 것과 같다 — 화면마다 날짜 해석이 다르면
 * "홈엔 있는데 지도엔 없는" 불일치가 생긴다. 실제로 v2.44 작업 중 홈에만 규칙을 넣었더니 홈 659곳 /
 * 지도 623곳으로 갈렸다.
 */
export function isOpenNow(
  startDate: string | null | undefined,
  endDate: string | null | undefined,
  today: Date,
): boolean {
  const start = parseDate(startDate);
  const end = parseDate(endDate);
  if (!start && !end) return false;
  if (isExpired(endDate, today)) return false;
  if (start && startOfDay(start).getTime() > today.getTime()) return false;
  return true;
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

  // KST 달력 날짜 기준. startOfDay(now) 를 쓰면 서버 TZ 를 따라가 UTC 서버에서 하루가 밀린다
  // (자세한 경위는 kstCalendarDate 주석).
  const today = kstCalendarDate(now);
  const day = today.getDay(); // 0 일 ~ 6 토

  switch (period) {
    case 'today':
      return isOpenOn(start, end, today);
    case 'tomorrow': {
      const t = new Date(today);
      t.setDate(t.getDate() + 1);
      return isOpenOn(start, end, t);
    }
    case 'this-week': {
      // 월요일 ~ 일요일 범위 중 단 하루라도 겹치면 매치.
      const weekStart = new Date(today);
      const offsetToMon = (day + 6) % 7; // 일=0 → 6, 월=1 → 0
      weekStart.setDate(weekStart.getDate() - offsetToMon);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 6);
      return start <= weekEnd && end >= weekStart;
    }
    case 'this-weekend': {
      // 토~일 두 날 중 하나라도 열리면.
      const weekStart = new Date(today);
      const offsetToSat = (6 - day + 7) % 7;
      weekStart.setDate(weekStart.getDate() + offsetToSat);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 1);
      return start <= weekEnd && end >= weekStart;
    }
    case 'this-month': {
      const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
      const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);
      return start <= monthEnd && end >= monthStart;
    }
  }
}

/* ============================== 카테고리 ============================== */

export function classifyCategory(category: string | null | undefined): CategoryCode {
  if (!category) return 'other';
  const text = category.trim().toLowerCase();
  if (!text) return 'other';

  for (const cat of CATEGORIES) {
    for (const kw of cat.keywords) {
      if (text.includes(kw.toLowerCase())) return cat.code;
    }
  }
  return 'other';
}

export function categoryLabel(code: CategoryCode): string {
  return CATEGORIES.find((c) => c.code === code)?.label ?? '기타';
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
  { slug: 'stellive', label: '스텔라이브', keywords: ['스텔라이브', '스텔 라이브'] },
  {
    slug: 'overwatch',
    label: '오버워치',
    keywords: ['오버워치', '오버 워치', 'overwatch', '옵치'],
  },
  {
    slug: 'pokemon',
    label: '포켓몬',
    keywords: ['포켓몬', 'pokemon', '피카츄', '메타몽', '이브이'],
  },
  {
    slug: 'sanrio',
    label: '산리오',
    keywords: [
      '산리오',
      'sanrio',
      '쿠로미',
      '시나모롤',
      '마이멜로디',
      '폼폼푸린',
      '헬로키티',
      '포차코',
    ],
  },
  { slug: 'genshin', label: '원신', keywords: ['원신', 'genshin'] },
  { slug: 'toy-story', label: '토이스토리', keywords: ['토이스토리', '토이 스토리', 'toy story'] },
  { slug: 'demon-slayer', label: '귀멸의 칼날', keywords: ['귀멸의 칼날', '귀멸의칼날', '귀칼'] },
  { slug: 'jujutsu-kaisen', label: '주술회전', keywords: ['주술회전', '주술 회전'] },
  // '승리의 여신' 은 국내 정식 표기(승리의 여신: 니케). 크롤러가 부제를 떼고 앞부분만 실어오면
  // '니케'/'nikke' 로는 못 잡아서 함께 둔다. 문구가 길어 오탐 위험은 사실상 없다.
  { slug: 'nikke', label: '니케', keywords: ['니케', 'nikke', '승리의 여신'] },
  {
    slug: 'project-sekai',
    label: '프로젝트 세카이',
    keywords: ['프로젝트 세카이', '프세카', 'project sekai'],
  },
  {
    slug: 'hatsune-miku',
    label: '하츠네 미쿠',
    keywords: ['하츠네 미쿠', '하츠네미쿠', '미쿠', 'miku'],
  },
  { slug: 'djmax', label: '디맥', keywords: ['디맥', 'djmax', '디제이맥스'] },
  { slug: 'roblox', label: '로블록스', keywords: ['로블록스', 'roblox'] },
  {
    slug: 'blue-archive',
    label: '블루아카이브',
    keywords: ['블루아카이브', '블루 아카이브', '블아'],
  },
  { slug: 'disney', label: '디즈니', keywords: ['디즈니', 'disney'] },
  { slug: 'kakao-friends', label: '카카오프렌즈', keywords: ['카카오프렌즈', '춘식이'] },
  { slug: 'line-friends', label: '라인프렌즈', keywords: ['라인프렌즈'] },
  { slug: 'one-piece', label: '원피스', keywords: ['원피스', 'one piece'] },
  // 2026-07 트렌드 신규 — 좀비고는 "팝업 스토어" 다음가는 검색량(35)으로 급상승 중.
  {
    slug: 'zombie-high',
    label: '좀비고등학교',
    keywords: ['좀비고', '좀비 고', '좀비고등학교'],
  },
  { slug: 'kim-hamzzi', label: '김햄찌', keywords: ['김햄찌', '김 햄찌'] },
  { slug: 'oasis', label: '오아시스', keywords: ['오아시스', 'oasis'] },
  { slug: 'tft', label: '롤토체스', keywords: ['롤체', '롤토체스', 'teamfight'] },
  {
    slug: 'arknights',
    label: '명일방주',
    keywords: ['명일방주', '명방', 'arknights'],
  },
  { slug: 't1', label: 'T1', keywords: ['t1 팝업', '티원'] },
  { slug: 'the-hyundai', label: '더현대 서울', keywords: ['더현대', '더 현대'] },
  { slug: 'yongsan-ipark', label: '용산 아이파크몰', keywords: ['용산 아이파크', '아이파크몰'] },
  { slug: 'coex', label: '코엑스', keywords: ['코엑스', 'coex'] },
  { slug: 'starfield', label: '스타필드', keywords: ['스타필드'] },
  { slug: 'lotte-world-mall', label: '롯데월드몰', keywords: ['롯데월드몰', '롯데월드 몰'] },
  { slug: 'ak-plaza', label: 'AK플라자', keywords: ['ak플라자', 'ak 플라자'] },
  // 2026-07 트렌드 신규(최근 3개월 급상승·고관심) — 넥슨·호요버스·애니·K-pop IP 다수.
  {
    slug: 'maplestory',
    label: '메이플스토리',
    keywords: ['메이플스토리', '메이플 스토리', '메이플', 'maplestory'],
  },
  {
    slug: 'honkai-star-rail',
    label: '붕괴 스타레일',
    keywords: ['스타레일', '스타 레일', '붕괴 스타레일', 'honkai'],
  },
  { slug: 'umamusume', label: '우마무스메', keywords: ['우마무스메', '우마 무스메', 'umamusume'] },
  { slug: 'wuthering-waves', label: '명조', keywords: ['명조', 'wuthering'] },
  { slug: 'chiikawa', label: '치이카와', keywords: ['치이카와', '치이 카와', 'chiikawa'] },
  { slug: 'naruto', label: '나루토', keywords: ['나루토', 'naruto'] },
  { slug: 'jojo', label: '죠죠', keywords: ['죠죠', '조조의 기묘한', 'jojo'] },
  { slug: 'dungeon-meshi', label: '던전밥', keywords: ['던전밥', '던전 밥'] },
  {
    slug: 'yumeiro-patissiere',
    label: '꿈빛 파티시엘',
    keywords: ['꿈빛 파티시엘', '꿈빛파티시엘'],
  },
  { slug: 'nmixx', label: '엔믹스', keywords: ['엔믹스', 'nmixx'] },
  { slug: 'yorushika', label: '요루시카', keywords: ['요루시카', '요루 시카', 'yorushika'] },
  { slug: 'sega', label: '세가', keywords: ['세가', 'sega'] },
  // 2026-07 트렌드 3차(최근 1달·1주 급상승, 웹리서치로 정체 확인 + 충돌 없는 키워드).
  {
    slug: 'omniscient-reader',
    label: '전지적 독자 시점',
    keywords: ['전독시', '전지적 독자', '전지적독자'],
  },
  { slug: 'lookism', label: '외모지상주의', keywords: ['외모지상주의', '외지주'] },
  {
    slug: 'hearts2hearts',
    label: '하츠투하츠',
    keywords: ['하츠투하츠', '하투하', 'hearts2hearts'],
  },
  {
    slug: 'alien-stage',
    label: '에일리언 스테이지',
    keywords: ['에일리언 스테이지', '에이스테', 'alien stage'],
  },
  {
    slug: 'cutie-street',
    label: '큐티 스트리트',
    keywords: ['큐티 스트리트', 'cutie street', '큐스토'],
  },
  {
    slug: 'ghost-story-commute',
    label: '괴담출근',
    keywords: ['괴담출근', '괴담에 떨어져도 출근', '괴출 팝업'],
  },
  { slug: 'minive', label: '미니브', keywords: ['미니브', 'minive'] },
  { slug: 'angyeong-mandu', label: '안경만두', keywords: ['안경만두'] },
  { slug: 'ganadi', label: '가나디', keywords: ['가나디'] },
  { slug: 'latale', label: '라테일', keywords: ['라테일'] },
  {
    slug: 'street-restaurant-fighter',
    label: '스트릿 레스토랑 파이터',
    keywords: ['스트릿 레스토랑 파이터', '스트릿레스토랑파이터'],
  },
  { slug: 'gintama', label: '은혼', keywords: ['은혼', '긴타마', 'gintama'] },
  { slug: 'hells-kitchen', label: '헬스키친', keywords: ['헬스키친'] },
  { slug: 'digimon', label: '디지몬', keywords: ['디지몬', 'digimon'] },
  { slug: 'spider-man', label: '스파이더맨', keywords: ['스파이더맨', 'spider-man', 'spiderman'] },
  { slug: 'ive', label: '아이브', keywords: ['아이브'] },
  { slug: 'fromis-9', label: '프로미스나인', keywords: ['프로미스나인', 'fromis_9', 'fromis'] },
  { slug: 'yoasobi', label: '요아소비', keywords: ['요아소비', 'yoasobi'] },
  {
    slug: 'project-i',
    label: '프로젝트아이',
    keywords: ['프로젝트아이', '프로젝트 아이', '프젝아'],
  },
  { slug: 'offside', label: '오프사이드', keywords: ['오프사이드'] },
  // 2026-07 트렌드 4차(6/26~7/26 KR 급상승어) — 검색어가 떴다고 다 넣지 않고, 운영 DB 에 실물이
  // 있는 것만 넣었다. 매칭 0곳이면 페이지는 noindex 고 sitemap 에서도 빠지므로(app/sitemap.ts)
  // 슬러그만 늘고 얻는 게 없다. 그래서 만석닭강정·애니메이트(둘 다 0건)는 뺐다.
  //
  // 매칭은 filterBySlice 가 "이름 + 위치" 를 소문자로 합쳐 substring 으로 훑는다. 즉 여기 키워드는
  // 사용자가 검색창에 치는 말이 아니라 크롤러가 실어온 팝업 이름 표기를 맞춰야 한다. 트렌드가
  // "로 블록 스" 처럼 띄어 보여주는 건 검색어 토크나이저 표시일 뿐이라, 띄어쓰기 변형은 실제
  // 이름에 그렇게 적힐 법한 것만 넣는다.
  {
    slug: 'lost-ark',
    label: '로스트아크',
    // '로아' 는 "크로아상"·"크로아티아" 같은 무관한 이름에도 substring 으로 걸릴 수 있다. 그래도
    // 넣는 이유는 실측 8건이 이 약칭까지 포함해 센 수치라서다 — 빼면 근거 있는 건수가 아니게 된다.
    // ('블아'·'명방'·'옵치' 처럼 짧은 약칭을 쓰는 기존 항목과도 같은 수준의 위험이다.)
    // 나중에 엉뚱한 팝업이 섞여 보이면 '로아 팝업' 으로 좁히면 된다.
    keywords: ['로스트아크', '로스트 아크', '로아', '모코코', 'lost ark', 'lostark'],
  },
  {
    slug: 'crayon-shin-chan',
    label: '짱구',
    // '짱구' 하나로 "짱구는 못말려"·"신짱구" 가 전부 걸린다(substring). 그래서 그 안에 '짱구' 가
    // 없는 국내 정식 표기 '크레용 신짱' 계열만 따로 적는다.
    keywords: ['짱구', '크레용 신짱', '크레용신짱', 'crayon shin', 'shin chan'],
  },
  {
    slug: 'cookie-run',
    label: '쿠키런',
    // 띄어쓴 '쿠키 런' 은 일부러 뺐다 — "쿠키 런칭" 같은 디저트 팝업 이름을 그대로 잡는다.
    // 이 데이터셋은 디저트 팝업이 많아 오탐 비용이 특히 크다.
    keywords: ['쿠키런', 'cookie run', 'cookierun'],
  },
  {
    slug: 'shin-ramyun',
    label: '신라면',
    // '신라면' 은 "신라면세점"(신라 + 면세점) 에도 그대로 들어간다. 실측 3건이 이 키워드 기준이라
    // 그대로 두되, 면세점 팝업이 섞여 보이면 '농심 신라면' 쪽으로 좁혀야 한다는 걸 남겨둔다.
    keywords: ['신라면', '辛라면', 'shin ramyun'],
  },
  {
    slug: 'endfield',
    label: '엔드필드',
    // 명일방주(arknights) 슬러그와 같은 팝업이 겹쳐 잡힐 수 있다. 슬라이스 중복은 원래 허용이고
    // (시점 슬라이스도 오늘=이번 주=이번 달로 겹친다), 검색어가 "엔드 필드" 로 따로 뜨는 이상
    // 랜딩도 따로 두는 편이 유입에 유리하다.
    keywords: ['엔드필드', '엔드 필드', 'endfield'],
  },

  // v2.43 — 네이버 서치어드바이저 검색어에 실제로 잡혔는데 받을 랜딩이 없던 것들.
  // ("서울 케이스티파이 홍대", "케이스티파이 지도", "톰과 제리 팝업스토어 예매",
  //  "한남동 하이브 브릿즈 팝업")
  {
    slug: 'casetify',
    label: '케이스티파이',
    // 비교가 소문자 기준이라 'casetify' 하나로 CASETiFY 표기까지 잡힌다.
    keywords: ['케이스티파이', '케이스 티파이', 'casetify'],
  },
  {
    slug: 'tom-and-jerry',
    label: '톰과 제리',
    keywords: ['톰과 제리', '톰과제리', '톰앤제리', '톰 앤 제리', 'tom and jerry', 'tom & jerry'],
  },
  {
    // 지금은 매칭 0곳이라 페이지가 noindex 다. 그래도 미리 넣는 이유는 팝업이 열리는 순간 사람 손을
    // 거치지 않고 색인 대상이 되기 때문이다(매칭 건수로 자동 판정). 크롤러 검색어에도 이미 있다.
    slug: 'hybe-bridz',
    label: '하이브 브릿즈',
    // '하이브' 단독은 넣지 않는다 — 주소의 "강남구 하이브 사옥" 에 걸려 무관한 팝업을 끌어온다
    // (실측: 보이넥스트도어 팝업이 그렇게 잡혔다).
    keywords: ['브릿즈', 'bridz'],
  },
];

const BRAND_BY_SLUG = new Map(BRANDS.map((b) => [b.slug, b]));

export function brandBySlug(slug: string): BrandDef | undefined {
  return BRAND_BY_SLUG.get(slug);
}

export function periodBySlug(slug: string): PeriodDef | undefined {
  return PERIODS.find((p) => p.slug === slug);
}
