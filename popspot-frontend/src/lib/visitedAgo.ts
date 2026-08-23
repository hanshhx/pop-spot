/**
 * 최근 본 팝업 카드에 적을 "언제 봤는지" — 문장이 아니라 <b>모양</b>으로 돌려준다.
 *
 * <p>이 카드는 한국어·영어·일본어로 그려지고, 그리는 쪽은 사전이 아니라 인라인 삼항으로 문구를
 * 고른다. 여기서 '3일 전' 같은 완성된 말을 만들어 주면 그 순간 이 파일이 한국어 전용이 되고,
 * 나머지 두 언어는 남의 나라 말을 다시 뜯어 고쳐야 한다. {@code groupByRegion} 이 지역 이름 대신
 * 코드를 돌려주는 것과 같은 이유다 — 판단은 여기서, 언어는 그리는 쪽에서.
 *
 * <p>{@code days} 가 2~6 에서만 나오는 것도 판단이다. 일주일이 넘어가면 'N일 전' 은 손가락을 꼽아야
 * 언제인지 알 수 있는 숫자라, 그때부터는 날짜를 그대로 보여주는 편이 읽힌다.
 */
export type VisitedAgo =
  | { kind: 'today' }
  | { kind: 'yesterday' }
  | { kind: 'days'; days: number }
  | { kind: 'date'; month: number; day: number };

/**
 * 방문 시각을 "얼마나 전인지" 로 접는다. 읽을 수 없으면 null.
 *
 * <p>핵심은 <b>로컬 자정끼리 비교</b>한다는 것이다. {@code visitedAt} 은 날짜가 아니라 시각까지
 * 붙은 ISO 타임스탬프여서, 밀리초 차이를 하루로 나누면 어젯밤 23:50 에 본 것이 오늘 00:10 에는
 * '오늘' 이 된다 — 20분밖에 지나지 않았으니까. 그러나 사용자가 겪은 날은 어제다. 그래서
 * {@code daysUntilEnd} 와 같은 모양으로 양쪽을 로컬 자정으로 내린 뒤 뺀다. 보는 사람의 달력이
 * 기준이지 시계가 기준이 아니다.
 *
 * <p>{@code dday.ts} 가 'YYYY-MM-DD' 를 UTC 자정으로 읽어 버리는 버릇은 여기엔 없다 — 그건 날짜만
 * 있는 문자열의 이야기고, 시각이 붙은 타임스탬프는 어느 시간대에서 읽어도 같은 한 순간을
 * 가리킨다. 필요 없는 보정을 따라 붙이면 오히려 하루가 밀린다.
 *
 * <p>미래 시각은 '오늘' 로 접는다. 기기 시계가 어긋났거나 저장소를 손으로 고친 기록이 실제로
 * 들어오는데, '-1일 전' 은 어떤 언어로 옮겨도 문장이 되지 않는다.
 *
 * <p>값의 출처가 검증되지 않은 localStorage 라 <b>절대 던지지 않는다.</b> 빈 값도, 사람이 적어 넣은
 * 말도 null 로만 나간다 — 카드 한 줄 때문에 홈 전체가 흰 화면이 되는 것이 최악이다.
 */
export function visitedAgo(visitedAt: string, now: Date = new Date()): VisitedAgo | null {
  if (!visitedAt) return null;
  const visited = new Date(visitedAt);
  if (Number.isNaN(visited.getTime())) return null;

  const visitedMidnight = new Date(visited.getTime());
  visitedMidnight.setHours(0, 0, 0, 0);
  const nowMidnight = new Date(now.getTime());
  nowMidnight.setHours(0, 0, 0, 0);

  // 서머타임이 낀 주에는 하루가 23시간이거나 25시간이라 나눗셈이 딱 떨어지지 않는다. round 다.
  const days = Math.round((nowMidnight.getTime() - visitedMidnight.getTime()) / 86_400_000);

  if (days <= 0) return { kind: 'today' };
  if (days === 1) return { kind: 'yesterday' };
  if (days < 7) return { kind: 'days', days };
  return { kind: 'date', month: visited.getMonth() + 1, day: visited.getDate() };
}
