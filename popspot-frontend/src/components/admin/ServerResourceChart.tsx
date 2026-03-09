"use client";

import React, { useEffect, useState } from 'react';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, 
  ResponsiveContainer, Legend, AreaChart, Area 
} from 'recharts';
import { Activity, Cpu, HardDrive } from 'lucide-react';
import { apiFetch } from '../../lib/api';

interface MetricData {
  time: string;
  cpu: number;
  memory: number;
}

const ServerResourceChart = () => {
  const [data, setData] = useState<MetricData[]>([]);
  const [status, setStatus] = useState<'online' | 'offline'>('online');

  useEffect(() => {
    // 3초마다 백엔드에 서버 상태를 물어봅니다.
    const interval = setInterval(async () => {
      try {
        const res = await apiFetch("/api/admin/metrics/server-status");
        
        if (res.ok) {
          const newData = await res.json();
          setStatus('online');

          setData((prev) => {
            const now = new Date();
            const timeStr = `${now.getHours()}:${now.getMinutes()}:${now.getSeconds()}`;
            
            const updatedData = [
              ...prev,
              { 
                time: timeStr, 
                cpu: newData.cpu, 
                memory: newData.memory 
              }
            ];

            // 그래프가 너무 꽉 차지 않게 최근 20개 데이터만 유지합니다.
            return updatedData.slice(-20);
          });
        } else {
          setStatus('offline');
        }
      } catch (error) {
        console.error("Failed to fetch metrics:", error);
        setStatus('offline');
      }
    }, 3000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="w-full bg-[#111] border border-gray-800 rounded-2xl p-6 shadow-2xl">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-500/20 rounded-lg">
            <Activity className="w-6 h-6 text-indigo-400" />
          </div>
          <div>
            <h3 className="text-white font-bold text-lg">실시간 서버 리소스 (GCP)</h3>
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${status === 'online' ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
              <span className="text-gray-400 text-xs font-mono uppercase">{status}</span>
            </div>
          </div>
        </div>
        
        <div className="flex gap-4">
          <div className="text-right">
            <p className="text-gray-500 text-xs uppercase tracking-wider">Current CPU</p>
            <p className="text-indigo-400 font-mono font-bold">{data[data.length - 1]?.cpu || 0}%</p>
          </div>
          <div className="text-right border-l border-gray-800 pl-4">
            <p className="text-gray-500 text-xs uppercase tracking-wider">Current RAM</p>
            <p className="text-emerald-400 font-mono font-bold">{data[data.length - 1]?.memory || 0} MB</p>
          </div>
        </div>
      </div>

      <div className="h-[350px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <defs>
              <linearGradient id="colorCpu" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#6366f1" stopOpacity={0.1}/>
                <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#222" vertical={false} />
            <XAxis 
              dataKey="time" 
              stroke="#555" 
              fontSize={12} 
              tickLine={false} 
              axisLine={false}
              minTickGap={30}
            />
            <YAxis 
              stroke="#555" 
              fontSize={12} 
              tickLine={false} 
              axisLine={false}
              domain={[0, (dataMax: number) => Math.max(100, dataMax + 20)]}
            />
            <Tooltip 
              contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '12px' }}
              itemStyle={{ fontSize: '12px' }}
            />
            <Legend verticalAlign="top" height={36}/>
            
            {/* CPU 라인 */}
            <Line 
              type="monotone" 
              dataKey="cpu" 
              stroke="#6366f1" 
              strokeWidth={3}
              dot={false}
              name="CPU Usage (%)"
              isAnimationActive={false} // 실시간성을 위해 애니메이션 끎
            />
            
            {/* 메모리 라인 */}
            <Line 
              type="monotone" 
              dataKey="memory" 
              stroke="#10b981" 
              strokeWidth={3}
              dot={false}
              name="Memory (MB)"
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default ServerResourceChart;