"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  MapPin,
  CalendarDays,
  Tag,
  ArrowRight,
  X,
  Map as MapIcon,
  ExternalLink,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

import { apiFetch } from "@/lib/api";
import { REGIONS, classifyRegion, type RegionCode } from "@/lib/regions";
import {
  getPeriods,
  CATEGORIES,
  matchesPeriod,
  classifyCategory,
  type PeriodCode,
  type CategoryCode,
} from "@/lib/popupSlices";

/**
 * v2.21 — 메인 페이지 BROWSE 섹션 + 슬라이스 모달.
 *
 * <p>지도에 노출되는 visible markers 를 그대로 받아 클라이언트 사이드에서 지역 / 시점 / 카테고리
 * 슬라이스로 카운트. 칩 클릭 시 모달 오픈 — 해당 슬라이스의 진행 중 팝업 목록 노출.
 *
 * <p>v2.21-S3.4 — 이전엔 칩 클릭 시 router.push 로 지도 탭에 deep link 전달했으나 Next.js
 * router cache 때문에 같은 페이지 query 변경 시 useSearchParams hook 재실행이 안 되어 화면이
 * 멈춰있던 회귀. 모달로 전환해 라우팅 의존성 제거 + UX 도 더 명확 (어떤 팝업이 있는지 즉시 노출).
 *
 * <p>모달 내 액션:
 *
 * <ul>
 *   <li>각 팝업 카드 클릭 → /popup/[id] 상세 페이지
 *   <li>"지도에서 모두 보기" → /?tab=MAP&region=...
 *   <li>"전체 페이지 보기" → /popups/[slug] (long-tail SEO 랜딩 페이지)
 * </ul>
 */

type Marker = {
  id: number;
  name: string;
  location: string | null;
  latitude: string | null;
  longitude: string | null;
  category: string | null;
  startDate: string | null;
  endDate: string | null;
};

type SliceKind = "region" | "period" | "category";

type ActiveSlice = {
  kind: SliceKind;
  code: string;
  slug: string;
  label: string;
  matches: Marker[];
};

type SliceItem = {
  key: string;
  label: string;
  count: number;
  /** 모달 오픈을 위해 ActiveSlice 만들 때 필요한 raw 정보. */
  kind: SliceKind;
  code: string;
  slug: string;
};

const EXPAND_STORAGE_KEY = "popspot:browse:expanded";

