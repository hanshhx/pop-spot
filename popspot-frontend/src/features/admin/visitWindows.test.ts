import { describe, expect, it } from 'vitest';

import {
  completedAverage,
  completedDays,
  isShortfallAlarming,
  kstToday,
  lastCompletedDay,
  SHORTFALL_ALERT,
  shortfallRatio,
  toComparableDate,
  todayCount,
} from './visitWindows';

/**
 * 지키는 것은 하나다 — <b>진행 중인 날이 비교용 숫자에 섞이지 않는다.</b>
 *
 * <p>2026-09-02 에 부분 데이터를 추세로 읽어 "−47% 급락" 이라 했다. 완료된 주끼리 놓으니
 * −6.8% 였다. 사람이 매번 조심하는 것으로는 막히지 않으므로 여기서 막는다.
 */

const 오늘 = '2026-09-02';

const 일주일: { date: string; visitors: number }[] = [
  { date: '2026-08-27', visitors: 210 },
  { date: '2026-08-28', visitors: 190 },
  { date: '2026-08-29', visitors: 285 },
  { date: '2026-08-30', visitors: 215 },
  { date: '2026-08-31', visitors: 148 },
  { date: '2026-09-01', visitors: 160 },
  { date: '2026-09-02', visitors: 37 }, // 진행 중 — 아직 오전이다
];

describe('completedDays', () => {
  /* 이 검사가 이 파일의 존재 이유다. */
  it('오늘을 뺀다', () => {
    const done = completedDays(일주일, 오늘);

    expect(done).toHaveLength(6);
    expect(done.map((d) => d.date)).not.toContain(오늘);
  });

  /* 시계가 어긋난 기기에서 내일 자가 섞이면 평균이 조용히 낮아진다. */
  it('미래 날짜도 뺀다', () => {
    const 내일섞임 = [...일주일, { date: '2026-09-03', visitors: 5 }];

    expect(completedDays(내일섞임, 오늘).map((d) => d.date)).not.toContain('2026-09-03');
  });

  it('자료가 없으면 빈 목록', () => {
    expect(completedDays([], 오늘)).toEqual([]);
    expect(completedDays(null, 오늘)).toEqual([]);
    expect(completedDays(undefined, 오늘)).toEqual([]);
  });
});

describe('lastCompletedDay', () => {
  it('가장 최근의 완료된 날을 고른다', () => {
    expect(lastCompletedDay(일주일, 오늘)).toEqual({ date: '2026-09-01', visitors: 160 });
  });

  /* 순서를 뒤집어 줘도 같은 답이어야 한다 — 백엔드 정렬을 믿지 않는다. */
  it('목록 순서에 기대지 않는다', () => {
    expect(lastCompletedDay([...일주일].reverse(), 오늘)?.date).toBe('2026-09-01');
  });

  it('완료된 날이 없으면 null', () => {
    expect(lastCompletedDay([{ date: 오늘, visitors: 37 }], 오늘)).toBeNull();
  });
});

describe('completedAverage', () => {
  it('완료된 날만으로 평균을 낸다', () => {
    /* (210+190+285+215+148+160) / 6 = 201.33… — 오늘의 37 이 섞이면 뚝 떨어진다 */
    expect(completedAverage(일주일, 오늘)).toBeCloseTo(201.33, 1);
  });

  /* 0 으로 답하면 '자료 없음' 이 '방문자 0명' 으로 읽힌다. */
  it('완료된 날이 없으면 null', () => {
    expect(completedAverage([{ date: 오늘, visitors: 37 }], 오늘)).toBeNull();
    expect(completedAverage([], 오늘)).toBeNull();
  });
});

describe('todayCount', () => {
  it('오늘 것만 집는다', () => {
    expect(todayCount(일주일, 오늘)).toBe(37);
  });

  it('오늘 기록이 아직 없으면 0', () => {
    expect(todayCount(일주일.slice(0, 3), 오늘)).toBe(0);
  });
});

describe('shortfallRatio', () => {
  it('덜 잡힌 비율을 낸다', () => {
    expect(shortfallRatio(160, 200)).toBeCloseTo(0.2, 5);
  });

  it('우리가 더 많이 셌으면 음수 — 그것도 이상 신호다', () => {
    expect(shortfallRatio(220, 200)).toBeCloseTo(-0.1, 5);
  });

  /* 0 으로 나누는 대신 판정 불가를 돌려준다. */
  it('기준값이 없거나 0 이면 null', () => {
    expect(shortfallRatio(160, 0)).toBeNull();
    expect(shortfallRatio(160, Number.NaN)).toBeNull();
    expect(shortfallRatio(Number.NaN, 200)).toBeNull();
  });
});

