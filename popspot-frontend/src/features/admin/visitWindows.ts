/**
 * <b>완료된 날과 진행 중인 날을 가른다.</b>
 *
 * <p><b>왜 필요한가.</b> 2026-09-02 하루 동안 같은 실수를 세 번 했다 — 부분 데이터가 섞인 숫자를
 * 추세로 읽었다. Vercel 그래프의 점선 구간을 보고 "−47% 급락" 이라 했는데 완료된 주끼리 놓으니
 * −6.8% 였고, 관리 화면은 타일 다섯 중 넷이 "오늘" 이라 비교에 쓸 수 없는 숫자만 크게 보여 준다.
 *
 * <p>그래서 화면이 <b>구조적으로</b> 막아야 한다. 비교용 숫자와 진행 중인 숫자를 같은 크기로
 * 나란히 두면, 급할 때 반드시 잘못된 쪽을 집는다.
 *
 * <p>날짜 기준은 <b>한국 시간</b>이다. 서버가 어느 시간대로 돌든, 브라우저가 어디에 있든 "한국에서
 * 오늘" 이 하나여야 관리자와 서버가 같은 날을 말한다.
 */

/** 백엔드가 주는 일별 방문자 한 줄. */
export interface DailyVisitors {
  /** {@code YYYY-MM-DD}. */
  date: string;
  visitors: number;
}

/** 한국 기준 오늘({@code YYYY-MM-DD}). */
export function kstToday(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(now);
}

/**
 * 백엔드가 주는 날짜를 <b>비교 가능한 형태</b>로 바꾼다.
 *
 * <p><b>왜 이게 필요한가.</b> 통계 질의가 {@code to_char(created_at, 'MM-DD')} 라 연도가 없다.
 * 그대로 {@code '09-02' < '2026-09-02'} 로 비교하면 앞자리 {@code '0' < '2'} 때문에 <b>언제나
 * 참</b>이 되어, 오늘까지 '완료된 날' 로 잡힌다 — 고치려던 바로 그 버그가 조용히 남는다.
 *
 * <p>연도는 오늘에서 빌려 오되, 그렇게 만든 날짜가 <b>미래면 작년으로 내린다.</b> 12월 31일에
 * 1월 1일 자료를 보는 일은 없지만, 1월 1일에 지난 7일을 보면 12월 말이 섞인다. 그때 연도를 그냥
 * 올해로 붙이면 12월이 미래가 되어 통째로 사라진다.
 *
 * <p>서버가 언젠가 온전한 {@code YYYY-MM-DD} 를 주도록 고쳐도 화면이 안 깨지게 둘 다 받는다.
 * 점(.)을 구분자로 쓰는 옛 자료도 같이 받는다.
 */
export function toComparableDate(raw: unknown, today: string = kstToday()): string | null {
  if (typeof raw !== 'string') return null;
  const text = raw.trim().replaceAll('.', '-');

  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  if (!/^\d{2}-\d{2}$/.test(text)) return null;

  const thisYear = today.slice(0, 4);
  const guess = `${thisYear}-${text}`;
  if (guess <= today) return guess;

  /* 미래로 나왔다 = 해가 바뀌어 작년 자료다. */
  return `${Number(thisYear) - 1}-${text}`;
}

/**
 * 아직 안 끝난 날을 뺀 나머지. <b>비교와 평균은 이것만 쓴다.</b>
 *
 * <p>미래 날짜도 뺀다 — 시계가 어긋난 기기에서 내일 자가 섞이면 평균이 조용히 낮아진다.
 */
export function completedDays(
  daily: DailyVisitors[] | null | undefined,
  today: string = kstToday(),
): DailyVisitors[] {
  if (!daily?.length) return [];
  return daily.filter((d) => {
    const iso = toComparableDate(d?.date, today);
    return iso !== null && iso < today;
  });
}

/**
 * 가장 최근의 <b>완료된</b> 날. Vercel 과 눈으로 맞춰 볼 숫자다.
 *
 * <p>이름은 '어제' 지만 기록이 빠진 날이 있으면 그보다 앞일 수 있다 — 없는 날을 0 으로 채워
 * 넣으면 "수집이 멎었다" 와 "그날 아무도 안 왔다" 가 구별되지 않는다.
 */
export function lastCompletedDay(
  daily: DailyVisitors[] | null | undefined,
  today: string = kstToday(),
): DailyVisitors | null {
  const done = completedDays(daily, today);
  if (!done.length) return null;
  return done.reduce((latest, d) =>
    (toComparableDate(d.date, today) ?? '') > (toComparableDate(latest.date, today) ?? '')
      ? d
      : latest,
  );
}

/** 완료된 날들의 일평균. 완료된 날이 없으면 {@code null} — 0 으로 답하면 '자료 없음' 이 '0명' 이 된다. */
export function completedAverage(
  daily: DailyVisitors[] | null | undefined,
  today: string = kstToday(),
): number | null {
  const done = completedDays(daily, today);
  if (!done.length) return null;
  return done.reduce((sum, d) => sum + (d.visitors || 0), 0) / done.length;
}

/** 오늘(진행 중) 기록된 수. 아직 한 건도 없으면 0 이다 — 이건 진짜 0 이라 null 이 아니다. */
export function todayCount(
  daily: DailyVisitors[] | null | undefined,
  today: string = kstToday(),
): number {
  return daily?.find((d) => toComparableDate(d?.date, today) === today)?.visitors ?? 0;
}

/**
 * 우리 DB 가 기준값(Vercel)보다 얼마나 적은가. 0.12 면 12% 덜 잡혔다는 뜻이다.
 *
 * <p>음수면 우리 쪽이 더 많이 셌다는 뜻이라 그것도 이상 신호다. 기준값이 없거나 0 이면
 * {@code null} — 0 으로 나누는 대신 '판정 불가' 를 돌려준다.
 */
export function shortfallRatio(dbCount: number, reference: number): number | null {
  if (!Number.isFinite(reference) || reference <= 0) return null;
  if (!Number.isFinite(dbCount)) return null;
  return (reference - dbCount) / reference;
}

/** 이보다 벌어지면 살펴봐야 한다. 플랜의 일일 점검 기준. */
export const SHORTFALL_ALERT = 0.15;

/** 차이가 살펴볼 만큼 벌어졌는가. 판정 불가({@code null})는 <b>경보로 치지 않는다.</b> */
export function isShortfallAlarming(ratio: number | null): boolean {
  return ratio !== null && Math.abs(ratio) > SHORTFALL_ALERT;
}
