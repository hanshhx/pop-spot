'use client';

import { Lock, Crown } from 'lucide-react';

interface Props {
  isPremium: boolean;
  tip: string; // 보여줄 꿀팁 내용
}

export default function SecretTip({ isPremium, tip }: Props) {
  return (
    <div className="mt-4 md:mt-6 p-4 md:p-6 rounded-xl md:rounded-2xl border bg-gray-50 dark:bg-white/5 border-gray-200 dark:border-white/10 relative overflow-hidden group">
      {/* 헤더 영역 반응형 갭 조절 */}
      <div className="flex items-center gap-1.5 md:gap-2 mb-2 md:mb-3">
        <Crown size={18} className="w-4 h-4 md:w-[18px] md:h-[18px] text-lime-500" />
        <h3 className="font-bold text-base md:text-lg text-gray-900 dark:text-white">
          POP-SPOT 시크릿 꿀팁
        </h3>
      </div>

      {isPremium ? (
        // ✅ 프리미엄 유저: 내용 보임 (반응형 폰트 조절)
        <div className="text-sm md:text-base text-gray-700 dark:text-gray-300 font-medium leading-relaxed animate-in fade-in duration-500">
          {tip}
        </div>
      ) : (
        // 🔒 일반 유저: 블러 처리 + 잠금 화면
        <div className="relative">
          {/* 블러 텍스트 반응형 조절 */}
          <p className="text-xs md:text-sm text-gray-400 dark:text-gray-600 blur-sm select-none leading-relaxed">
            이 팝업은 오후 2시쯤 방문하면 웨이팅 없이 들어갈 수 있어요. 특히 입구 왼쪽 거울샷이
            인생샷 명당입니다. 스태프에게...
          </p>

          <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/60 dark:bg-black/60 backdrop-blur-sm z-10 rounded-lg md:rounded-xl p-2">
            <Lock className="w-5 h-5 md:w-6 md:h-6 text-gray-500 mb-1.5 md:mb-2" />
            <p className="text-xs md:text-sm font-bold text-gray-800 dark:text-white mb-1 md:mb-2 text-center">
              프리미엄 회원 전용 정보입니다
            </p>
            <p className="text-[10px] md:text-xs text-gray-500 text-center">곧 다시 만나요 🍀</p>
          </div>
        </div>
      )}
    </div>
  );
}
