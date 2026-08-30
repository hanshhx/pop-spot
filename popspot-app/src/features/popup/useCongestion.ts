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
 * 12시간 예측을 막대 높이(0~1)로.
 *
 * <p>절대 인구수를 그대로 높이로 쓰면 막대가 전부 천장에 붙는다 — 성수 예측이 10,000~14,000명
 * 사이라 바닥이 0 이 아니기 때문이다. <b>최소값을 바닥으로 잡고 최대값까지를 펴서</b> 시간대 사이의
 * 차이가 보이게 한다. 이 그래프가 답하는 질문은 "몇 명인가" 가 아니라 "언제가 한산한가" 다.
 */
export function congestionBars(data: CongestionData | null): { time: string; height: number }[] {
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

/** 가장 한산한 시간대. 시안이 "17시보다 26분 짧게" 라고 말하려던 자리에 들어갈 사실. */
export function quietestHour(data: CongestionData | null): string | null {
  const forecast = data?.forecast ?? data?.forecasts ?? [];
  if (forecast.length === 0) return null;
  return forecast.reduce((best, f) => (f.population < best.population ? f : best)).time;
}
