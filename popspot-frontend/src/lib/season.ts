/**
 * 계절 테마 — 결정 로직과 계절별 문구.
 *
 * <p>색은 전부 {@code globals.css} 의 {@code :root[data-season="..."]} 8세트에 있다. 이 파일은
 * <b>어느 계절인지</b>와 <b>계절이 화면에서 무슨 말을 하는지</b>만 담당한다.
 *
 * <p>설계 근거(계절 테마 덱): 배경을 계절마다 조금씩 물들이는 방식은 인지가 0이다 — 사람 눈은
 * 절대값이 아니라 이웃과의 차이로 색을 읽어서, 어제 화면을 기억하는 유저가 없기 때문이다.
 * 그래서 색은 색온도만 3~6% 옮기고, 유저가 실제로 알아채는 몫은 전부 <b>신호 레이어</b>
 * (전환 배너 · 계절 배지 · 마감 알림)가 가져간다.
 */

export const SEASONS = ['spring', 'summer', 'autumn', 'winter'] as const;

export type Season = (typeof SEASONS)[number];

/** 관리자가 고른 값을 담는 쿠키. 서버 컴포넌트에서 읽어 첫 HTML 부터 계절을 입힌다. */
export const SEASON_COOKIE = 'popspot-season';

/** 관리자 선택값이 없을 때(=자동)를 뜻한다. 쿠키에 이 값이 들어가면 월 기준으로 되돌아간다. */
export const SEASON_AUTO = 'auto';

export type SeasonSetting = Season | typeof SEASON_AUTO;

export function isSeason(value: unknown): value is Season {
  return typeof value === 'string' && (SEASONS as readonly string[]).includes(value);
}

export function isSeasonSetting(value: unknown): value is SeasonSetting {
  return value === SEASON_AUTO || isSeason(value);
}

/**
 * 월(1~12) → 계절. 3·4·5 봄 / 6·7·8 여름 / 9·10·11 가을 / 12·1·2 겨울.
 *
 * <p>12월이 <b>다음 해</b> 겨울의 시작이라 나머지 연산으로 접으면 경계가 어긋난다. 그냥 나열한다.
 */
export function seasonOfMonth(month: number): Season {
  if (month >= 3 && month <= 5) return 'spring';
  if (month >= 6 && month <= 8) return 'summer';
  if (month >= 9 && month <= 11) return 'autumn';
  return 'winter';
}

/** 오늘 날짜 기준 계절. */
export function seasonOfNow(now: Date = new Date()): Season {
  return seasonOfMonth(now.getMonth() + 1);
}

/**
 * 화면이 입을 계절을 정한다. 앞에 오는 것이 이긴다.
 *
 * <ol>
 *   <li>{@code override} — 주소의 {@code ?season=} . 8조합(4계절 × 라이트/다크) QA 와 디자인
 *       리뷰용이다. 이게 없으면 12월까지 기다려야 겨울을 볼 수 있다.</li>
 *   <li>{@code setting} — 관리자가 고른 값(쿠키).</li>
 *   <li>월 자동.</li>
 * </ol>
 */
export function resolveSeason(
  override?: string | null,
  setting?: string | null,
  now: Date = new Date(),
): Season {
  if (isSeason(override)) return override;
  if (isSeason(setting)) return setting;
  return seasonOfNow(now);
}

/**
 * 계절이 화면에서 하는 말.
 *
 * <p>다섯 신호 중 셋은 색이 아니다 — 없던 버튼이 생기는 것, 사라진다고 말하는 것이 색보다 세다.
 * 그 문장들이 여기 있다.
 */
export interface SeasonCopy {
  /** "봄" — 문장 안에 박히는 짧은 말. */
  word: string;
  /** "SPRING" — 대문자 배지. */
  upper: string;
  /** 3 · 4 · 5월 */
  months: string;
  /** 전환 배너 제목. 계절당 딱 한 번 뜬다. */
  lead: string;
  /** 전환 배너 본문. 왜 지금인지를 날짜로 말한다. */
  body: string;
}

