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
    return <div className="text-center p-4">데이터 로딩 중...</div>;
  }

  return (
    <div className="w-full h-64 bg-white rounded-xl shadow-lg p-4">
      <h3 className="text-lg font-bold text-gray-800 mb-4">📈 12시간 혼잡도 예측</h3>
      
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

          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eee" />

          <XAxis 
            dataKey="time" 
            tick={{ fontSize: 12, fill: '#666' }} 
            axisLine={false}
            tickLine={false}
          />

          <YAxis 
            hide={true} 
            domain={['dataMin - 1000', 'dataMax + 1000']} 
          />

          <Tooltip 
            contentStyle={{ backgroundColor: '#fff', borderRadius: '10px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
            // [수정 포인트] value 타입을 'any'나 'number | undefined'로 넓혀줘야 합니다.
            // Recharts 내부 타입과 맞추기 위해 가장 안전한 방법은 any를 쓰는 것입니다.
            formatter={(value: any) => [
              `${value ? value.toLocaleString() : 0}명`, 
              '예측 인구'
            ]}
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