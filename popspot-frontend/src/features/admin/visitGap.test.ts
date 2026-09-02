import { describe, expect, it } from 'vitest';

import { checkGap, expectedDuringGap, MIN_EXPECTED_TO_ALARM, type HourAverage } from './visitGap';

/**
 * 지키는 것은 둘이다 — <b>새벽에 안 울리고</b>, <b>낮에 멎으면 운다.</b>
 *
 * <p>매일 울리는 경보는 아무도 안 본다. 그래서 고정 임계값 대신 그 구간의 평소치와 견주는데,
 * 그 계산이 틀리면 둘 중 하나가 깨진다. 조용해야 할 때 울면 경보가 무의미해지고, 울어야 할 때
 * 조용하면 2026-08-13~19 처럼 기록이 통째로 빈 구간이 또 그냥 지나간다.
 */

/** 실제 모양에 가깝게 — 새벽은 한산하고 오후~저녁에 몰린다. 하루 합계 약 200. */
const 평소: HourAverage[] = [
  { hour: 0, perDay: 4 },
  { hour: 1, perDay: 2 },
  { hour: 2, perDay: 1 },
  { hour: 3, perDay: 0.4 },
  { hour: 4, perDay: 0.3 },
  { hour: 5, perDay: 0.5 },
  { hour: 6, perDay: 2 },
  { hour: 7, perDay: 4 },
  { hour: 8, perDay: 7 },
  { hour: 9, perDay: 10 },
  { hour: 10, perDay: 12 },
  { hour: 11, perDay: 13 },
  { hour: 12, perDay: 14 },
  { hour: 13, perDay: 14 },
  { hour: 14, perDay: 15 },
  { hour: 15, perDay: 15 },
  { hour: 16, perDay: 14 },
  { hour: 17, perDay: 13 },
  { hour: 18, perDay: 12 },
  { hour: 19, perDay: 12 },
  { hour: 20, perDay: 13 },
  { hour: 21, perDay: 12 },
  { hour: 22, perDay: 9 },
  { hour: 23, perDay: 6 },
];

/** KST 로 원하는 시각을 만든다. */
const kst = (iso: string) => new Date(`${iso}+09:00`);

describe('expectedDuringGap', () => {
  it('한 시간 공백이면 그 시각의 평소치만큼', () => {
    /* KST 15:00 기준 직전 한 시간 = 14시대 = 15 */
    expect(expectedDuringGap(평소, kst('2026-09-02T15:00:00'), 60)).toBeCloseTo(15, 5);
  });

  it('시각 경계를 넘으면 비례로 나눠 더한다', () => {
    /* 14:30 에서 90분 = 14시의 30분(15×0.5=7.5) + 13시의 60분(14) = 21.5 */
    expect(expectedDuringGap(평소, kst('2026-09-02T14:30:00'), 90)).toBeCloseTo(21.5, 5);
  });

  /* 하루를 넘게 비었으면 더 거슬러 올라가도 판단이 안 바뀐다. */
  it('하루치에서 멈춘다', () => {
    const 사흘 = expectedDuringGap(평소, kst('2026-09-02T15:00:00'), 3 * 24 * 60);
    const 하루 = expectedDuringGap(평소, kst('2026-09-02T15:00:00'), 24 * 60);

    expect(사흘).toBeCloseTo(하루!, 5);
  });

  it('근거가 없으면 null — 0 으로 답하면 모른다가 없다가 된다', () => {
    expect(expectedDuringGap([], kst('2026-09-02T15:00:00'), 60)).toBeNull();
    expect(expectedDuringGap(null, kst('2026-09-02T15:00:00'), 60)).toBeNull();
    expect(expectedDuringGap(평소, kst('2026-09-02T15:00:00'), 0)).toBeNull();
    expect(expectedDuringGap(평소, kst('2026-09-02T15:00:00'), Number.NaN)).toBeNull();
  });

  /*
   * 브라우저가 어느 시간대에 있든 <b>한국 시각</b>으로 판단해야 한다.
   *
   * 앞선 판은 "같은 순간을 다르게 적어도 같은 값" 을 봤는데, 그건 어느 존을 쓰든 참이라 아무것도
   * 지키지 못했다 — 존을 빼는 사보타주를 통과시켰다. 이제는 값을 못 박는다. 그 순간의 한국 시각은
   * 15시(평소 15건)이고 UTC 로는 6시(평소 2건)라, 브라우저 시각을 쓰면 이 검사가 깨진다.
   *
   * 다만 개발 PC 가 KST 라 여기서는 여전히 통과한다. <b>TZ=UTC 로 한 번 더 돌려야</b> 의미가 있다.
   */
  it('브라우저 시간대가 아니라 한국 시각의 평소치를 쓴다', () => {
    const 한국15시 = new Date('2026-09-02T06:00:00Z'); // = KST 15:00

    expect(expectedDuringGap(평소, 한국15시, 60)).toBeCloseTo(15, 5);
  });
});

describe('checkGap', () => {
  /* 이 검사가 경보를 쓸모 있게 만든다 — 매일 새벽에 울리면 아무도 안 본다. */
  it('새벽 세 시간 공백에는 울리지 않는다', () => {
    const now = kst('2026-09-02T05:00:00');
    const 마지막 = kst('2026-09-02T02:00:00').toISOString();

    const status = checkGap(마지막, 평소, now);

    expect(status.gapMinutes).toBeCloseTo(180, 0);
    expect(status.expected!).toBeLessThan(MIN_EXPECTED_TO_ALARM);
    expect(status.alarming).toBe(false);
  });

  it('오후 세 시간 공백에는 울린다', () => {
    const now = kst('2026-09-02T17:00:00');
    const 마지막 = kst('2026-09-02T14:00:00').toISOString();

    const status = checkGap(마지막, 평소, now);

    expect(status.gapMinutes).toBeCloseTo(180, 0);
    expect(status.expected!).toBeGreaterThan(MIN_EXPECTED_TO_ALARM);
    expect(status.alarming).toBe(true);
  });

  it('방금 기록이 들어왔으면 조용하다', () => {
    const now = kst('2026-09-02T15:00:00');
    const 마지막 = kst('2026-09-02T14:58:00').toISOString();

    expect(checkGap(마지막, 평소, now).alarming).toBe(false);
  });

  /* 근거 없이 울리는 경보는 진짜 경보까지 무디게 만든다. */
  it('마지막 기록이나 평균 자료가 없으면 울리지 않는다', () => {
    const now = kst('2026-09-02T15:00:00');

    expect(checkGap(null, 평소, now)).toEqual({
      gapMinutes: null,
      expected: null,
      alarming: false,
    });
    expect(checkGap('말도 안 되는 값', 평소, now).alarming).toBe(false);
    expect(checkGap(kst('2026-09-02T10:00:00').toISOString(), [], now).alarming).toBe(false);
  });

  /* 시계가 어긋나 마지막 기록이 미래로 보일 수 있다. 음수 공백을 만들면 안 된다. */
  it('마지막 기록이 미래여도 터지지 않는다', () => {
    const now = kst('2026-09-02T15:00:00');
    const 미래 = kst('2026-09-02T16:00:00').toISOString();

    const status = checkGap(미래, 평소, now);

    expect(status.gapMinutes).toBe(0);
    expect(status.alarming).toBe(false);
  });
});
