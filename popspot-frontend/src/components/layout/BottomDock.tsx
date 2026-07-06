"use client";

import {
  Map as MapIcon,
  Route,
  Ticket,
  User,
  Users,
  Music2,
} from "lucide-react";
import { cn } from "@/lib/utils";

export type DockTab =
  | "MAP"
  | "COURSE"
  | "MUSIC"
  | "PASSPORT"
  | "MY"
  | "MATE"
  | "FEEDBACK";

interface BottomDockProps {
  currentTab: DockTab;
  onTabChange: (tab: DockTab) => void;
}

interface DockItemDef {
  key: DockTab;
  icon: React.ElementType;
  label: string;
}

/**
 * 모든 탭은 같은 페이지 안에서 즉시 전환된다 — 외부 라우트 X.
 * 마이페이지/지도/음악 모두 같은 모델로 통일해서 깜빡임 없이 이동.
 */
const ITEMS: DockItemDef[] = [
  { key: "MAP", icon: MapIcon, label: "지도" },
  { key: "COURSE", icon: Route, label: "코스" },
  { key: "MUSIC", icon: Music2, label: "음악" },
  { key: "PASSPORT", icon: Ticket, label: "여권" },
  { key: "MY", icon: User, label: "MY" },
  { key: "MATE", icon: Users, label: "동행" },
];

/**
 * 화면 하단 고정 네비게이션.
 *
 * <p>v2.17 — 7개 탭이 모바일에서 너무 좁아지던 문제 해결. 모바일 (md 이하) 에선 **가로 스크롤**
 * 가능하게 만들어 좁은 화면에서도 모든 탭 접근 가능. 데스크탑은 기존과 동일하게 한 줄 정렬.
 */
export function BottomDock({ currentTab, onTabChange }: BottomDockProps) {
  return (
    <nav
      aria-label="메인 네비게이션"
      className={cn(
        "fixed bottom-4 md:bottom-6 left-1/2 -translate-x-1/2 z-50",
        "w-[95%] max-w-[520px] md:w-auto md:max-w-none"
      )}
    >
      <div
        className={cn(
          "flex items-center gap-1 md:gap-2",
          // v2.17 — 모바일은 가로 스크롤. 데스크탑은 중앙 정렬.
          "overflow-x-auto md:overflow-visible",
          "justify-start md:justify-center",
          "p-2 px-3 md:px-4",
          "rounded-pill border border-[var(--color-border)]",
          "bg-surface/95 backdrop-blur-md shadow-pop",
          // 스크롤바 숨김 — Tailwind 의 scrollbar-none 또는 inline style
          "[&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
        )}
      >
        {ITEMS.map((item) => (
          <DockButton
            key={item.key}
            icon={item.icon}
            label={item.label}
            isActive={currentTab === item.key}
            onClick={() => onTabChange(item.key)}
          />
        ))}
      </div>
    </nav>
  );
}

interface DockButtonProps {
  icon: React.ElementType;
  label: string;
  isActive: boolean;
  onClick?: () => void;
}

function DockButton({ icon: Icon, label, isActive, onClick }: DockButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={isActive}
      aria-label={label}
      className={cn(
        "relative flex flex-col items-center justify-center",
        // v2.17 — 모바일에서 좁아지지 않도록 11 → 가로 스크롤 + 약간 여유
        "w-11 h-12 md:w-14 md:h-14",
        "rounded-pill transition-all duration-200 shrink-0 group",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        isActive
          ? "bg-ink-900 text-cream-200 dark:bg-cream-200 dark:text-ink-900"
          : "text-muted-foreground hover:text-foreground hover:bg-foreground/5"
      )}
    >
      <Icon
        className={cn(
          "size-5 transition-transform duration-200",
          !isActive && "group-hover:-translate-y-0.5"
        )}
        aria-hidden
      />
      <span className="text-[10px] md:text-[11px] font-semibold mt-0.5">
        {label}
      </span>
    </button>
  );
}
