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
      <div className="w-full h-full flex items-center justify-center relative p-2 md:p-4">
        
        {/* 배경 오로라 이펙트 (티켓 뒤쪽) - 반응형 사이즈 조절 */}
        <div className="absolute top-[-10%] left-[10%] md:left-[20%] w-[50%] md:w-[30%] h-[50%] bg-indigo-600/40 rounded-full blur-[80px] md:blur-[120px] animate-pulse pointer-events-none" />
        <div className="absolute bottom-[-10%] right-[10%] md:right-[20%] w-[50%] md:w-[30%] h-[50%] bg-purple-600/40 rounded-full blur-[80px] md:blur-[120px] animate-pulse delay-1000 pointer-events-none" />

        {/* 3D 티켓 카드 메인 (반응형 둥글기 및 너비) */}
        <motion.div 
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.8, type: "spring" }}
          className="relative w-full max-w-4xl bg-[#1a1a1a]/95 backdrop-blur-2xl border border-white/10 rounded-3xl md:rounded-[2.5rem] overflow-hidden shadow-[0_15px_30px_-10px_rgba(0,0,0,0.8)] md:shadow-[0_25px_50px_-12px_rgba(0,0,0,0.8)] flex flex-col md:flex-row z-10"
        >
          {/* 노이즈 질감 배경 */}
          <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-10 pointer-events-none"></div>
          
          {/* 상단 장식 포인트 바 */}
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 z-20"></div>

          {/* 🟢 왼쪽 섹션: 메인 컨텐츠 (모바일 패딩 축소) */}
          <div className="flex-1 p-5 md:p-8 lg:p-12 flex flex-col justify-between relative z-10 border-b md:border-b-0 md:border-r border-dashed border-white/20">
              {/* 티켓 절취선 홈 (모바일은 가로선, PC는 세로선에 맞게 배치) */}
              <div className="absolute -right-3 top-1/2 w-6 h-6 bg-[#050505] rounded-full hidden md:block transform -translate-y-1/2 shadow-inner"></div>
              <div className="absolute -bottom-3 left-1/2 w-6 h-6 bg-[#050505] rounded-full md:hidden transform -translate-x-1/2 shadow-inner z-20"></div>

              {/* 카테고리 & 상태 정보 라인 (반응형 갭 및 폰트) */}
              <div className="flex justify-between items-center mb-6 md:mb-10">
                  <div className="flex items-center gap-1.5 md:gap-2 px-3 md:px-4 py-1 md:py-1.5 rounded-full border border-white/10 bg-white/5">
                    <Sparkles className="w-3 h-3 md:w-3.5 md:h-3.5 text-indigo-400" />
                    <span className="text-[9px] md:text-[11px] font-black tracking-[0.1em] md:tracking-[0.2em] text-indigo-100 uppercase leading-none">
                      {category || "POP-UP"}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 md:gap-2 bg-green-500/10 px-2.5 md:px-3 py-1 md:py-1.5 rounded-full border border-green-500/20">
                      <span className="w-1.5 h-1.5 md:w-2 md:h-2 rounded-full bg-green-400 animate-pulse shadow-[0_0_10px_#4ade80]"></span>
                      <span className="text-[9px] md:text-[11px] font-bold text-green-400 tracking-tighter leading-none">{status || "OPEN"}</span>
                  </div>
              </div>

              {/* 팝업 이름 & 주소 (반응형 폰트 축소) */}
              <div className="space-y-2 md:space-y-4 text-left">
                  <h2 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-black text-white leading-[1.1] md:leading-[1.1] tracking-tighter break-keep">
                      {name}
                  </h2>
                  <div className="flex items-start gap-1.5 md:gap-2 text-white/60">
                      <MapPin className="w-4 h-4 md:w-4.5 md:h-4.5 text-purple-400 mt-0.5 md:mt-1 shrink-0"/> 
                      <span className="text-xs sm:text-sm md:text-base lg:text-lg font-medium leading-snug">{address}</span>
                  </div>
              </div>

              {/* 하단 상세 메타 정보 (모바일에서는 간격 좁힘) */}
              <div className="mt-8 md:mt-12 flex flex-wrap gap-6 md:gap-10">
                  <div className="space-y-1 md:space-y-1.5">
                      <p className="text-[8px] md:text-[10px] text-white/30 uppercase tracking-widest font-bold leading-none">Valid Until</p>
                      <div className="flex items-center gap-1.5 md:gap-2 text-white font-bold text-sm md:text-lg leading-none">
                          <Calendar className="w-3.5 h-3.5 md:w-4 md:h-4 text-indigo-400"/> {date}
                      </div>
                  </div>
                  <div className="space-y-1 md:space-y-1.5">
                      <p className="text-[8px] md:text-[10px] text-white/30 uppercase tracking-widest font-bold leading-none">Pass Holder</p>
                      {/* 🔥 [확인] 여기가 이름을 표시하는 부분입니다. userName이 있으면 닉네임, 없으면 VIP GUEST */}
                      <div className="flex items-center gap-1.5 md:gap-2 text-white font-bold text-sm md:text-lg leading-none">
                          <User className="w-3.5 h-3.5 md:w-4 md:h-4 text-pink-400"/> {userName || "VIP GUEST"}
                      </div>
                  </div>
              </div>
          </div>

          {/* 🟢 오른쪽 섹션: 로드뷰 진입 버튼 영역 (모바일 패딩 축소) */}
          <div className="w-full md:w-64 lg:w-80 bg-black/40 p-6 md:p-8 flex flex-col items-center justify-center relative z-10 py-8 md:py-0">
               {/* 반대편 절취선 홈 */}
               <div className="absolute -left-3 top-1/2 w-6 h-6 bg-[#050505] rounded-full hidden md:block transform -translate-y-1/2 shadow-inner z-20"></div>
               <div className="absolute -top-3 left-1/2 w-6 h-6 bg-[#050505] rounded-full md:hidden transform -translate-x-1/2 shadow-inner z-20"></div>
               
               {/* 로드뷰 열기 버튼 (반응형 크기 축소) */}
               <button 
                  onClick={() => setIsModalOpen(true)}
                  className="group relative w-24 h-24 md:w-32 md:h-32 lg:w-36 lg:h-36 bg-white/5 border border-white/10 rounded-2xl md:rounded-[2rem] flex flex-col items-center justify-center hover:bg-yellow-400 hover:border-yellow-300 transition-all duration-500 shadow-xl md:shadow-2xl"
               >
                  <Eye className="w-8 h-8 md:w-10 md:h-10 text-white group-hover:text-black group-hover:scale-110 transition-transform duration-500 mb-2 md:mb-3" />
                  <span className="text-[9px] md:text-[10px] lg:text-[11px] font-black text-white/80 group-hover:text-black tracking-widest uppercase leading-none">로드뷰 확인</span>
                  
                  {/* 외곽선 애니메이션 효과 */}
                  <div className="absolute inset-0 rounded-2xl md:rounded-[2rem] ring-2 ring-white/10 group-hover:ring-transparent animate-pulse"></div>
               </button>

               <div className="font-mono text-[8px] md:text-[9px] text-white/20 mt-4 md:mt-8 tracking-[0.1em] md:tracking-[0.2em] uppercase leading-none text-center">
                 Tap to access view
               </div>
          </div>
        </motion.div>
      </div>

      {/* 🟢 [수정 핵심] Portal 사용: 모달을 body 바로 아래로 이동시켜 겹침(z-index) 문제 완벽 해결 */}
      {mounted && createPortal(
        <AnimatePresence>
          {isModalOpen && (
            <div className="fixed inset-0 z-[999999] flex items-center justify-center p-2 sm:p-6 md:p-12">
              {/* 배경 흐림 처리 (딤) */}
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setIsModalOpen(false)}
                className="absolute inset-0 bg-black/95 backdrop-blur-xl"
              />
              
              {/* 모달 본체 (모바일에서는 화면 높이에 맞춤) */}
              <motion.div 
                initial={{ opacity: 0, scale: 0.95, y: 30 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 30 }}
                transition={{ type: "spring", damping: 25, stiffness: 300 }}
                className="relative w-full max-w-6xl h-[70vh] md:h-auto md:aspect-video bg-[#0d0d0d] rounded-2xl md:rounded-[2.5rem] overflow-hidden shadow-[0_0_50px_rgba(0,0,0,0.8)] md:shadow-[0_0_100px_rgba(0,0,0,1)] border border-white/10 z-[1000000]"
              >
                {/* 로드뷰 컴포넌트 */}
                <KakaoRoadview lat={lat} lng={lng} name={name} />

                {/* 닫기 버튼 (모바일 사이즈 조절) */}
                <button 
                  onClick={() => setIsModalOpen(false)}
                  className="absolute top-4 right-4 md:top-6 md:right-6 p-2 md:p-4 bg-black/60 hover:bg-white text-white hover:text-black rounded-full backdrop-blur-2xl transition-all border border-white/10 z-[1000001] group shadow-lg"
                >
                  <X className="w-5 h-5 md:w-7 md:h-7 group-hover:rotate-90 transition-transform duration-300"/>
                </button>

                {/* 하단 위치 정보 라벨 (모바일 사이즈 조절) */}
                <div className="absolute bottom-6 md:bottom-8 left-1/2 -translate-x-1/2 px-4 md:px-6 py-2 md:py-3 bg-black/60 backdrop-blur-md border border-white/10 rounded-full z-[1000001] flex items-center gap-2 md:gap-3 shadow-lg whitespace-nowrap max-w-[90%] overflow-hidden">
                   <MapPin className="w-3.5 h-3.5 md:w-4 md:h-4 text-yellow-400 shrink-0" />
                   <span className="text-white text-xs md:text-sm font-bold tracking-tight truncate">{name} 목적지 뷰</span>
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