"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  MapPin,
  CalendarDays,
  Tag,
  ArrowRight,
} from "lucide-react";

import { apiFetch } from "@/lib/api";
import { REGIONS, classifyRegion, type RegionCode } from "@/lib/regions";
import {
  PERIODS,
  CATEGORIES,
  matchesPeriod,
  classifyCategory,
  type PeriodCode,
  type CategoryCode,
} from "@/lib/popupSlices";

/**
 * v2.21 — 메인 페이지 BROWSE 섹션.
 *
 * <p>지도에 노출되는 visible markers 를 그대로 받아 클라이언트 사이드에서
 * 지역 / 시점 / 카테고리 슬라이스로 카운트. 클릭 시 지도 탭으로 이동하면서
 * deep link 쿼리 (`?region=seongsu` 등) 부착. 지도 화면이 필터를 적용해 보여줌.
 *
 * <p>SEO 부수효과: 정적 HTML 에 슬라이스 라벨 (성수 / 한남 / 압구정 등) 이
 * 미리 박혀 노출되므로 검색엔진이 메인 페이지에서 이 키워드들을 인식.
 *
 * <p>디자인 톤: 다크/라이트 모두 popspot 표준 (bg-white / dark:bg-[#111]
 * + border / shadow + lime 강조 + rounded-2xl).
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

type SliceItem = {
  key: string;
  label: string;
  href: string;
  count: number;
};

export default function BrowseSection() {
  const router = useRouter();
  const [markers, setMarkers] = useState<Marker[] | null>(null);
  const [error, setError] = useState(false);

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
      href: `/?tab=MAP&region=${r.slug}`,
      count: counts.get(r.code) ?? 0,
    })).filter((s) => s.count > 0);
  }, [markers]);

  const periodSlices = useMemo<SliceItem[]>(() => {
    if (!markers) return [];
    const now = new Date();
    return PERIODS.map((p) => {
      const count = markers.reduce(
        (acc, m) => acc + (matchesPeriod(m.startDate, m.endDate, p.code, now) ? 1 : 0),
        0,
      );
      return {
        key: p.code,
        label: p.label,
        href: `/?tab=MAP&period=${p.slug}`,
        count,
      };
    }).filter((s) => s.count > 0);
  }, [markers]);

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
      href: `/?tab=MAP&category=${c.slug}`,
      count: counts.get(c.code) ?? 0,
    })).filter((s) => s.count > 0);
  }, [markers]);

  if (error || (markers && markers.length === 0)) return null;

  return (
    <section
      aria-label="둘러보기"
      className="mb-6 rounded-2xl border bg-white border-gray-200 dark:bg-[#111] dark:border-white/10 shadow-lg shadow-black/5 dark:shadow-black/30 overflow-hidden"
    >
      <header className="flex items-center justify-between px-5 md:px-6 py-4 border-b border-gray-200 dark:border-white/5">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.4em] text-muted-foreground">
            BROWSE
          </p>
          <h3 className="text-base md:text-lg font-black text-gray-900 dark:text-white">
            관심 있는 슬라이스로 둘러보기
          </h3>
        </div>
      </header>

      <div className="divide-y divide-gray-200 dark:divide-white/5">
        <SliceRow
          icon={<MapPin size={16} className="text-lime-500" />}
          title="지역"
          slices={regionSlices}
          isLoading={markers === null}
          onSelect={(href) => router.push(href)}
        />
        <SliceRow
          icon={<CalendarDays size={16} className="text-lime-500" />}
          title="시점"
          slices={periodSlices}
          isLoading={markers === null}
          onSelect={(href) => router.push(href)}
        />
        <SliceRow
          icon={<Tag size={16} className="text-lime-500" />}
          title="카테고리"
          slices={categorySlices}
          isLoading={markers === null}
          onSelect={(href) => router.push(href)}
        />
      </div>
    </section>
  );
}

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
  onSelect: (href: string) => void;
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
                onClick={() => onSelect(s.href)}
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
