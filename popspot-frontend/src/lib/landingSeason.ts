import { SEASONS, seasonOf, seasonOfMonth, type Season } from '@/lib/season';

/**
 * SEO 랜딩이 입는 계절 — <b>시계가 아니라 콘텐츠</b>가 정한다.
 *
 * <p>앱에서는 "지금" 이 곧 계절이라 고민이 없다. 랜딩은 다르다.
 * {@code /popups/12월-성수} 를 <b>8월에 여는 사람이 매일 있다.</b> 지금 계절로 칠하면
 * 겨울 팝업 목록이 여름 하늘색으로 나온다.
 *
 * <p>그리고 여기 오는 사람은 팝스팟을 처음 본다 — 계절이 바뀐 것을 알아챌 기억이 없다.
 * 앱의 계절이 재방문자에게 <b>변화</b>를 알리는 것이라면, 랜딩의 계절은 첫 방문자에게
 * <b>기간</b>을 알린다. 목적이 다르므로 기준도 달라야 한다.
 */

/**
 * 슬러그에서 계절을 읽는다.
 *
 * <p>기간을 가리키는 슬러그({@code 12월-성수}, {@code winter}, {@code this-month})만
 * 계절을 갖는다. 브랜드·지역 슬러그({@code seongsu}, {@code nike})는 기간과 무관하므로
 * <b>중립</b>이다 — 성수는 사계절 내내 성수다.
 *
 * @returns 그 슬러그가 다루는 계절. 기간이 아니면 {@code null}
 */
export function seasonFromSlug(slug: string): Season | null {
  const s = slug.toLowerCase();

  // 계절 이름이 직접 들어간 경우.
  for (const season of SEASONS) if (s.includes(season)) return season;
  if (/봄/.test(slug)) return 'spring';
  if (/여름/.test(slug)) return 'summer';
  if (/가을/.test(slug)) return 'autumn';
  if (/겨울/.test(slug)) return 'winter';

  // "12월-성수" 처럼 달이 들어간 경우. 1~12 만 받는다 — "24시간" 같은 숫자를 달로 읽지 않게.
  const month = slug.match(/(?:^|[^0-9])([1-9]|1[0-2])월/);
  if (month) return seasonOfMonth(Number(month[1]));

  return null;
}

/**
 * 이 랜딩이 입을 계절.
 *
 * @param slug 랜딩 슬러그
 * @param now 기간을 가리키지 않는 슬러그가 물러설 기준. 그때는 오늘 계절을 쓴다.
 */
export function landingSeason(slug: string, now: Date = new Date()): Season {
  return seasonFromSlug(slug) ?? seasonOf(now);
}

/**
 * 이 슬러그가 계절을 <b>주장</b>하는가.
 *
 * <p>주장하지 않는 랜딩(브랜드·지역)에는 계절 배지를 달지 않는다. 성수 랜딩에 "여름" 배지가
 * 붙으면 8월에 만든 페이지가 10월에도 여름이라고 우기는 꼴이 된다.
 */
export function slugClaimsSeason(slug: string): boolean {
  return seasonFromSlug(slug) !== null;
}
