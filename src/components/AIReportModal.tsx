"use client";

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { X, Thermometer, Users, Clock, MapPin, RefreshCw, CloudRain } from 'lucide-react';
// [✨ 추가] 아까 만든 이쁜 차트 컴포넌트 import
import CongestionChart from "./CongestionChart";

interface Props {
  // 초기 데이터 (처음 열었을 때 보여줄 데이터)
  data: any; 
  onClose: () => void;
}

// 🗺️ 6대 핫플레이스 정의 (백엔드 키값과 일치)
const HOTSPOTS = [
    { key: "SEONGSU", label: "성수/서울숲" },
    { key: "YEOUIDO", label: "여의도(더현대)" },
    { key: "HONGDAE", label: "홍대/연남" },
    { key: "GANGNAM", label: "강남/코엑스" },
    { key: "YONGSAN", label: "용산/이태원" },
    { key: "MYEONGDONG", label: "명동/DDP" },
];

export default function AIReportModal({ data: initialData, onClose }: Props) {
  // 현재 선택된 탭 (기본값: 성수)
  const [activeTab, setActiveTab] = useState("SEONGSU");
  // 화면에 보여줄 데이터 상태 (초기값: props로 받은 데이터)
  const [reportData, setReportData] = useState<any>(initialData);
  const [loading, setLoading] = useState(false);

  // 탭이 바뀔 때마다 백엔드에서 새 데이터 가져오기
  useEffect(() => {
    // 첫 렌더링이고 초기 데이터가 성수라면 스킵 (불필요한 호출 방지)
    if (activeTab === "SEONGSU" && initialData?.areaName?.includes("성수")) {
        setReportData(initialData);
        return;
    }

    setLoading(true);
    fetch(`http://localhost:8080/api/congestion?area=${activeTab}`)
      .then(res => res.json())
      .then(result => {
        setReportData(result);
        setLoading(false);
      })
      .catch(err => {
        console.error("데이터 로딩 실패", err);
        setLoading(false);
      });
  }, [activeTab, initialData]);

  // 혼잡도별 색상
  const getColor = (lvl: string) => {
    if (lvl === '여유') return 'bg-green-500';
    if (lvl === '보통') return 'bg-yellow-500';
    if (lvl === '약간 붐빔') return 'bg-orange-500';
    return 'bg-red-500';
  };

  // 데이터가 아예 없으면 렌더링 안 함
  if (!reportData && !loading) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* 배경 (클릭 시 닫힘) */}
      <motion.div 
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm" 
        onClick={onClose}
      />

      {/* 모달 창 */}
      <motion.div 
        initial={{ scale: 0.9, opacity: 0, y: 20 }} 
        animate={{ scale: 1, opacity: 1, y: 0 }} 
        exit={{ scale: 0.9, opacity: 0, y: 20 }}
        className="relative w-full max-w-lg bg-white dark:bg-[#1a1a1a] rounded-[2rem] shadow-2xl overflow-hidden border border-gray-200 dark:border-white/10 flex flex-col max-h-[90vh]"
      >
        {/* 헤더 & 탭 영역 */}
        <div className="p-6 pb-2 flex flex-col gap-4 bg-white dark:bg-[#1a1a1a] sticky top-0 z-10">
            <div className="flex justify-between items-start">
                <div>
                    <span className="text-xs font-bold text-indigo-500 bg-indigo-500/10 px-3 py-1 rounded-full mb-2 inline-flex items-center gap-1">
                        <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-pulse"/> LIVE DATA
                    </span>
                    <h2 className="text-2xl font-black text-gray-900 dark:text-white">서울 핫스팟 AI 리포트</h2>
                    <p className="text-sm text-gray-500 dark:text-white/60">실시간 유동인구 및 혼잡도 분석</p>
                </div>
                <button onClick={onClose} className="p-2 bg-gray-100 dark:bg-white/10 rounded-full hover:rotate-90 transition-transform">
                    <X size={20} className="text-gray-900 dark:text-white"/>
                </button>
            </div>

            {/* 지역 선택 탭 */}
            <div className="flex gap-2 overflow-x-auto custom-scrollbar pb-2 -mx-2 px-2">
                {HOTSPOTS.map((spot) => (
                    <button
                        key={spot.key}
                        onClick={() => setActiveTab(spot.key)}
                        className={`px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-all border ${
                            activeTab === spot.key 
                            ? "bg-indigo-600 text-white border-indigo-600 shadow-md scale-105" 
                            : "bg-gray-50 text-gray-500 border-gray-200 dark:bg-white/5 dark:text-white/40 dark:border-white/5 hover:bg-gray-100"
                        }`}
                    >
                        {spot.label}
                    </button>
                ))}
            </div>
        </div>

        {/* 바디 (스크롤 가능) */}
        <div className="p-6 pt-2 space-y-6 overflow-y-auto">
          
          {/* 로딩 중일 때 표시 */}
          {loading ? (
              <div className="flex flex-col items-center justify-center py-20 gap-4 opacity-50">
                  <RefreshCw className="animate-spin text-indigo-500" size={40}/>
                  <p className="text-sm font-bold text-gray-500">실시간 데이터 분석 중...</p>
              </div>
          ) : (
            <>
                {/* 1. 현재 상태 카드 */}
                <div className={`p-6 rounded-2xl border-2 transition-colors ${
                    reportData.level === '여유' ? 'border-green-500/20 bg-green-50/50 dark:bg-green-900/10' :
                    reportData.level === '보통' ? 'border-yellow-500/20 bg-yellow-50/50 dark:bg-yellow-900/10' :
                    'border-red-500/20 bg-red-50/50 dark:bg-red-900/10'
                }`}>
                    <div className="flex justify-between items-center mb-4">
                        <div className="flex items-center gap-2 text-gray-500 dark:text-white/60 text-sm font-medium">
                            <MapPin size={16} /> {reportData.areaName}
                        </div>
                        <span className="text-xs bg-white dark:bg-black/30 px-2 py-1 rounded border border-black/5 dark:border-white/10">
                            실시간 업데이트됨
                        </span>
                    </div>
                    
                    <div className="flex items-end justify-between">
                        <div>
                            <p className="text-sm text-gray-500 dark:text-white/60 mb-1">현재 혼잡도</p>
                            <h3 className={`text-4xl font-black ${
                                reportData.level === '여유' ? 'text-green-600 dark:text-green-400' : 
                                reportData.level === '보통' ? 'text-yellow-600 dark:text-yellow-400' : 
                                'text-red-600 dark:text-red-400'
                            }`}>
                                {reportData.level}
                            </h3>
                        </div>
                        <div className="text-right">
                            <p className="text-xs text-gray-400 mb-1">실시간 인구</p>
                            <p className="text-xl font-bold text-gray-900 dark:text-white">
                                {reportData.minPop?.toLocaleString()}명 ~
                            </p>
                        </div>
                    </div>
                    <p className="mt-4 text-sm text-gray-600 dark:text-gray-300 leading-relaxed bg-white/50 dark:bg-black/20 p-3 rounded-xl">
                        {reportData.message}
                    </p>
                </div>

                {/* 2. 날씨 및 방문자 통계 */}
                <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 rounded-2xl border border-gray-100 dark:border-white/5 bg-blue-50/50 dark:bg-blue-900/10">
                    <div className="flex items-center gap-2 mb-2 text-blue-600 dark:text-blue-400 font-bold text-sm">
                        <Thermometer size={16}/> 현재 날씨
                    </div>
                    <div className="flex items-end gap-2">
                        <p className="text-3xl font-bold text-gray-900 dark:text-white">{reportData.temp}°</p>
                        <span className="text-sm text-gray-500 mb-1">{reportData.sky}</span>
                    </div>
                    <div className="mt-2 text-xs text-blue-500 flex items-center gap-1">
                        <CloudRain size={12}/> 강수확률 {reportData.rainChance}%
                    </div>
                    </div>
                    <div className="p-4 rounded-2xl border border-gray-100 dark:border-white/5 bg-purple-50/50 dark:bg-purple-900/10">
                    <div className="flex items-center gap-2 mb-2 text-purple-600 dark:text-purple-400 font-bold text-sm">
                        <Users size={16}/> 방문자 1위
                    </div>
                    <p className="text-3xl font-bold text-gray-900 dark:text-white">
                        {reportData.ageRates?.['20s'] > reportData.ageRates?.['30s'] ? '20대' : '30대'}
                    </p>
                    <p className="text-xs text-gray-500 mt-2">
                        20대 {reportData.ageRates?.['20s']}%, 30대 {reportData.ageRates?.['30s']}%
                    </p>
                    </div>
                </div>

                {/* 3. [🔥 교체됨] 시간대별 혼잡도 예측 (라이브러리 차트) */}
                
                <div>
                    <div className="flex items-center gap-2 mb-4">
                        <Clock size={18} className="text-gray-400"/>
                        <h4 className="font-bold text-gray-900 dark:text-white">시간대별 혼잡도 예측</h4>
                    </div>
                    
                    {/* 기존의 막대기 div 로직을 삭제하고 아까 만든 CongestionChart로 교체합니다. */}
                    <div className="text-black overflow-hidden">
                         <CongestionChart data={reportData.forecasts || reportData.forecast || []} />
                    </div>
                </div>

                {/* AI 한줄 코멘트 */}
                <div className="bg-gray-900 dark:bg-white text-white dark:text-black p-5 rounded-2xl text-sm font-medium text-center shadow-lg">
                    "지금 {reportData.areaName}은 <strong>{reportData.level}</strong> 상태네요!<br/>
                    {reportData.level === '여유' 
                        ? '웨이팅 없이 팝업 즐기기 딱 좋은 타이밍! ⚡️' 
                        : '사람이 많아요. 원격 줄서기 걸어두고 카페 타임 추천! ☕'} "
                </div>
            </>
          )}

        </div>
      </motion.div>
    </div>
  );
}