export const SEASON_COPY: Record<Season, SeasonCopy> = {
  spring: {
    word: '봄',
    upper: 'SPRING',
    months: '3 · 4 · 5월',
    lead: '벚꽃 시즌이 시작됐어요',
    body: '3월 말부터 꽃 피는 골목에 팝업이 몰립니다. 봄에 열린 팝업 상당수가 5월 안에 문을 닫습니다.',
  },
  summer: {
    word: '여름',
    upper: 'SUMMER',
    months: '6 · 7 · 8월',
    lead: '여름이 시작됐어요',
    body: '8월 말까지가 성수기입니다. 냉방 팝업과 해변 시즌 스토어가 같은 주에 몰려 있습니다.',
  },
  autumn: {
    word: '가을',
    upper: 'AUTUMN',
    months: '9 · 10 · 11월',
    lead: '가을이 시작됐어요',
    body: '야외 팝업이 가장 좋은 두 달입니다. 한강·성수 옥상 라인이 9월 첫 주에 한꺼번에 문을 엽니다.',
  },
  winter: {
    word: '겨울',
    upper: 'WINTER',
    months: '12 · 1 · 2월',
    lead: '겨울이 시작됐어요',
    body: '12월은 실내로 전부 들어갑니다. 홀리데이 팝업은 대부분 1월 첫 주에 닫으니 날짜를 놓치기 쉽습니다.',
  },
};

/**
 * <b>이번 계절 안에 마감하는가.</b> 계절 행사인지와는 무관하다.
 *
 * <h3>이름에 속지 말 것</h3>
 *
 * <p>이 판정이 보는 것은 마감일 하나뿐이다. 그래서 가을과 아무 관련 없는 팝업도 9월에 끝나면
 * 참이 된다. 예전에는 이 값으로 "가을 한정" 칩과 필터를 그렸는데, 화면에 적힌 사실 주장이
 * 자주 거짓이었으므로 둘 다 걷어냈다. <b>여기에 계절 이름을 붙이는 문구를 다시 달지 말 것.</b>
 *
 * <p>지금 남은 쓰임은 카드의 D-day 배지를 만채도로 칠하는 것 하나다. 그 배지는 "이 계절에
 * 사라진다" 는 뜻이라 계산과 일치한다 — 다만 대부분의 팝업이 석 달 안에 끝나므로 거의 모든
 * 카드가 칠해질 수 있다. 전부 칠해지면 신호가 아니므로, 실제 비율을 재서 판단할 일이 남아 있다.
 *
 * <p>시작일을 보지 않는 이유: 지난달에 열었어도 이번 계절에 닫으면 지금 놓치는 것은 같다.
 * 이미 끝난 팝업은 제외한다 — 알릴 마감이 없다.
 */
export function isSeasonLimited(
  endDate: string | undefined,
  season: Season,
  now: Date = new Date(),
): boolean {
  const end = endDate ? new Date(endDate) : null;
  if (!end || Number.isNaN(end.getTime())) return false;
  // 날짜로 비교한다. 시각으로 비교하면 "오늘 마감" 이 자정 기준 과거가 되어 빠진다 — 가장 급한
  // 한 칸이 정확히 그날 사라지는 셈이라, 마감을 알리자는 신호의 취지와 반대가 된다.
  const left = daysUntil(endDate, now);
  if (left == null || left < 0) return false;
  // 계절은 1년마다 돌아온다. 내년 같은 계절까지 포함하면 마감이라는 말이 의미를 잃는다.
  if (end.getFullYear() !== now.getFullYear()) return false;
  return seasonOfMonth(end.getMonth() + 1) === season;
}

/** 마감까지 남은 일수. 오늘 마감이면 0. 날짜가 없거나 이상하면 null. */
export function daysUntil(endDate: string | undefined, now: Date = new Date()): number | null {
  if (!endDate) return null;
  const end = new Date(endDate);
  if (Number.isNaN(end.getTime())) return null;
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  return Math.round((startOfDay(end) - startOfDay(now)) / 86_400_000);
}

/** 관리자 화면 등에서 쓰는 계절 이름. */
export const SEASON_LABEL: Record<Season, string> = {
  spring: '봄',
  summer: '여름',
  autumn: '가을',
  winter: '겨울',
};
