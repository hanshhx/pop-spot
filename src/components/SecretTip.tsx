"use client";

import { Lock, Crown } from "lucide-react";
import Link from "next/link";

interface Props {
  isPremium: boolean;
  tip: string; // 보여줄 꿀팁 내용
}

export default function SecretTip({ isPremium, tip }: Props) {
  return (
    <div className="mt-6 p-6 rounded-2xl border bg-gray-50 dark:bg-white/5 border-gray-200 dark:border-white/10 relative overflow-hidden group">
      <div className="flex items-center gap-2 mb-3">
        <Crown size={18} className="text-purple-500" />
        <h3 className="font-bold text-lg text-gray-900 dark:text-white">POP-SPOT 시크릿 꿀팁</h3>
      </div>

      {isPremium ? (
        // ✅ 프리미엄 유저: 내용 보임
        <div className="text-gray-700 dark:text-gray-300 font-medium leading-relaxed animate-in fade-in duration-500">
          {tip}
        </div>
      ) : (
        // 🔒 일반 유저: 블러 처리 + 잠금 화면
        <div className="relative">
          <p className="text-gray-400 dark:text-gray-600 blur-sm select-none">
            이 팝업은 오후 2시쯤 방문하면 웨이팅 없이 들어갈 수 있어요. 특히 입구 왼쪽 거울샷이 인생샷 명당입니다. 스태프에게...
          </p>
          
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/60 dark:bg-black/60 backdrop-blur-sm z-10 rounded-xl">
            <Lock className="text-gray-500 mb-2" size={24} />
            <p className="text-sm font-bold text-gray-800 dark:text-white mb-3">프리미엄 회원 전용 정보입니다</p>
            <Link href="/shop">
                <button className="px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white text-xs font-bold rounded-full hover:scale-105 transition-transform shadow-lg">
                POP-PASS로 잠금해제 🔓
                </button>
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}