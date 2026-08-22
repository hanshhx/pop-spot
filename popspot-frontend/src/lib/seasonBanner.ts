import { SEASON_MONTHS, type Season } from '@/lib/season';

/**
 * 계절 전환 배너를 띄울지 정한다.
 *
 * <p>시안 슬라이드 7 — <b>"유저는 상태를 못 알아채고 순간만 알아챕니다."</b> 색으로 60% 전달할
 * 것을 문장 하나가 100% 한다. 그래서 계절이 바뀌는 <b>순간</b>에 한 번 말해 준다.
 *
 * <h3>세 가지 조건</h3>
 *
 * <ol>
 *   <li><b>계절 시작 후 2주</b>만 — 상주하면 3일 만에 눈에서 지워지고 광고로 읽힌다.
 *   <li><b>계절당 딱 한 번</b> — 닫으면 그 계절에는 다시 안 뜬다.
 *   <li><b>첫 방문자에게는 안 띄운다</b> — 비교할 기억이 없으니 "여름이 시작됐어요" 가
 *       뜬금없는 광고가 된다. 이 배너는 <b>변화</b>를 알리는 물건이라 이전이 있어야 뜻이 생긴다.
 * </ol>
 */

/** 계절이 시작되고 이 기간 안에만 띄운다. */
export const BANNER_WINDOW_DAYS = 14;

/** 닫은 계절을 적어 두는 곳. 값은 계절 이름 하나다. */
export const BANNER_DISMISS_KEY = 'popspot:season-banner-dismissed';

/** 전에 온 적이 있는지 판단하는 표식. 첫 방문 때 심고, 다음 방문부터 재방문자로 본다. */
export const RETURNING_KEY = 'popspot:seen-before';

/**
 * 그 계절이 시작된 날. 기상청 구분이라 계절 첫 달의 1일이다.
 *
 * <p>겨울만 12월에 시작해 해를 넘긴다 — 1월·2월에 서 있으면 시작일은 <b>작년</b> 12월 1일이다.
 * 이것을 놓치면 1월 내내 "겨울이 시작됐어요" 가 뜬다.
 */
export function seasonStart(season: Season, now: Date): Date {
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const year = kst.getUTCFullYear();
  const month = kst.getUTCMonth() + 1;
  const firstMonth = SEASON_MONTHS[season][0];

  // 겨울(12·1·2)에 1월·2월이면 시작은 작년 12월이다.
  const startYear = season === 'winter' && month < 3 ? year - 1 : year;
  return new Date(Date.UTC(startYear, firstMonth - 1, 1, 0, 0, 0));
}

/** 계절이 시작된 지 며칠 됐나. KST 기준. */
export function daysSinceSeasonStart(season: Season, now: Date): number {
  const kstNow = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const start = seasonStart(season, now);
  return Math.floor((kstNow.getTime() - start.getTime()) / 86_400_000);
}

export type BannerInput = {
  season: Season;
  now: Date;
  /** 이 계절 배너를 이미 닫았는가. 저장된 계절 이름. */
  dismissedSeason: string | null;
  /** 전에 온 적이 있는가. */
  returning: boolean;
};

/**
 * @returns 배너를 지금 띄워야 하는가
 */
export function shouldShowSeasonBanner({
  season,
  now,
  dismissedSeason,
  returning,
}: BannerInput): boolean {
  if (!returning) return false;
  if (dismissedSeason === season) return false;
  const days = daysSinceSeasonStart(season, now);
  // 음수는 나올 수 없지만(시작일이 미래일 수 없다) 계산이 틀렸을 때 배너가 영원히 뜨는 것을 막는다.
  return days >= 0 && days < BANNER_WINDOW_DAYS;
}

/**
 * 배너 문구. 계절마다 <b>그 계절에 실제로 무엇이 몰리는지</b>를 말한다.
 *
 * <p>"봄이 왔어요" 같은 말은 아무것도 알려주지 않는다. 시안의 여름 문구가
 * "냉방 팝업과 해변 시즌 스토어가 몰려 있습니다" 인 것은, 계절이 <b>목록의 내용</b>을 바꾼다는
 * 사실을 말하기 때문이다.
 */
export const SEASON_BANNER_COPY: Record<Season, { lead: string; body: string }> = {
  spring: {
    lead: '봄이 시작됐어요',
    body: '5월 말까지가 성수기입니다. 벚꽃 시즌 팝업과 야외 마켓이 몰려 있습니다.',
  },
  summer: {
    lead: '여름이 시작됐어요',
    body: '8월 말까지가 성수기입니다. 냉방 팝업과 해변 시즌 스토어가 몰려 있습니다.',
  },
  autumn: {
    lead: '가을이 시작됐어요',
    body: '11월 말까지가 성수기입니다. 전시형 팝업과 단풍 시즌 카페가 몰려 있습니다.',
  },
  winter: {
    lead: '겨울이 시작됐어요',
    body: '2월 말까지가 성수기입니다. 크리스마스 마켓과 연말 한정 스토어가 몰려 있습니다.',
  },
};
