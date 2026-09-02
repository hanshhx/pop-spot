/**
 * <b>수집이 멎은 것을 알아챈다.</b>
 *
 * <p><b>왜 "1시간 공백" 만으로는 안 되나.</b> 하루 200명이면 시간당 평균 8건이지만 고르게 오지
 * 않는다. 새벽 3~5시에는 진짜로 한 건도 없는 시간대가 있어서, 고정 임계값을 두면 <b>매일 새벽에
 * 울린다</b>. 매일 울리는 경보는 아무도 안 보고, 그러면 진짜일 때도 안 본다.
 *
 * <p>그래서 <b>그 구간에 원래 있었어야 할 양</b>과 견준다. 새벽 세 시간 공백은 기대치가 두어 건
 * 이라 조용하고, 오후 세 시간 공백은 수십 건이라 울린다. 임계값을 시간대마다 손으로 정할 필요가
 * 없고, 트래픽이 늘면 기준도 같이 올라간다.
 *
 * <p>2026-08-13~19 에 수집이 멎어 방문 기록이 통째로 비었는데 아무 신호가 없었다. 그 구간을
 * 나중에 보고 "유입이 줄었네" 하고 엉뚱한 곳을 의심하게 된다.
 */

/** 시각(0~23)별 하루 평균 방문 수. 백엔드가 최근 7일로 낸다. */
export interface HourAverage {
  hour: number;
  perDay: number;
}

/**
 * 이만큼은 있었어야 하는데 하나도 없을 때 울린다.
 *
 * <p>너무 낮으면 한산한 시간대의 자연스러운 공백에도 울리고, 너무 높으면 반나절이 비어야
 * 알아챈다. 5 는 "이 시간대라면 대여섯 명은 왔을 텐데 한 명도 없다" 는 뜻이다.
 */
export const MIN_EXPECTED_TO_ALARM = 5;

/** 하루를 넘게 비었으면 하루치로 충분하다 — 더 거슬러 올라가도 판단이 안 바뀐다. */
const MAX_LOOKBACK_MINUTES = 24 * 60;

function kstParts(when: Date): { hour: number; minute: number } {
  const text = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Seoul',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(when);
  const [hour, minute] = text.split(':').map(Number);
  /* 자정을 24 로 내놓는 환경이 있다. */
  return { hour: hour % 24, minute };
}

/**
 * 공백 구간에 <b>원래 있었어야 할</b> 방문 수.
 *
 * <p>시각 경계를 넘어가며 시간대별 평균을 비례 배분해 더한다. 예를 들어 14:30 부터 90분이
 * 비었다면 14시의 30분치 + 13시의 60분치다.
 *
 * @return 평균 자료가 없거나 공백이 없으면 {@code null} — 0 으로 답하면 '모른다' 가 '없다' 가 된다
 */
export function expectedDuringGap(
  hourlyAverage: HourAverage[] | null | undefined,
  now: Date,
  gapMinutes: number,
): number | null {
  if (!hourlyAverage?.length) return null;
  if (!Number.isFinite(gapMinutes) || gapMinutes <= 0) return null;

  const byHour = new Map(hourlyAverage.map((h) => [h.hour, h.perDay]));
  let remaining = Math.min(gapMinutes, MAX_LOOKBACK_MINUTES);
  let cursor = now.getTime();
  let total = 0;

  while (remaining > 0) {
    /* 커서 <b>직전</b> 순간의 시각을 본다 — 정각에 서 있으면 앞 시간대의 것이어야 한다. */
    const { hour } = kstParts(new Date(cursor - 1));
    const { minute } = kstParts(new Date(cursor));
    const minutesIntoHour = minute === 0 ? 60 : minute;

    const slice = Math.min(remaining, minutesIntoHour);
    total += (byHour.get(hour) ?? 0) * (slice / 60);
    remaining -= slice;
    cursor -= slice * 60_000;
  }
  return total;
}

export interface GapStatus {
  /** 마지막 기록 이후 흐른 분. 기록이 없으면 {@code null}. */
  gapMinutes: number | null;
  /** 그동안 있었어야 할 방문 수. 판단 근거가 없으면 {@code null}. */
  expected: number | null;
  /** 사람이 봐야 하는 상태인가. */
  alarming: boolean;
}

/**
 * 지금 수집이 멎어 있는가.
 *
 * <p><b>판단이 안 서면 울리지 않는다.</b> 마지막 기록이 없거나 평균 자료가 없으면 조용히 있는다 —
 * 근거 없이 울리는 경보는 진짜 경보까지 무디게 만든다.
 */
export function checkGap(
  lastVisitAt: string | null | undefined,
  hourlyAverage: HourAverage[] | null | undefined,
  now: Date = new Date(),
): GapStatus {
  const last = lastVisitAt ? new Date(lastVisitAt) : null;
  if (!last || Number.isNaN(last.getTime())) {
    return { gapMinutes: null, expected: null, alarming: false };
  }

  const gapMinutes = Math.max(0, (now.getTime() - last.getTime()) / 60_000);
  const expected = expectedDuringGap(hourlyAverage, now, gapMinutes);

  return {
    gapMinutes,
    expected,
    alarming: expected !== null && expected >= MIN_EXPECTED_TO_ALARM,
  };
}
