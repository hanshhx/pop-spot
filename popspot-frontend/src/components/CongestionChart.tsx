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
    // 🔥 반응형 및 다크모드 텍스트 적용
    return <div className="text-center p-4 text-xs md:text-sm text-gray-500 dark:text-cream-200/60">데이터 로딩 중...</div>;
  }

  return (
    // 🔥 [수정] 모바일/PC 높이 및 패딩 다르게 적용 (h-52 md:h-64 lg:h-72), 다크모드 배경색 완벽 대응
    <div className="w-full h-52 md:h-64 lg:h-72 bg-white dark:bg-[#1f1f1f] rounded-xl md:rounded-2xl shadow-lg p-3 md:p-5 border border-transparent dark:border-white/5 transition-colors">
      
      {/* 🔥 [수정] 폰트 사이즈 및 마진 반응형 적용, 다크모드 텍스트 색상 대응 */}
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