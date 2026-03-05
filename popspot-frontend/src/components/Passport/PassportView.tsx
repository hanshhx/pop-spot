"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Lock, CheckCircle, Award, Gift } from "lucide-react";
// 🔥 [수정] API 헬퍼 함수 import
import { apiFetch } from "../../lib/api";

// [기존 유지] 백엔드에서 받아올 데이터 형태 정의
interface StampData {
  id: number;
  stampDate: string;
  popupStore: {
      popupId: number;
      name: string;
      category: string;
  }
}

export default function PassportView() {
  const [stamps, setStamps] = useState<StampData[]>([]);
  
  // 실제 로그인 유저 정보를 담을 상태 추가
  const [user, setUser] = useState<any>(null);

  // 컴포넌트 로드 시 로그인한 유저 정보 확인 (localStorage)
  useEffect(() => {
    const storedUser = localStorage.getItem("user");
    if (storedUser) {
        setUser(JSON.parse(storedUser));
    }
  }, []);

  // 유저 정보가 확인되면, 그 유저의 ID로 스탬프 목록 가져오기
  useEffect(() => {
      if (!user) return;

      apiFetch(`/api/stamps/my?userId=${user.userId}`)
          .then(res => res.json())
          .then(data => {
              setStamps(data);
          })
          .catch(err => console.error("스탬프 로딩 실패:", err));
  }, [user]); 

  // 진행률 계산 (목표 12개로 설정)
  const totalCount = 12; 
  const acquiredCount = stamps.length;
  const progress = Math.min((acquiredCount / totalCount) * 100, 100);

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="w-full max-w-md mx-auto h-full flex flex-col pt-4 pb-32 px-6 overflow-y-auto custom-scrollbar"
    >
      {/* 1. 여권 헤더 (프로필) */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-3xl font-black text-white italic tracking-tighter">
            POP<span className="text-primary">-</span>PASSPORT
          </h2>
          <p className="text-muted text-xs mt-1">
            {user ? `${user.nickname}'s COLLECTION` : "SEOUL POP-UP COLLECTION"}
          </p>
        </div>
        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary to-purple-600 border-2 border-white flex items-center justify-center text-black font-bold text-lg shadow-[0_0_15px_rgba(var(--primary-rgb),0.5)]">
          {user ? user.nickname.substring(0, 2).toUpperCase() : "ME"}
        </div>
      </div>

      {/* 2. 레벨 및 진행률 카드 */}
      <div className="bg-white/5 border border-white/10 rounded-3xl p-6 mb-8 relative overflow-hidden">
        <div className="absolute top-0 right-0 p-4 opacity-10">
          <Award size={100} />
        </div>
        
        <div className="relative z-10">
          <div className="flex justify-between items-end mb-2">
            <div>
              <span className="text-primary font-bold text-xs border border-primary/30 px-2 py-1 rounded-full">
                Lv.{Math.floor(acquiredCount / 3) + 1} 트렌드 세터
              </span>
              <h3 className="text-2xl font-bold text-white mt-2">스탬프 콜렉터</h3>
            </div>
            <span className="text-3xl font-black italic">{acquiredCount}<span className="text-lg text-muted font-normal">/{totalCount}</span></span>
          </div>

          {/* 진행률 바 */}
          <div className="w-full h-3 bg-black/50 rounded-full overflow-hidden mt-4">
            <motion.div 
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 1, delay: 0.2 }}
              className="h-full bg-gradient-to-r from-primary to-purple-500 rounded-full"
            />
          </div>
          <p className="text-[10px] text-muted mt-2 text-right">다음 레벨까지 {3 - (acquiredCount % 3)}개 남았어요!</p>
        </div>
      </div>

      {/* 3. 스탬프 그리드 (핵심 - DB 연동) */}
      <div className="mb-8">
        <h3 className="text-white font-bold mb-4 flex items-center gap-2">
          <CheckCircle size={18} className="text-primary"/> MY STAMPS
        </h3>
        
        <div className="grid grid-cols-3 gap-4">
          {/* [1] 획득한 스탬프 렌더링 */}
          {stamps.map((stamp, idx) => (
            <motion.div
              key={stamp.id}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: idx * 0.1 }}
              className="aspect-square rounded-2xl relative flex flex-col items-center justify-center p-2 border bg-white/10 border-primary/50 shadow-[0_0_15px_rgba(var(--primary-rgb),0.2)] cursor-pointer group"
            >
                <div className={`w-12 h-12 rounded-full mb-2 bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-[10px] font-bold text-white shadow-inner`}>
                  {stamp.popupStore.category.slice(0, 4)}
                </div>
                <span className="text-[10px] text-primary font-bold text-center leading-tight truncate w-full px-1">
                    {stamp.popupStore.name}
                </span>
                <span className="text-[8px] text-muted mt-1">{stamp.stampDate.split('T')[0]}</span>
                
                {/* 도장 찍힌 효과 */}
                <div className="absolute top-1 right-1 w-16 h-16 border-2 border-primary/30 rounded-full opacity-50 rotate-[-15deg] pointer-events-none flex items-center justify-center">
                  <span className="text-[8px] text-primary/50 font-black uppercase tracking-widest">Visited</span>
                </div>
            </motion.div>
          ))}

          {/* [2] 빈 칸 렌더링 (LOCKED 상태) - 남은 개수만큼 채움 */}
          {Array.from({ length: Math.max(0, totalCount - stamps.length) }).map((_, i) => (
             <div key={`locked-${i}`} className="aspect-square rounded-2xl flex flex-col items-center justify-center p-2 border bg-black/40 border-white/5 opacity-30">
                <Lock size={24} className="text-white/20 mb-2"/>
                <span className="text-[10px] text-white/30 font-bold text-center leading-tight">LOCKED</span>
             </div>
          ))}
        </div>
      </div>

      {/* 4. 리워드/혜택 (🔥 현실적인 보상으로 변경) */}
      <div>
        <h3 className="text-white font-bold mb-4 flex items-center gap-2">
          <Gift size={18} className="text-secondary"/> REWARDS
        </h3>
        
        <div className="space-y-3">
          <div className={`bg-surface/50 p-4 rounded-2xl flex items-center gap-4 border transition-all ${acquiredCount >= 3 ? 'border-primary/50 bg-primary/10 opacity-100' : 'border-white/5 opacity-50'}`}>
            <div className="w-10 h-10 bg-white/10 rounded-full flex items-center justify-center text-muted">1</div>
            <div className="flex-1">
              <h4 className="text-sm font-bold text-white">📢 메이트 확성기 1개</h4>
              <p className="text-xs text-muted">스탬프 3개 달성 시 자동 지급</p>
            </div>
            <button 
              onClick={() => alert("스탬프 획득 시 인벤토리에 자동 지급되었습니다!\nMY 탭에서 확인해 보세요.")}
              disabled={acquiredCount < 3} 
              className={`text-xs px-3 py-1.5 rounded-full transition-colors whitespace-nowrap ${acquiredCount >= 3 ? 'bg-primary text-black font-bold hover:scale-105' : 'bg-white/5 text-white/30 cursor-not-allowed'}`}>
                {acquiredCount >= 3 ? '지급 완료' : '잠김'}
            </button>
          </div>

          <div className={`bg-surface/50 p-4 rounded-2xl flex items-center gap-4 border transition-all ${acquiredCount >= 6 ? 'border-primary/50 bg-primary/10 opacity-100' : 'border-white/5 opacity-50'}`}>
            <div className="w-10 h-10 bg-primary/20 rounded-full flex items-center justify-center text-primary font-bold">2</div>
            <div className="flex-1">
              <h4 className="text-sm font-bold text-white">📢 메이트 확성기 1개</h4>
              <p className="text-xs text-muted">스탬프 6개 달성 시 자동 지급</p>
            </div>
            <button 
              onClick={() => alert("스탬프 획득 시 인벤토리에 자동 지급되었습니다!\nMY 탭에서 확인해 보세요.")}
              disabled={acquiredCount < 6} 
              className={`text-xs px-3 py-1.5 rounded-full transition-colors whitespace-nowrap ${acquiredCount >= 6 ? 'bg-primary text-black font-bold hover:scale-105' : 'bg-white/5 text-white/30 cursor-not-allowed'}`}>
                {acquiredCount >= 6 ? '지급 완료' : '잠김'}
            </button>
          </div>
        </div>
      </div>

    </motion.div>
  );
}