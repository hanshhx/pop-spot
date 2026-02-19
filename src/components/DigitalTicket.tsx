"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { QrCode, Sparkles, MapPin, Calendar, User, Eye, X } from "lucide-react";
// 🔥 [수정 1] createPortal 추가 (모달을 body로 탈출시키기 위함)
import { createPortal } from "react-dom";
// 경로 확인 필수: src/components/Map/KakaoRoadview.tsx
import KakaoRoadview from "./Map/KakaoRoadview";

interface TicketProps {
  name: string;
  date: string;
  address: string;
  category: string;
  userName?: string;
  status?: string;
  lat: number;
  lng: number;
}

export default function DigitalTicket({ name, date, address, category, userName, status, lat, lng }: TicketProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  // 🔥 [수정 2] 클라이언트 렌더링 확인용 (Next.js SSR 에러 방지)
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (isModalOpen) {
      document.body.style.overflow = "hidden"; // 스크롤 잠금
    } else {
      document.body.style.overflow = "auto";
    }
    return () => {
      document.body.style.overflow = "auto";
    };
  }, [isModalOpen]);

  return (
    <>
      <div className="w-full h-full flex items-center justify-center relative p-4">
        
        {/* 배경 오로라 이펙트 (티켓 뒤쪽) */}
        <div className="absolute top-[-10%] left-[20%] w-[30%] h-[50%] bg-indigo-600/40 rounded-full blur-[120px] animate-pulse pointer-events-none" />
        <div className="absolute bottom-[-10%] right-[20%] w-[30%] h-[50%] bg-purple-600/40 rounded-full blur-[120px] animate-pulse delay-1000 pointer-events-none" />

        {/* 3D 티켓 카드 메인 */}
        <motion.div 
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.8, type: "spring" }}
          className="relative w-full max-w-4xl bg-[#1a1a1a]/95 backdrop-blur-2xl border border-white/10 rounded-[2.5rem] overflow-hidden shadow-[0_25px_50px_-12px_rgba(0,0,0,0.8)] flex flex-col md:flex-row z-10"
        >
          {/* 노이즈 질감 배경 */}
          <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-10 pointer-events-none"></div>
          
          {/* 상단 장식 포인트 바 */}
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 z-20"></div>

          {/* 🟢 왼쪽 섹션: 메인 컨텐츠 */}
          <div className="flex-1 p-8 md:p-12 flex flex-col justify-between relative z-10 border-b md:border-b-0 md:border-r border-dashed border-white/20">
              {/* 티켓 절취선 홈 (중앙 정렬 보정) */}
              <div className="absolute -right-3 top-1/2 w-6 h-6 bg-[#050505] rounded-full hidden md:block transform -translate-y-1/2 shadow-inner"></div>
              <div className="absolute -bottom-3 left-1/2 w-6 h-6 bg-[#050505] rounded-full md:hidden transform -translate-x-1/2 shadow-inner"></div>

              {/* 카테고리 & 상태 정보 라인 */}
              <div className="flex justify-between items-center mb-10">
                  <div className="flex items-center gap-2 px-4 py-1.5 rounded-full border border-white/10 bg-white/5">
                    <Sparkles size={14} className="text-indigo-400" />
                    <span className="text-[11px] font-black tracking-[0.2em] text-indigo-100 uppercase leading-none">
                      {category || "POP-UP"}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 bg-green-500/10 px-3 py-1.5 rounded-full border border-green-500/20">
                      <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse shadow-[0_0_10px_#4ade80]"></span>
                      <span className="text-[11px] font-bold text-green-400 tracking-tighter leading-none">{status || "OPEN"}</span>
                  </div>
              </div>

              {/* 팝업 이름 & 주소 (위치 보정) */}
              <div className="space-y-4 text-left">
                  <h2 className="text-4xl md:text-6xl font-black text-white leading-[1.1] tracking-tighter break-keep">
                      {name}
                  </h2>
                  <div className="flex items-start gap-2 text-white/60">
                      <MapPin size={18} className="text-purple-400 mt-1 shrink-0"/> 
                      <span className="text-base md:text-lg font-medium leading-snug">{address}</span>
                  </div>
              </div>

              {/* 하단 상세 메타 정보 */}
              <div className="mt-12 flex flex-wrap gap-10">
                  <div className="space-y-1.5">
                      <p className="text-[10px] text-white/30 uppercase tracking-widest font-bold leading-none">Valid Until</p>
                      <div className="flex items-center gap-2 text-white font-bold text-lg leading-none">
                          <Calendar size={16} className="text-indigo-400"/> {date}
                      </div>
                  </div>
                  <div className="space-y-1.5">
                      <p className="text-[10px] text-white/30 uppercase tracking-widest font-bold leading-none">Pass Holder</p>
                      {/* 🔥 [확인] 여기가 이름을 표시하는 부분입니다. userName이 있으면 닉네임, 없으면 VIP GUEST */}
                      <div className="flex items-center gap-2 text-white font-bold text-lg leading-none">
                          <User size={16} className="text-pink-400"/> {userName || "VIP GUEST"}
                      </div>
                  </div>
              </div>
          </div>

          {/* 🟢 오른쪽 섹션: 로드뷰 진입 버튼 영역 */}
          <div className="w-full md:w-80 bg-black/40 p-8 flex flex-col items-center justify-center relative z-10 py-12 md:py-0">
               {/* 반대편 절취선 홈 */}
               <div className="absolute -left-3 top-1/2 w-6 h-6 bg-[#050505] rounded-full hidden md:block transform -translate-y-1/2 shadow-inner"></div>
               
               
               
               {/* 로드뷰 열기 버튼 */}
               <button 
                  onClick={() => setIsModalOpen(true)}
                  className="group relative w-36 h-36 bg-white/5 border border-white/10 rounded-[2rem] flex flex-col items-center justify-center hover:bg-yellow-400 hover:border-yellow-300 transition-all duration-500 shadow-2xl"
               >
                  <Eye size={40} className="text-white group-hover:text-black group-hover:scale-110 transition-transform duration-500 mb-3" />
                  <span className="text-[11px] font-black text-white/80 group-hover:text-black tracking-widest uppercase leading-none">로드뷰 확인</span>
                  
                  {/* 외곽선 애니메이션 효과 */}
                  <div className="absolute inset-0 rounded-[2rem] ring-2 ring-white/10 group-hover:ring-transparent animate-pulse"></div>
               </button>

               <div className="font-mono text-[9px] text-white/20 mt-8 tracking-[0.2em] uppercase leading-none">
                  Tap to access view
               </div>
          </div>
        </motion.div>
      </div>

      {/* 🟢 [수정 핵심] Portal 사용: 모달을 body 바로 아래로 이동시켜 겹침(z-index) 문제 완벽 해결 */}
      {mounted && createPortal(
        <AnimatePresence>
          {isModalOpen && (
            <div className="fixed inset-0 z-[999999] flex items-center justify-center p-4 sm:p-12">
              {/* 배경 흐림 처리 (딤) */}
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setIsModalOpen(false)}
                className="absolute inset-0 bg-black/95 backdrop-blur-xl"
              />
              
              {/* 모달 본체 */}
              <motion.div 
                initial={{ opacity: 0, scale: 0.95, y: 30 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 30 }}
                transition={{ type: "spring", damping: 25, stiffness: 300 }}
                className="relative w-full max-w-6xl aspect-video bg-[#0d0d0d] rounded-[2.5rem] overflow-hidden shadow-[0_0_100px_rgba(0,0,0,1)] border border-white/10 z-[1000000]"
              >
                {/* 로드뷰 컴포넌트 */}
                <KakaoRoadview lat={lat} lng={lng} name={name} />

                {/* 닫기 버튼 */}
                <button 
                  onClick={() => setIsModalOpen(false)}
                  className="absolute top-6 right-6 p-4 bg-black/60 hover:bg-white text-white hover:text-black rounded-full backdrop-blur-2xl transition-all border border-white/10 z-[1000001] group"
                >
                  <X size={28} className="group-hover:rotate-90 transition-transform duration-300"/>
                </button>

                {/* 하단 위치 정보 라벨 */}
                <div className="absolute bottom-8 left-1/2 -translate-x-1/2 px-6 py-3 bg-black/60 backdrop-blur-md border border-white/10 rounded-full z-[1000001] flex items-center gap-3">
                   <MapPin size={16} className="text-yellow-400" />
                   <span className="text-white text-sm font-bold tracking-tight">{name} 목적지 뷰</span>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>,
        document.body // 👈 모달이 렌더링될 위치 (최상위)
      )}
    </>
  );
}