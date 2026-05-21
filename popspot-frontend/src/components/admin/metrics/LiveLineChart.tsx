"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

/**
 * 실시간 시계열 라인 차트. 부모가 시계열 데이터를 push 만 해주면 된다.
 *
 * - `data` 의 각 원소는 {time, [series.key]: number}.
 * - `series` 배열에 키별 색·라벨을 정의.
 * - 부모가 buffer 슬라이딩 (`.slice(-N)`) 책임. 본 컴포넌트는 단순 표시.
 */
interface SeriesSpec {
  key: string;
  color: string;
  label: string;
}

interface LiveLineChartProps {
  data: Array<Record<string, unknown>>;
  series: SeriesSpec[];
  height?: number;
}

export function LiveLineChart({ data, series, height = 200 }: LiveLineChartProps) {
  return (
    <div className="w-full" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#88888820" />
          <XAxis
            dataKey="time"
            stroke="#555"
            fontSize={10}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            stroke="#555"
            fontSize={10}
            tickLine={false}
            axisLine={false}
            domain={[0, "auto"]}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "#1a1a1a",
              border: "none",
              borderRadius: "8px",
              color: "#fff",
            }}
          />
          {series.map((s) => (
            <Line
              key={s.key}
              type="monotone"
              dataKey={s.key}
              stroke={s.color}
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
              name={s.label}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
