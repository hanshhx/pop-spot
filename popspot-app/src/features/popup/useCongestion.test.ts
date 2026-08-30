import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/api', () => ({ apiJson: vi.fn() }));

const { congestionBars, isForecastReal, quietestHour } = await import('./useCongestion');
import type { CongestionData } from '@/types/popup';

/**
 * 진짜 예측과 지어낸 예측을 가르는 판정.
 *
 * <p>백엔드는 서울시 API 에서 예측을 못 꺼내면 난수로 채운다
 * ({@code CongestionService.demoForecasts}). 실측 2026-08-30 08:56 에 받은 예측이 13~24시 고정에
 * 호출마다 인원이 달랐다 — 즉 <b>그때 오던 것은 전부 난수였다.</b>
 *
 * <p>화면은 그 위에 LIVE 배지를 붙이고 "가장 한산한 시간" 을 라임으로 칠한다. 그건 "이 시간에
 * 가라" 는 말이라, 난수로 하면 안 된다.
 */

const data = (
  forecasts: { time: string; population: number; congestion?: string }[],
): CongestionData => ({ level: '보통', forecasts } as unknown as CongestionData);

describe('isForecastReal', () => {
  it('모든 칸에 congestion 이 있으면 진짜', () => {
    expect(
      isForecastReal(
        data([
          { time: '13시', population: 100, congestion: '보통' },
          { time: '14시', population: 200, congestion: '붐빔' },
        ]),
      ),
    ).toBe(true);
  });

  it('congestion 이 없으면 지어낸 것 — demoForecasts 가 그 칸을 안 담는다', () => {
    expect(
      isForecastReal(
        data([
          { time: '13시', population: 12000 },
          { time: '14시', population: 13500 },
        ]),
      ),
    ).toBe(false);
  });

  it('한 칸이라도 비면 통째로 안 믿는다', () => {
    expect(
      isForecastReal(
        data([
          { time: '13시', population: 100, congestion: '보통' },
          { time: '14시', population: 200 },
        ]),
      ),
    ).toBe(false);
  });

  it('빈 문자열은 값이 아니다', () => {
    expect(isForecastReal(data([{ time: '13시', population: 100, congestion: '' }]))).toBe(false);
  });

  it('예측이 없거나 데이터가 없으면 false', () => {
    expect(isForecastReal(data([]))).toBe(false);
    expect(isForecastReal(null)).toBe(false);
  });
});

describe('congestionBars — 지어낸 예측은 안 그린다', () => {
  const fake = data([
    { time: '13시', population: 12000 },
    { time: '14시', population: 14000 },
  ]);
  const real = data([
    { time: '13시', population: 12000, congestion: '보통' },
    { time: '14시', population: 14000, congestion: '붐빔' },
  ]);

  it('난수 예측이면 빈 배열 — 화면이 그래프를 통째로 감춘다', () => {
    expect(congestionBars(fake)).toEqual([]);
  });

  it('진짜면 막대를 준다', () => {
    expect(congestionBars(real)).toHaveLength(2);
  });

  it('최소값이 바닥, 최대값이 천장 — 절대 인구수를 그대로 쓰면 전부 천장에 붙는다', () => {
    const bars = congestionBars(real);
    expect(bars[0].height).toBeCloseTo(0.15, 5);
    expect(bars[1].height).toBeCloseTo(1.0, 5);
  });

  it('전부 같은 값이면 평평하게 — 없는 차이를 만들지 않는다', () => {
    const flat = data([
      { time: '13시', population: 100, congestion: '보통' },
      { time: '14시', population: 100, congestion: '보통' },
    ]);
    expect(congestionBars(flat).map((b) => b.height)).toEqual([0.5, 0.5]);
  });
});

describe('quietestHour — 지어낸 예측으로는 시간을 권하지 않는다', () => {
  it('난수 예측이면 null', () => {
    expect(
      quietestHour(
        data([
          { time: '13시', population: 12000 },
          { time: '14시', population: 9000 },
        ]),
      ),
    ).toBeNull();
  });

  it('진짜면 가장 적은 시간대', () => {
    expect(
      quietestHour(
        data([
          { time: '13시', population: 12000, congestion: '붐빔' },
          { time: '14시', population: 9000, congestion: '여유' },
        ]),
      ),
    ).toBe('14시');
  });
});
