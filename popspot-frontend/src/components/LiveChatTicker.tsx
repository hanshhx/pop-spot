"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { MessageCircle, ArrowRight } from "lucide-react";
import Link from "next/link";
// 🔥 [수정] API 헬퍼 함수 import
import { apiFetch } from "../lib/api";

interface TickerMessage {
  popupName: string;
  popupId: string;
  sender: string;
  message: string;
}

export default function LiveChatTicker() {
  const [messages, setMessages] = useState<TickerMessage[]>([]);

  // 1. 최신 채팅 데이터 가져오기
  const fetchRecentChats = async () => {
    try {
      // 캐시 방지를 위해 타임스탬프 추가
      // 🔥 [수정] apiFetch 사용
      const res = await apiFetch(`/api/chat/ticker?t=${Date.now()}`);
      
      if (res.ok) {
        const data = await res.json();
        // 데이터가 너무 적으면 애니메이션이 끊기므로 복제해서 늘려줍니다.
        if (data.length > 0) {
          setMessages([...data, ...data, ...data]); 
        }
      }
    } catch (e) {
      console.error("티커 로딩 실패", e);
    }
  };

  useEffect(() => {
    fetchRecentChats();
    // 10초마다 갱신 (폴링 방식)
    const interval = setInterval(fetchRecentChats, 10000);
    return () => clearInterval(interval);
  }, []);

  if (messages.length === 0) return null;

  return (
    // 🔥 [반응형] 전체 마진 축소 (mb-12 md:mb-24)
    <div className="w-full mb-12 md:mb-24 overflow-hidden relative group">
       {/* 섹션 타이틀 */}
       {/* 🔥 [반응형] 타이틀 간격 및 폰트 사이즈 조절 */}
      <div className="flex items-center gap-1.5 md:gap-2 mb-3 md:mb-4 px-4 md:px-0">
        <div className="w-1.5 h-1.5 md:w-2 md:h-2 rounded-full bg-red-500 animate-pulse"></div>
        <h3 className="font-black text-lg md:text-xl text-gray-900 dark:text-white uppercase italic tracking-tighter">
            LIVE NOW <span className="text-gray-400 text-[10px] md:text-sm font-normal not-italic ml-1.5 md:ml-2">성수동 실시간 현황</span>
        </h3>
      </div>

      {/* 흐르는 티커 컨테이너 */}
      <div className="relative flex w-full overflow-hidden mask-linear-fade">
        {/* Framer Motion으로 무한 롤링 구현 */}
        {/* 🔥 [반응형] 티커 아이템 간격(gap-3 md:gap-4) 조절 */}
        <motion.div
          className="flex gap-3 md:gap-4"
          animate={{ x: ["0%", "-50%"] }} // 왼쪽으로 흐름
          transition={{
            ease: "linear",
            duration: 40, // 속도 조절 (숫자가 클수록 느림)
            repeat: Infinity,
          }}
        >
          {messages.map((msg, idx) => (
            <Link href={`/popup/${msg.popupId}`} key={idx} className="shrink-0">
              {/* 🔥 [반응형] 티커 박스 패딩 조절 */}
              <div className="
                flex items-center gap-2 md:gap-3 px-4 py-2 md:px-6 md:py-3 rounded-full border backdrop-blur-md transition-all cursor-pointer
                bg-white/80 border-gray-200 hover:border-indigo-500 hover:bg-white hover:shadow-lg
                dark:bg-white/5 dark:border-white/10 dark:hover:border-indigo-400 dark:hover:bg-white/10
              ">
                {/* 팝업 이름 배지 */}
                {/* 🔥 [반응형] 배지 폰트, 패딩 조절 */}
                <span className="text-[8px] md:text-[10px] font-bold text-white bg-indigo-600 px-1.5 md:px-2 py-0.5 rounded-md whitespace-nowrap">
                  {msg.popupName}
                </span>

                {/* 메시지 내용 */}
                {/* 🔥 [반응형] 텍스트 크기 조절 */}
                <div className="flex items-center gap-1.5 md:gap-2 text-xs md:text-sm">
                  <span className="font-bold text-gray-900 dark:text-gray-200">{msg.sender}:</span>
                  {/* 🔥 [반응형] 모바일에서는 긴 메시지 자르기 강도 상향 */}
                  <span className="text-gray-600 dark:text-gray-400 max-w-[120px] md:max-w-[200px] truncate">
                    {msg.message}
                  </span>
                </div>
                
                <MessageCircle className="text-gray-400 w-3.5 h-3.5 md:w-4 md:h-4" />
              </div>
            </Link>
          ))}
        </motion.div>
        
        {/* 좌우 그라데이션 (자연스럽게 사라지는 효과) */}
        {/* 🔥 [반응형] 좁은 폰 화면을 위해 그라데이션 폭 축소 (w-12 md:w-20) */}
        <div className="absolute inset-y-0 left-0 w-12 md:w-20 bg-gradient-to-r from-gray-50 dark:from-black to-transparent z-10 pointer-events-none"></div>
        <div className="absolute inset-y-0 right-0 w-12 md:w-20 bg-gradient-to-l from-gray-50 dark:from-black to-transparent z-10 pointer-events-none"></div>
      </div>
    </div>
  );
}