export default function BrowseSection() {
  const [markers, setMarkers] = useState<Marker[] | null>(null);
  const [error, setError] = useState(false);
  const [activeSlice, setActiveSlice] = useState<ActiveSlice | null>(null);
  const [isExpanded, setIsExpanded] = useState(true);
  const periods = useMemo(() => getPeriods(), [markers]);

  // 토글 상태 localStorage 영속화 — 새로고침 후에도 사용자 선택 유지.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const saved = window.localStorage.getItem(EXPAND_STORAGE_KEY);
    if (saved === "0") setIsExpanded(false);
  }, []);

  function toggleExpand() {
    setIsExpanded((prev) => {
      const next = !prev;
      if (typeof window !== "undefined") {
        window.localStorage.setItem(EXPAND_STORAGE_KEY, next ? "1" : "0");
      }
      return next;
    });
  }

  useEffect(() => {
    let cancelled = false;
    apiFetch("/api/map/markers")
      .then((res) => (res.ok ? res.json() : []))
      .then((data: Marker[]) => {
        if (!cancelled) setMarkers(data);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const regionSlices = useMemo<SliceItem[]>(() => {
    if (!markers) return [];
    const counts = new Map<RegionCode, number>();
    for (const m of markers) {
      const code = classifyRegion(m.location);
      counts.set(code, (counts.get(code) ?? 0) + 1);
    }
    return REGIONS.map((r) => ({
      key: r.code,
      label: r.label,
      count: counts.get(r.code) ?? 0,
      kind: "region" as const,
      code: r.code,
      slug: r.slug,
    })).filter((s) => s.count > 0);
  }, [markers]);

  const periodSlices = useMemo<SliceItem[]>(() => {
    if (!markers) return [];
    const now = new Date();
    return periods.map((p) => {
      const count = markers.reduce(
        (acc, m) => acc + (matchesPeriod(m.startDate, m.endDate, p.code, now) ? 1 : 0),
        0,
      );
      return {
        key: p.code,
        label: p.label,
        count,
        kind: "period" as const,
        code: p.code,
        slug: p.slug,
      };
    }).filter((s) => s.count > 0);
  }, [markers, periods]);

  const categorySlices = useMemo<SliceItem[]>(() => {
    if (!markers) return [];
    const counts = new Map<CategoryCode, number>();
    for (const m of markers) {
      const code = classifyCategory(m.category);
      counts.set(code, (counts.get(code) ?? 0) + 1);
    }
    return CATEGORIES.map((c) => ({
      key: c.code,
      label: c.label,
      count: counts.get(c.code) ?? 0,
      kind: "category" as const,
      code: c.code,
      slug: c.slug,
    })).filter((s) => s.count > 0);
  }, [markers]);

  function handleSelect(item: SliceItem) {
    if (!markers) return;
    const matches = filterMarkers(markers, item);
    setActiveSlice({
      kind: item.kind,
      code: item.code,
      slug: item.slug,
      label: item.label,
      matches,
    });
  }

  if (error || (markers && markers.length === 0)) return null;

  return (
    <>
      <section
        aria-label="둘러보기"
        className="mb-6 rounded-2xl border bg-white border-gray-200 dark:bg-[#111] dark:border-white/10 shadow-lg shadow-black/5 dark:shadow-black/30 overflow-hidden"
      >
        <button
          type="button"
          onClick={toggleExpand}
          aria-expanded={isExpanded}
          aria-controls="browse-section-body"
          className="w-full flex items-center justify-between gap-3 px-5 md:px-6 py-4 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors text-left"
        >
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.4em] text-muted-foreground">
              BROWSE
            </p>
            <h3 className="text-base md:text-lg font-black text-gray-900 dark:text-white">
              관심 있는 슬라이스로 둘러보기
            </h3>
          </div>
          <span
            className="shrink-0 p-1.5 rounded-full text-gray-500 dark:text-white/60"
            aria-hidden
          >
            {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
          </span>
        </button>

        <AnimatePresence initial={false}>
          {isExpanded && (
            <motion.div
              id="browse-section-body"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.22, ease: "easeInOut" }}
              className="overflow-hidden border-t border-gray-200 dark:border-white/5"
            >
              <div className="divide-y divide-gray-200 dark:divide-white/5">
                <SliceRow
                  icon={<MapPin size={16} className="text-lime-500" />}
                  title="지역"
                  slices={regionSlices}
                  isLoading={markers === null}
                  onSelect={handleSelect}
                />
                <SliceRow
                  icon={<CalendarDays size={16} className="text-lime-500" />}
                  title="시점"
                  slices={periodSlices}
                  isLoading={markers === null}
                  onSelect={handleSelect}
                />
                <SliceRow
                  icon={<Tag size={16} className="text-lime-500" />}
                  title="카테고리"
                  slices={categorySlices}
                  isLoading={markers === null}
                  onSelect={handleSelect}
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </section>

      <AnimatePresence>
        {activeSlice && (
          <SliceModal slice={activeSlice} onClose={() => setActiveSlice(null)} />
        )}
      </AnimatePresence>
    </>
  );
}

/* ============================== 슬라이스 row ============================== */

function SliceRow({
  icon,
  title,
  slices,
  isLoading,
  onSelect,
}: {
  icon: React.ReactNode;
  title: string;
  slices: SliceItem[];
  isLoading: boolean;
  onSelect: (item: SliceItem) => void;
}) {
  return (
    <div className="px-5 md:px-6 py-4">
      <div className="flex items-center gap-2 mb-3">
        {icon}
        <span className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-white/60">
          {title}
        </span>
      </div>

      {isLoading ? (
        <div className="flex flex-wrap gap-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <span
              key={i}
              className="h-8 w-20 rounded-pill bg-gray-100 dark:bg-white/5 animate-pulse"
            />
          ))}
        </div>
      ) : slices.length === 0 ? (
        <p className="text-xs text-muted-foreground">해당 슬라이스에 진행 중인 팝업이 없어요.</p>
      ) : (
        <ul className="flex flex-wrap gap-2">
          {slices.map((s) => (
            <li key={s.key}>
              <button
                type="button"
                onClick={() => onSelect(s)}
                aria-label={`${s.label} 팝업 ${s.count}개 보기`}
                className="group inline-flex items-center gap-2 px-3 py-1.5 rounded-pill text-sm font-medium transition-all border bg-white text-gray-900 border-gray-200 hover:border-lime-300 hover:bg-lime-50 dark:bg-white/5 dark:text-white dark:border-white/10 dark:hover:bg-lime-300/10 dark:hover:border-lime-300/40"
              >
                <span>{s.label}</span>
                <span className="text-xs font-bold text-lime-600 dark:text-lime-300">
                  {s.count}
                </span>
                <ArrowRight
                  size={12}
                  className="text-gray-400 dark:text-white/40 group-hover:text-lime-600 dark:group-hover:text-lime-300 group-hover:translate-x-0.5 transition-all"
                />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ============================== 슬라이스 모달 ============================== */

function SliceModal({ slice, onClose }: { slice: ActiveSlice; onClose: () => void }) {
  const router = useRouter();
  const paramKey =
    slice.kind === "region" ? "region" : slice.kind === "period" ? "period" : "category";
  const mapHref = `/?tab=MAP&${paramKey}=${slice.slug}`;
  const landingHref = `/popups/${slice.slug}`;

  // ESC 키로 닫기 + body scroll lock
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  function goToDetail(id: number) {
    onClose();
    router.push(`/popup/${id}`);
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
      className="fixed inset-0 z-[100] flex items-end md:items-center justify-center bg-black/60 backdrop-blur-sm p-0 md:p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`${slice.label} 팝업 목록`}
    >
      <motion.div
        initial={{ y: 60, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 40, opacity: 0 }}
        transition={{ type: "spring", stiffness: 320, damping: 28 }}
        className="w-full md:max-w-lg max-h-[85vh] md:max-h-[80vh] flex flex-col bg-white dark:bg-[#111] border border-gray-200 dark:border-white/10 rounded-t-3xl md:rounded-3xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 헤더 */}
        <header className="flex items-start justify-between gap-3 px-5 md:px-6 py-4 border-b border-gray-200 dark:border-white/5">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.4em] text-muted-foreground mb-1">
              {slice.kind === "region"
                ? "REGION"
                : slice.kind === "period"
                  ? "WHEN"
                  : "CATEGORY"}
            </p>
            <h2 className="text-lg md:text-xl font-black text-gray-900 dark:text-white">
              {slice.label} 팝업{" "}
              <span className="text-lime-600 dark:text-lime-300">{slice.matches.length}곳</span>
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="닫기"
            className="p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-white/10 transition-colors text-gray-500 dark:text-white/60"
          >
            <X size={18} />
          </button>
        </header>

        {/* 리스트 */}
        <div className="flex-1 overflow-y-auto custom-scrollbar px-2 md:px-3 py-2">
          {slice.matches.length === 0 ? (
            <p className="text-sm text-muted-foreground p-6 text-center">
              지금 진행 중인 팝업이 없어요.
            </p>
          ) : (
            <ul>
              {slice.matches.slice(0, 50).map((m) => (
                <li key={m.id}>
                  <button
                    type="button"
                    onClick={() => goToDetail(m.id)}
                    className="w-full text-left flex items-start gap-3 px-3 py-3 rounded-xl hover:bg-gray-50 dark:hover:bg-white/5 transition-colors"
                  >
                    <span className="mt-1 text-lime-500 shrink-0">
                      <MapPin size={14} />
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm md:text-base font-bold truncate text-gray-900 dark:text-white">
                        {m.name}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {m.location ?? "위치 정보 없음"}
                      </p>
                      {(m.startDate || m.endDate) && (
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          {m.startDate ?? "?"} ~ {m.endDate ?? "?"}
                        </p>
                      )}
                    </div>
                    <ArrowRight
                      size={14}
                      className="mt-1 text-gray-300 dark:text-white/30 shrink-0"
                    />
                  </button>
                </li>
              ))}
            </ul>
          )}
          {slice.matches.length > 50 && (
            <p className="text-xs text-muted-foreground px-4 py-3">
              외 {slice.matches.length - 50}곳 더 — 아래 "지도에서 모두 보기" 클릭
            </p>
          )}
        </div>

        {/* 하단 CTA */}
        <footer className="grid grid-cols-2 gap-2 px-4 md:px-5 py-3 border-t border-gray-200 dark:border-white/5 bg-gray-50 dark:bg-black/40">
          <Link
            href={mapHref}
            onClick={onClose}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-lime-300 text-ink-900 font-bold text-sm hover:bg-lime-400 transition"
          >
            <MapIcon size={14} /> 지도에서 보기
          </Link>
          <Link
            href={landingHref}
            onClick={onClose}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-gray-300 dark:border-white/15 bg-white dark:bg-white/5 text-gray-900 dark:text-white font-bold text-sm hover:bg-gray-100 dark:hover:bg-white/10 transition"
          >
            <ExternalLink size={14} /> 전체 페이지
          </Link>
        </footer>
      </motion.div>
    </motion.div>
  );
}

/* ============================== 유틸 ============================== */

function filterMarkers(markers: Marker[], item: SliceItem): Marker[] {
  if (item.kind === "region") {
    return markers.filter((m) => classifyRegion(m.location) === item.code);
  }
  if (item.kind === "period") {
    const now = new Date();
    return markers.filter((m) =>
      matchesPeriod(m.startDate, m.endDate, item.code as PeriodCode, now),
    );
  }
  return markers.filter((m) => classifyCategory(m.category) === item.code);
}
