"use client";

import Link from "next/link";
import {
  Map as MapIcon,
  Route,
  Ticket,
  User,
  Users,
  Music2,
} from "lucide-react";
import { cn } from "@/lib/utils";

export type DockTab = "MAP" | "COURSE" | "PASSPORT" | "MY" | "MATE";

interface BottomDockProps {
  currentTab: DockTab;
  onTabChange: (tab: DockTab) => void;
}

interface DockItemDef {
  key: DockTab | "MUSIC";
  icon: React.ElementType;
  label: string;
  href?: string;
}

const ITEMS: DockItemDef[] = [
  { key: "MAP", icon: MapIcon, label: "지도" },
  { key: "COURSE", icon: Route, label: "코스" },
  { key: "MUSIC", icon: Music2, label: "음악", href: "/music" },
  { key: "PASSPORT", icon: Ticket, label: "여권" },
  { key: "MY", icon: User, label: "MY" },
  { key: "MATE", icon: Users, label: "동행" },
];

/**
 * 화면 하단 고정 네비게이션.
 * - 탭 (MAP/COURSE/PASSPORT/MY/MATE) 은 onTabChange 호출
 * - 상점은 외부 라우트로 이동
 */
export function BottomDock({ currentTab, onTabChange }: BottomDockProps) {
  return (
    <nav
      aria-label="메인 네비게이션"
      className={cn(
        "fixed bottom-4 md:bottom-6 left-1/2 -translate-x-1/2 z-50",
        "w-[95%] max-w-[480px] md:w-auto md:max-w-none"
      )}
    >
      <div
        className={cn(
          "flex items-center justify-between md:justify-center gap-1 md:gap-2",
          "p-2 px-3 md:px-4",
          "rounded-pill border border-[var(--color-border)]",
          "bg-surface/95 backdrop-blur-md shadow-pop"
        )}
      >
        {ITEMS.map((item) => {
          if (item.href) {
            return (
              <Link
                key={item.key}
                href={item.href}
                className="shrink-0"
                aria-label={item.label}
              >
                <DockButton
                  icon={item.icon}
                  label={item.label}
                  isActive={false}
                />
              </Link>
            );
          }
          return (
            <DockButton
              key={item.key}
              icon={item.icon}
              label={item.label}
              isActive={currentTab === item.key}
              onClick={() => onTabChange(item.key as DockTab)}
            />
          );
        })}
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
        "w-12 h-12 md:w-14 md:h-14",
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
