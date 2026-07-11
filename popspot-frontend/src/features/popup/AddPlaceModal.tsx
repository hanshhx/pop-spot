"use client";

import { AnimatePresence, motion } from "framer-motion";
import { PlusCircle, X } from "lucide-react";
import type { PopupStore } from "@/types/popup";

interface AddPlaceModalProps {
  open: boolean;
  onClose: () => void;
  popups: PopupStore[];
  onSelect: (popup: PopupStore) => void;
}

/**
 * 코스 탭의 "장소 추가하기" 슬라이드업 시트.
 *
 * <p>뷰포트 전체를 덮는 모달이 아니라 부모 컨테이너 안에서 {@code absolute inset-0}
 * 으로 채우는 로컬 시트. 따라서 Radix Dialog 가 아닌 자체 motion 래퍼를 유지한다.
 * 비즈니스 로직(중복 체크/state 변경)은 부모에 두고 여기서는 선택 이벤트만 흘려보낸다.
 */
export function AddPlaceModal({
  open,
  onClose,
  popups,
  onSelect,
}: AddPlaceModalProps) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ y: "100%" }}
          animate={{ y: 0 }}
          exit={{ y: "100%" }}
          className="fixed inset-0 bg-surface z-[100] flex flex-col"
          role="dialog"
          aria-label="장소 추가하기"
        >
          <header className="p-4 border-b border-[var(--color-border)] flex justify-between items-center">
            <h3 className="font-bold text-lg text-foreground">장소 추가하기</h3>
            <button
              type="button"
              onClick={onClose}
              aria-label="닫기"
              className="size-9 inline-flex items-center justify-center bg-cream-300 dark:bg-ink-700 rounded-pill hover:bg-cream-400 dark:hover:bg-ink-600 transition-colors"
            >
              <X size={16} className="lg:w-5 lg:h-5" />
            </button>
          </header>
          <div className="flex-1 overflow-y-auto p-3 lg:p-4 custom-scrollbar">
            {popups.map((popup) => (
              <button
                key={popup.id}
                type="button"
                onClick={() => onSelect(popup)}
                className="w-full text-left flex justify-between items-center p-3 mb-2 border border-[var(--color-border)] rounded-md cursor-pointer hover:bg-cream-300 dark:hover:bg-ink-800 hover:border-lime-300/60 hover:scale-[1.01] active:scale-[0.99] transition-all"
              >
                <div>
                  <h4 className="font-semibold text-sm text-foreground">
                    {popup.name}
                  </h4>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {popup.location}
                  </p>
                </div>
                <PlusCircle size={18} className="text-lime-500" />
              </button>
            ))}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
