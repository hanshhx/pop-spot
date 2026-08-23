import type { PopupStore } from '@/types/popup';

/**
 * 달력에서 하루가 뜻하는 것 — 그날 <b>바뀌는</b> 것과 그저 <b>있는</b> 것을 가른다.
 *
 * <p>예전 달력은 둘을 섞어서 "그날 진행 중인 것" 만 보여줬다. 팝업은 몇 주씩 하므로 그 목록은
 * 날짜를 바꿔도 거의 그대로였다(8월 23일 508곳 → 25일 462곳). 반대로 열리고 닫히는 수는 날마다
 * 크게 다르다(59 · 22 · 153). 날짜를 고르는 의미는 후자에 있다.
 */
export interface DayBuckets {
  /** 그날 문을 닫는 팝업. */
  closing: PopupStore[];
  /** 그날 문을 여는 팝업. */
  opening: PopupStore[];
  /**
   * 그날 문이 열려 있던 팝업의 수. <b>목록이 아니라 수만</b> 돌려준다 — 500개짜리 목록은
   * 정보가 아니라 벽이라서, 화면도 숫자 한 줄로만 쓴다.
   */
  runningCount: number;
}

/**
 * 하루치를 세 덩어리로 가른다.
 *
 * <p>마감만 {@code startDate} 를 요구하지 않는다. 종료일만 있고 시작일이 없는 팝업이 실측 24곳
 * 있는데, 예전 {@code getPopupsForDate} 는 시작일이 없으면 곧바로 버려서 <b>그 24곳은 달력의 어느
 * 날짜에도 나오지 않았다.</b>
 *
 * <p>하루짜리 팝업(시작 = 종료)은 마감과 오픈 양쪽에 든다. 그날 열고 그날 닫는 것이 사실이다.
 */
export function bucketByDay(popups: PopupStore[], date: string): DayBuckets {
  const closing: PopupStore[] = [];
  const opening: PopupStore[] = [];
  let runningCount = 0;

  for (const popup of popups) {
    if (!popup) continue;
    const start = popup.startDate;
    // ?? 가 아니라 || 다. 크롤링 결과에 빈 문자열이 들어오면 ?? 는 그것을 값으로 인정해
    // 종료일이 '' 인 팝업을 어느 덩어리에도 넣지 못한다. 예전 getPopupsForDate 도 || 를 썼다.
    const end = popup.endDate || popup.startDate;
    if (end === date) closing.push(popup);
    if (start === date) opening.push(popup);
    if (start && end && date >= start && date <= end) runningCount += 1;
  }

  return { closing, opening, runningCount };
}

/**
 * 날짜별 마감 수 — 격자 칸에 적을 숫자.
 *
 * <p>칸마다 {@link bucketByDay} 를 부르면 한 달에 31 × 1,167 번을 돈다. 마감일은 팝업당 하나뿐이라
 * 한 번 훑어 세어 두면 끝난다.
 *
 * <p>마감이 없는 날은 <b>키가 아예 없다.</b> 0 을 넣어 두면 그리는 쪽이 "0곳" 이라고 적을 수 있고,
 * 그건 아무 일도 없는 날을 시끄럽게 만든다.
 */
export function closingCountsByDate(popups: PopupStore[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const popup of popups) {
    if (!popup) continue;
    const end = popup.endDate || popup.startDate;
    if (!end) continue;
    counts.set(end, (counts.get(end) ?? 0) + 1);
  }
  return counts;
}
