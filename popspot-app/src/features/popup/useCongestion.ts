import { useEffect, useState } from 'react';

import { apiJson } from '@/lib/api';
import type { CongestionData } from '@/types/popup';

/**
 * 지역 혼잡도와 12시간 예측 — 시안 상세의 막대 그래프가 쓰는 <b>실제</b> 데이터.
 *
 * <p>중요한 단서가 하나 있다. 이건 <b>지역</b> 단위다({@code areaName: "성수카페거리"}). 팝업 하나의
 * 혼잡도가 아니다. 시안은 이 카드를 "지금 대기 현황" 이라 부르며 팝업별 예상 대기처럼 그렸는데,
 * 그렇게 쓰면 명동 팝업 상세에 성수 혼잡도가 붙는다.
 *
 * <p>그래서 화면에서는 <b>지역 이름을 함께 적는다.</b> 서버가 준 {@code areaName} 을 그대로 보여주면
 * 무엇에 대한 숫자인지가 분명해지고, 나중에 지역이 여럿으로 늘어도 화면을 고칠 필요가 없다.
 */

export interface CongestionState {
  data: CongestionData | null;
  loading: boolean;
}

export function useCongestion(area?: string): CongestionState {
  const [data, setData] = useState<CongestionData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    setLoading(true);

    const path = area ? `/api/congestion?area=${encodeURIComponent(area)}` : '/api/congestion';
    apiJson<CongestionData>(path)
      .then((next) => {
        if (alive) setData(next);
      })
      /* 혼잡도는 이 화면의 곁가지다. 못 받아도 상세는 그려져야 하므로 조용히 비운다. */
      .catch(() => {
        if (alive) setData(null);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [area]);

  return { data, loading };
}

/**
 * 이 12시간 예측이 <b>진짜</b>인가.
 *
 * <p>백엔드는 서울시 실시간 도시데이터에서 예측을 못 꺼내면 <b>난수로 만든 값</b>을 대신 준다
 * ({@code CongestionService.demoForecasts}: 13~24시 고정, 인구 10,000+rand(5,000)). 실측
 * 2026-08-30 08:56 에 받아 보니 시각표가 13~24시로 고정돼 있었고 인원이 호출마다 달랐다 —
 * <b>지금 오는 예측은 전부 그 난수다.</b>
 *
 * <p>구별하는 법은 {@code congestion} 칸이다. 진짜 경로({@code toForecastEntry})는 항상
 * {@code FCST_CONGEST_LVL} 을 함께 담고, 난수 경로는 {@code time}·{@code population} 둘뿐이다.
 * 값이 그럴듯한지로 재지 않고 <b>모양</b>으로 가른다 — 난수도 그럴듯한 값을 만들 수 있다.
 *
 * <p>이걸 가리는 이유는 화면이 그 위에 <b>LIVE</b> 배지를 붙이기 때문이다. 지어낸 숫자에 실시간
 * 딱지를 붙이면, "이 시간이 한산하다" 를 보고 그 시간에 찾아가는 사람이 생긴다.
 */
export function isForecastReal(data: CongestionData | null): boolean {
  const forecast = data?.forecast ?? data?.forecasts ?? [];
  if (forecast.length === 0) return false;
  return forecast.every((f) => typeof f.congestion === 'string' && f.congestion.length > 0);
}

/**
 * 12시간 예측을 막대 높이(0~1)로.
 *
 * <p>절대 인구수를 그대로 높이로 쓰면 막대가 전부 천장에 붙는다 — 성수 예측이 10,000~14,000명
 * 사이라 바닥이 0 이 아니기 때문이다. <b>최소값을 바닥으로 잡고 최대값까지를 펴서</b> 시간대 사이의
 * 차이가 보이게 한다. 이 그래프가 답하는 질문은 "몇 명인가" 가 아니라 "언제가 한산한가" 다.
 *
 * <p><b>지어낸 예측이면 빈 배열을 준다.</b> 그리지 않는 편이 낫다 — 아래 {@link quietestHour} 도
 * 같은 이유로 비운다.
 */
export function congestionBars(data: CongestionData | null): { time: string; height: number }[] {
  if (!isForecastReal(data)) return [];
  const forecast = data?.forecast ?? data?.forecasts ?? [];
  if (forecast.length === 0) return [];

  const pops = forecast.map((f) => f.population);
  const min = Math.min(...pops);
  const max = Math.max(...pops);
  const span = max - min;

  return forecast.map((f) => ({
    time: f.time,
    /* 전부 같은 값이면 나눗셈이 0 이 된다. 그때는 중간 높이로 평평하게 — 없는 차이를 만들지 않는다. */
    height: span === 0 ? 0.5 : 0.15 + ((f.population - min) / span) * 0.85,
  }));
}

/**
 * 가장 한산한 시간대.
 *
 * <p>지어낸 예측에서는 <b>뽑지 않는다.</b> 이 값은 화면에서 막대 하나를 라임으로 칠하는 데 쓰이고,
 * 그건 "이 시간에 가라" 는 말과 같다 — 난수로 그 말을 하면 안 된다.
 */
export function quietestHour(data: CongestionData | null): string | null {
  if (!isForecastReal(data)) return null;
  const forecast = data?.forecast ?? data?.forecasts ?? [];
  if (forecast.length === 0) return null;
  return forecast.reduce((best, f) => (f.population < best.population ? f : best)).time;
}
