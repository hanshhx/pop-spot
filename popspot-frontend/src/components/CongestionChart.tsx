import React from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from 'recharts';

// 1. 데이터 타입 정의
interface ForecastData {
  time: string;
  population: number;
  congestion?: string;
}

// 2. 컴포넌트 Props 타입 정의
interface CongestionChartProps {
  data: ForecastData[];
}

const CongestionChart: React.FC<CongestionChartProps> = ({ data }) => {
  if (!data || data.length === 0) {
    return <div className="text-center p-4 text-xs md:text-sm text-gray-500 dark:text-cream-200/60">데이터 로딩 중...</div>;
  }

  return (
    <div className="w-full h-52 md:h-64 lg:h-72 bg-white dark:bg-[#1f1f1f] rounded-xl md:rounded-2xl shadow-lg p-3 md:p-5 border border-transparent dark:border-white/5 transition-colors">
      <h3 className="text-sm md:text-base lg:text-lg font-bold text-gray-800 dark:text-white mb-2 md:mb-4">
        📈 12시간 혼잡도 예측
      </h3>

      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={data}
          margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
        >
          <defs>
            <linearGradient id="colorPop" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#8884d8" stopOpacity={0.8}/>
              <stop offset="95%" stopColor="#8884d8" stopOpacity={0}/>
            </linearGradient>
          </defs>

          {/* 다크모드에서도 너무 튀지 않게 opacity 조절 */}
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eee" opacity={0.2} />

          <XAxis
            dataKey="time"
            tick={{ fontSize: 12, fill: '#888' }}
            axisLine={false}
            tickLine={false}
          />

          <YAxis
            hide={true}
            domain={['dataMin - 1000', 'dataMax + 1000']}
          />

          <Tooltip
            contentStyle={{ backgroundColor: '#fff', borderRadius: '10px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', color: '#000' }}
            // Recharts formatter value 는 ValueType (string | number | array | undefined).
            // 차트 데이터는 number 만 들어오지만 라이브러리 시그니처에 맞춰 안전하게 좁힌다.
            formatter={(value) => {
              const display = typeof value === 'number' ? value.toLocaleString() : String(value ?? 0);
              return [`${display}명`, '예측 인구'];
            }}
          />

          <Area
            type="monotone"
            dataKey="population"
            stroke="#8884d8"
            strokeWidth={3}
            fillOpacity={1}
            fill="url(#colorPop)"
            animationDuration={1500}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};

export default CongestionChart;