describe('isShortfallAlarming', () => {
  it('기준을 넘으면 경보', () => {
    expect(isShortfallAlarming(SHORTFALL_ALERT + 0.01)).toBe(true);
    expect(isShortfallAlarming(-(SHORTFALL_ALERT + 0.01))).toBe(true);
  });

  it('기준 안이면 조용하다', () => {
    expect(isShortfallAlarming(0.1)).toBe(false);
    expect(isShortfallAlarming(SHORTFALL_ALERT)).toBe(false);
  });

  /* 판정 불가를 경보로 치면 매일 울린다 — 그러면 아무도 안 본다. */
  it('판정 불가는 경보가 아니다', () => {
    expect(isShortfallAlarming(null)).toBe(false);
  });
});

describe('kstToday', () => {
  /* 서버가 어디서 돌든 브라우저가 어디에 있든 "한국에서 오늘" 이 하나여야 한다. */
  it('한국 기준으로 날짜를 낸다', () => {
    /* UTC 로 9/1 23:00 = KST 9/2 08:00 */
    expect(kstToday(new Date('2026-09-01T23:00:00Z'))).toBe('2026-09-02');
    /* UTC 로 9/2 14:00 = KST 9/2 23:00 — 아직 같은 날 */
    expect(kstToday(new Date('2026-09-02T14:00:00Z'))).toBe('2026-09-02');
    /* UTC 로 9/2 15:00 = KST 9/3 00:00 — 날이 바뀐다 */
    expect(kstToday(new Date('2026-09-02T15:00:00Z'))).toBe('2026-09-03');
  });
});

/**
 * <b>이 블록이 없었으면 이 화면 전체가 헛일이었다.</b>
 *
 * <p>통계 질의가 {@code to_char(created_at, 'MM-DD')} 라 날짜에 연도가 없다. 그대로
 * {@code '09-02' < '2026-09-02'} 로 비교하면 앞자리 {@code '0' < '2'} 때문에 언제나 참이 되어
 * 오늘까지 '완료된 날' 로 잡힌다 — 고치려던 바로 그 버그가 조용히 살아남는다.
 */
describe('toComparableDate', () => {
  it('연도 없는 MM-DD 에 올해를 붙인다', () => {
    expect(toComparableDate('09-01', 오늘)).toBe('2026-09-01');
  });

  it('이미 온전한 날짜는 그대로 둔다 — 서버가 고쳐져도 안 깨진다', () => {
    expect(toComparableDate('2026-09-01', 오늘)).toBe('2026-09-01');
  });

  it('점 구분자도 받는다', () => {
    expect(toComparableDate('09.01', 오늘)).toBe('2026-09-01');
  });

  /*
   * 1월 1일에 지난 7일을 보면 12월 말이 섞인다. 올해를 그냥 붙이면 12월이 미래가 되어
   * 통째로 사라진다 — 연말연시에만 조용히 자료가 비는 부류의 고장이다.
   */
  it('해가 바뀐 구간에서 작년으로 내린다', () => {
    expect(toComparableDate('12-31', '2027-01-01')).toBe('2026-12-31');
    expect(toComparableDate('01-01', '2027-01-01')).toBe('2027-01-01');
  });

  it('읽을 수 없으면 null — 억지로 끼워 맞추지 않는다', () => {
    expect(toComparableDate('', 오늘)).toBeNull();
    expect(toComparableDate('어제', 오늘)).toBeNull();
    expect(toComparableDate(null, 오늘)).toBeNull();
    expect(toComparableDate(undefined, 오늘)).toBeNull();
    expect(toComparableDate(20260901, 오늘)).toBeNull();
  });
});

describe('연도 없는 날짜로 들어와도 오늘이 안 섞인다', () => {
  /* 백엔드가 실제로 주는 모양 그대로. */
  const 짧은날짜 = [
    { date: '08-31', visitors: 148 },
    { date: '09-01', visitors: 160 },
    { date: '09-02', visitors: 37 }, // 오늘 — 진행 중
  ];

  it('오늘을 뺀다', () => {
    expect(completedDays(짧은날짜, 오늘).map((d) => d.date)).toEqual(['08-31', '09-01']);
  });

  it('가장 최근의 완료된 날을 고른다', () => {
    expect(lastCompletedDay(짧은날짜, 오늘)).toEqual({ date: '09-01', visitors: 160 });
  });

  it('평균에 오늘이 안 들어간다', () => {
    /* (148+160)/2 = 154. 오늘 37 이 섞이면 115 로 떨어진다. */
    expect(completedAverage(짧은날짜, 오늘)).toBe(154);
  });

  it('오늘 것은 오늘로 집는다', () => {
    expect(todayCount(짧은날짜, 오늘)).toBe(37);
  });
});
