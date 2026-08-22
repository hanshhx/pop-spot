/**
 * 지금이 어느 계절인지 — 그리고 어느 절기인지.
 *
 * <h3>계절은 기상청 기준(월별 3개월 묶음)을 쓴다</h3>
 *
 * <p>봄 3~5월 · 여름 6~8월 · 가을 9~11월 · 겨울 12~2월. 천문 기준(춘분·하지·추분·동지)으로
 * 나누는 방법도 있지만, 한국에서 "봄" 이라고 하면 대개 3월부터다. 화면에 쓰는 말은 사람들이
 * 쓰는 말과 같아야 한다.
 *
 * <h3>절기는 계절을 정하지 않는다</h3>
 *
 * <p>절기로 보면 입하(5월 5일경)부터 여름이지만, 기상청 기준으로 5월은 봄이다. 둘이 어긋나는
 * 구간이 매 계절 한 달쯤 생긴다. <b>계절은 월로 정하고, 절기는 곁들이는 말로만 쓴다</b> —
 * "봄 · 곡우 무렵" 처럼. 절기가 계절을 뒤집으면 5월 초에 배경이 갑자기 여름이 된다.
 *
 * <p>절기 날짜는 해마다 하루씩 움직인다(태양 황경 기준이라 윤년에 따라 달라진다). 여기 적힌
 * 것은 <b>평년 근사값</b>이고, 그래서 화면에도 "무렵" 이라고 적는다. 하루 어긋나도 거짓말이
 * 되지 않는 표현이다.
 */

export type Season = 'spring' | 'summer' | 'autumn' | 'winter';

export const SEASONS: readonly Season[] = ['spring', 'summer', 'autumn', 'winter'];

/** 월(1~12) → 계절. 기상청 기후 통계 구분. */
export function seasonOfMonth(month: number): Season {
  if (month >= 3 && month <= 5) return 'spring';
  if (month >= 6 && month <= 8) return 'summer';
  if (month >= 9 && month <= 11) return 'autumn';
  return 'winter'; // 12 · 1 · 2
}

/**
 * 한국 시각 기준으로 오늘의 계절.
 *
 * <p>KST 로 보는 이유는 서버가 UTC 라서다. 12월 1일 오전 8시(KST)는 UTC 로는 아직 11월 30일이라,
 * 그대로 두면 <b>계절이 바뀌는 날 아침에 서버와 브라우저가 다른 계절을 그린다.</b>
 */
export function seasonOf(date: Date = new Date()): Season {
  const kst = new Date(date.getTime() + 9 * 60 * 60 * 1000);
  return seasonOfMonth(kst.getUTCMonth() + 1);
}

/** 24절기 — [월, 일, 이름]. 평년 근사값이라 하루쯤 움직인다. */
const SOLAR_TERMS: readonly [number, number, string][] = [
  [1, 6, '소한'],
  [1, 20, '대한'],
  [2, 4, '입춘'],
  [2, 19, '우수'],
  [3, 6, '경칩'],
  [3, 21, '춘분'],
  [4, 5, '청명'],
  [4, 20, '곡우'],
  [5, 5, '입하'],
  [5, 21, '소만'],
  [6, 6, '망종'],
  [6, 21, '하지'],
  [7, 7, '소서'],
  [7, 23, '대서'],
  [8, 7, '입추'],
  [8, 23, '처서'],
  [9, 8, '백로'],
  [9, 23, '추분'],
  [10, 8, '한로'],
  [10, 23, '상강'],
  [11, 7, '입동'],
  [11, 22, '소설'],
  [12, 7, '대설'],
  [12, 22, '동지'],
];

/**
 * 오늘 지나온 가장 최근 절기.
 *
 * <p>"다음 절기" 가 아니라 "지나온 절기" 다. 입춘이 지나면 한동안 입춘 무렵이라고 부르는 것이
 * 실제 말버릇이고, 아직 오지 않은 절기를 지금이라고 부르면 어색하다.
 *
 * <p>1월 1일~5일처럼 그 해 첫 절기(소한) 전이면 <b>작년 마지막 절기(동지)</b>로 물러선다.
 */
export function solarTermOf(date: Date = new Date()): string {
  const kst = new Date(date.getTime() + 9 * 60 * 60 * 1000);
  const month = kst.getUTCMonth() + 1;
  const day = kst.getUTCDate();

  let latest = SOLAR_TERMS[SOLAR_TERMS.length - 1][2]; // 동지 — 연초에 물러설 자리
  for (const [m, d, name] of SOLAR_TERMS) {
    if (m < month || (m === month && d <= day)) latest = name;
    else break;
  }
  return latest;
}

/** 계절 이름 — 화면에 쓰는 말. */
export const SEASON_LABEL: Record<Season, { ko: string; en: string; ja: string }> = {
  spring: { ko: '봄', en: 'Spring', ja: '春' },
  summer: { ko: '여름', en: 'Summer', ja: '夏' },
  autumn: { ko: '가을', en: 'Autumn', ja: '秋' },
  winter: { ko: '겨울', en: 'Winter', ja: '冬' },
};

/** 계절이 걸치는 달. 묶음 페이지에서 "3~5월" 처럼 쓴다. */
export const SEASON_MONTHS: Record<Season, readonly number[]> = {
  spring: [3, 4, 5],
  summer: [6, 7, 8],
  autumn: [9, 10, 11],
  winter: [12, 1, 2],
};

/**
 * 이 날짜가 그 계절에 드는가.
 *
 * <p>겨울이 12·1·2월로 <b>해를 넘긴다</b>는 것이 이 함수의 유일한 까다로운 점이다.
 * 월만 보면 되므로 연도는 신경 쓰지 않는다.
 */
export function isInSeason(date: Date, season: Season): boolean {
  return seasonOfMonth(new Date(date.getTime() + 9 * 60 * 60 * 1000).getUTCMonth() + 1) === season;
}
