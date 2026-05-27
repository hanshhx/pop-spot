"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, X, Loader2, MapPin } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

import { apiFetch } from "@/lib/api";

/**
 * v2.21-S5 — 헤더 인라인 통합검색.
 *
 * <p>이전엔 돋보기 클릭 → GlobalSearchModal 전체 화면 모달. 사용자가 더 가벼운 UX 원해
 * 인라인 펼침 + 드롭다운 결과 패턴으로 교체.
 *
 * <p>UX:
 *
 * <ul>
 *   <li>처음엔 라벨 "통합검색" + 돋보기 칩. 다른 헤더 버튼 (벨/사용자) 과 차별화.
 *   <li>클릭 → input 으로 좌우 확장 (animated width). placeholder 노출.
 *   <li>타이핑 → 200ms debounce → /api/popups/search?keyword=... 호출 → 드롭다운 결과 (max 8).
 *   <li>결과 클릭 → /popup/[id]. ESC / blur (외부 클릭) → 다시 칩 형태로 수축.
 * </ul>
 */

type Hit = {
  id: number;
  name: string;
  location?: string | null;
};

const MAX_HITS = 8;
const DEBOUNCE_MS = 200;

export default function InlineGlobalSearch() {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // ESC 닫기 + 외부 클릭 닫기
  useEffect(() => {
    if (!isOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") close();
    }
    function onClickOutside(e: MouseEvent) {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(e.target as Node)) close();
    }
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onClickOutside);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onClickOutside);
    };
  }, [isOpen]);

  // 펼침 시 input focus
  useEffect(() => {
    if (isOpen) inputRef.current?.focus();
  }, [isOpen]);

  // 디바운스된 검색
  useEffect(() => {
    if (!isOpen) return;
    const q = query.trim();
    if (q.length < 2) {
      setHits([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    const timer = setTimeout(() => {
      apiFetch(`/api/popups/search?keyword=${encodeURIComponent(q)}`, {
        signal: ctrl.signal,
      })
        .then((res) => (res.ok ? res.json() : []))
        .then((data: Hit[]) => {
          if (ctrl.signal.aborted) return;
          setHits((data ?? []).slice(0, MAX_HITS));
        })
        .catch(() => {
          /* abort 또는 네트워크 — 조용히 무시 */
        })
        .finally(() => {
          if (!ctrl.signal.aborted) setLoading(false);
        });
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [query, isOpen]);

  function open() {
    setIsOpen(true);
  }

  function close() {
    setIsOpen(false);
    setQuery("");
    setHits([]);
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const q = query.trim();
    if (!q) return;
    if (hits[0]) {
      router.push(`/popup/${hits[0].id}`);
      close();
    }
  }

  function goToHit(id: number) {
    router.push(`/popup/${id}`);
    close();
  }

  return (
    <div ref={containerRef} className="relative">
      <AnimatePresence initial={false} mode="wait">
        {!isOpen ? (
          <motion.button
            key="trigger"
            type="button"
            onClick={open}
            aria-label="통합검색 열기"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="group inline-flex items-center gap-2 h-10 pl-3 pr-4 rounded-pill border bg-lime-300 text-ink-900 border-lime-400 hover:bg-lime-400 transition-colors shadow-sm font-bold text-xs md:text-sm whitespace-nowrap"
          >
            <Search size={14} className="shrink-0" />
            <span>통합검색</span>
          </motion.button>
        ) : (
          <motion.form
            key="input"
            onSubmit={onSubmit}
            initial={{ width: 40, opacity: 0 }}
            animate={{ width: "100%", opacity: 1 }}
            exit={{ width: 40, opacity: 0 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
            className="flex items-center h-10 rounded-pill border bg-white dark:bg-[#1a1a1a] border-lime-400 dark:border-lime-300/50 shadow-md min-w-[220px] md:min-w-[320px] overflow-hidden"
            role="search"
            aria-label="통합검색"
          >
            <span className="pl-3 text-lime-600 dark:text-lime-300 shrink-0">
              <Search size={16} />
            </span>
            <input
              ref={inputRef}
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="팝업 이름 / 지역 검색…"
              className="flex-1 h-full px-3 bg-transparent text-sm text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-white/40 focus:outline-none"
            />
            {loading && (
              <span className="pr-2 text-lime-500 shrink-0" aria-hidden>
                <Loader2 size={14} className="animate-spin" />
              </span>
            )}
            <button
              type="button"
              onClick={close}
              aria-label="검색 닫기"
              className="pr-3 pl-1 text-gray-400 dark:text-white/40 hover:text-gray-600 dark:hover:text-white/70 shrink-0"
            >
              <X size={16} />
            </button>
          </motion.form>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isOpen && query.trim().length >= 2 && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15 }}
            className="absolute top-12 right-0 left-0 z-50 rounded-2xl border bg-white dark:bg-[#111] border-gray-200 dark:border-white/10 shadow-xl max-h-80 overflow-y-auto"
            role="listbox"
          >
            {loading && hits.length === 0 ? (
              <p className="p-4 text-xs text-muted-foreground text-center">검색 중…</p>
            ) : hits.length === 0 ? (
              <p className="p-4 text-xs text-muted-foreground text-center">
                일치하는 팝업이 없어요.
              </p>
            ) : (
              <ul>
                {hits.map((h) => (
                  <li key={h.id}>
                    <button
                      type="button"
                      onClick={() => goToHit(h.id)}
                      className="w-full flex items-start gap-2 px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-white/5 transition-colors border-b border-gray-100 dark:border-white/5 last:border-0"
                      role="option"
                    >
                      <span className="text-lime-500 mt-0.5 shrink-0">
                        <MapPin size={12} />
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-gray-900 dark:text-white truncate">
                          {h.name}
                        </p>
                        {h.location && (
                          <p className="text-[11px] text-muted-foreground truncate">
                            {h.location}
                          </p>
                        )}
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
