"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Lock, Check } from "lucide-react";
import { apiFetch } from "../../lib/api";
import { popupCoverUrl } from "@/lib/popupCover";
import type { User } from "@/types/popup";

/**
 * 여권 — '스탬프 = 방문한 팝업의 추억'.
 *
 * <p>개선안: 추상 라임 동그라미 대신 방문한 팝업 <b>사진 카드</b>(사진 + 이름 + 방문일 + 체크). 좁은 중앙 컬럼 →
 * 전체폭 그리드. 레벨·진행바·리워드는 MY '기록' 대시보드와 중복이라 제거. 사진이 없으면 카테고리 그라디언트.
 */

interface StampData {
  id: number;
  stampDate: string;
  popupStore: {
    popupId: number;
    name: string;
    category: string;
    imageUrl?: string;
  };
}

const CAT_GRAD: Record<string, string> = {
  FASHION: "from-pink-300 to-rose-400",
  FOOD: "from-amber-300 to-orange-400",
  CULTURE: "from-violet-300 to-indigo-400",
  CHARACTER: "from-lime-300 to-emerald-400",
  BEAUTY: "from-fuchsia-300 to-pink-400",
  TECH: "from-sky-300 to-cyan-400",
  ETC: "from-gray-300 to-gray-400",
};

const TOTAL_COUNT = 12;

export default function PassportView() {
  const [stamps, setStamps] = useState<StampData[]>([]);
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const storedUser = localStorage.getItem("user");
    if (storedUser) {
      try {
        setUser(JSON.parse(storedUser));
      } catch {
        /* 손상된 값 무시 */
      }
    }
  }, []);

  useEffect(() => {
    // [redesign/test 전용] 백엔드 없을 때(로컬 개발) 여권을 채우는 목업.
    const loadDevStamps = async () => {
      if (process.env.NODE_ENV !== "development") return;
      const { devMockPopups } = await import("@/lib/devMockPopups");
      setStamps(
        devMockPopups()
          .slice(0, 5)
          .map((p, i) => ({
            id: i,
            stampDate: `2026-03-0${i + 1}`,
            popupStore: {
              popupId: Number(p.id),
              name: p.name,
              category: p.category || "ETC",
              imageUrl: p.imageUrl,
            },
          })),
      );
    };

    if (user) {
      apiFetch(`/api/stamps/my?userId=${user.userId}`)
        .then((res) => res.json())
        .then((data) => setStamps(data))
        .catch(loadDevStamps);
    } else {
      // 비로그인/게스트: 실서비스는 빈 여권(0/12), 로컬 개발은 미리보기 목업.
      loadDevStamps();
    }
  }, [user]);

  const acquiredCount = stamps.length;
  const lockedCount = Math.max(0, TOTAL_COUNT - acquiredCount);

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="mx-auto w-full max-w-4xl px-4 py-6 md:px-6"
    >
      <header className="mb-6">
        <h2 className="text-2xl font-black text-foreground md:text-3xl">
          내 스탬프 <span className="text-lime-500">{acquiredCount}</span>
          <span className="font-bold text-muted-foreground"> / {TOTAL_COUNT}</span>
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          방문 인증할 때마다 그 팝업이 그대로 도장으로 남아요.
        </p>
      </header>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {stamps.map((s, idx) => {
          const grad = CAT_GRAD[s.popupStore.category?.toUpperCase()] ?? CAT_GRAD.ETC;
          return (
            <motion.div
              key={s.id}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: idx * 0.05 }}
              className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-white/10 dark:bg-white/[0.04]"
            >
              <div className={`relative aspect-square bg-gradient-to-br ${grad}`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={popupCoverUrl({
                    id: s.popupStore.popupId,
                    category: s.popupStore.category,
                    imageUrl: s.popupStore.imageUrl,
                  })}
                  alt=""
                  className="h-full w-full object-cover"
                />
                <span className="absolute right-2 top-2 grid h-7 w-7 place-items-center rounded-full bg-lime-400 text-ink-900 shadow-md">
                  <Check size={15} strokeWidth={3} />
                </span>
              </div>
              <div className="p-2.5">
                <p className="truncate text-xs font-bold text-foreground">{s.popupStore.name}</p>
                <p className="mt-0.5 text-[10px] text-muted-foreground">
                  {s.stampDate.split("T")[0]}
                </p>
              </div>
            </motion.div>
          );
        })}

        {Array.from({ length: lockedCount }).map((_, i) => (
          <div
            key={`locked-${i}`}
            className="flex aspect-square flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-gray-200 text-center dark:border-white/10"
          >
            <Lock size={22} className="text-gray-300 dark:text-white/20" />
            <span className="text-[11px] font-semibold text-muted-foreground">
              {i === 0 ? "다음 팝업" : "방문하면 열림"}
            </span>
          </div>
        ))}
      </div>
    </motion.div>
  );
}
