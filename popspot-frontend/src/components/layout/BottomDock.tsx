'use client';

import {
  Map as MapIcon,
  Route,
  Ticket,
  User,
  CalendarDays,
  Music2,
  MoreHorizontal,
} from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import { useLocale, type MessageKey } from '@/lib/i18n';

export type DockTab = 'MAP' | 'COURSE' | 'MUSIC' | 'PASSPORT' | 'MY' | 'SCHEDULE' | 'FEEDBACK';

interface BottomDockProps {
  /**
   * 지금 보고 있는 탭. <b>없어도 된다.</b>
   *
   * <p>홈 밖(검색 랜딩·팝업 상세)에서는 어느 탭도 "지금" 이 아니다. 그때 아무 값이나 넣으면
   * 있지도 않은 곳이 켜져 보이므로, 비워서 아무것도 강조하지 않는다. 아래 비교가 전부 동등
   * 검사라 {@code undefined} 면 자연히 다 꺼진다.
   */
  currentTab?: DockTab;
  onTabChange: (tab: DockTab) => void;
}

interface DockItemDef {
  key: DockTab;
  icon: React.ElementType;
  /**
   * 번역 키만 담는다 — 문구 자체를 담으면 이 상수가 모듈 최상단이라 언어를 알 수 없다.
   * 실제 문구는 그리는 쪽에서 {@code t(labelKey)} 로 꺼낸다.
   */
  labelKey: MessageKey;
}

/**
 * 모든 탭은 같은 페이지 안에서 즉시 전환된다 — 외부 라우트 X.
 * 마이페이지/지도/음악 모두 같은 모델로 통일해서 깜빡임 없이 이동.
 */
export const DOCK_ITEMS: DockItemDef[] = [
  { key: 'MAP', icon: MapIcon, labelKey: 'dock.map' },
  { key: 'COURSE', icon: Route, labelKey: 'dock.course' },
  { key: 'MUSIC', icon: Music2, labelKey: 'dock.music' },
  { key: 'PASSPORT', icon: Ticket, labelKey: 'dock.passport' },
  { key: 'MY', icon: User, labelKey: 'dock.my' },
  { key: 'SCHEDULE', icon: CalendarDays, labelKey: 'dock.schedule' },
];

/**
 * 화면 하단 고정 네비게이션.
 *
 * <p>v2.17 — 7개 탭이 모바일에서 너무 좁아지던 문제 해결. 모바일 (md 이하) 에선 **가로 스크롤**
 * 가능하게 만들어 좁은 화면에서도 모든 탭 접근 가능. 데스크탑은 기존과 동일하게 한 줄 정렬.
 */
export function BottomDock({ currentTab, onTabChange }: BottomDockProps) {
  const { t, locale } = useLocale();
  const [moreOpen, setMoreOpen] = useState(false);
  /*
   * 핵심 네 칸. 예전에는 세 번째가 동행이었는데, 하루 200명 중 진입이 없어 핵심 자리를 차지할
   * 이유가 없었다. 그 자리를 일정(전체 팝업 달력)이 받는다 — 로그인 없이도 내용이 차는 화면이라
   * 처음 온 사람에게도 빈 탭이 되지 않는다.
   */
  const primaryItems = (['MAP', 'COURSE', 'SCHEDULE', 'MY'] as const)
    .map((key) => DOCK_ITEMS.find((item) => item.key === key))
    .filter((item): item is DockItemDef => Boolean(item));
  const secondaryItems = DOCK_ITEMS.filter((item) => ['MUSIC', 'PASSPORT'].includes(item.key));
  const moreActive = secondaryItems.some((item) => item.key === currentTab);
  const moreLabel = locale === 'ko' ? '더보기' : locale === 'ja' ? 'その他' : 'More';

  return (
    <nav
      aria-label={t('nav.mainMenu')}
      className={cn(
        'fixed left-1/2 z-50 w-[calc(100%-1rem)] max-w-[560px] -translate-x-1/2 lg:hidden',
      )}
      style={{ bottom: 'max(0.5rem, env(safe-area-inset-bottom))' }}
    >
      {moreOpen ? (
        <div className="absolute bottom-[calc(100%+0.4rem)] right-1 w-44 rounded-2xl border border-black/10 bg-surface/95 p-2 shadow-pop backdrop-blur-xl dark:border-white/10">
          {secondaryItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => {
                  setMoreOpen(false);
                  onTabChange(item.key);
                }}
                className={cn(
                  'flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-sm font-bold transition',
                  currentTab === item.key
                    ? 'bg-lime-300 text-ink-900'
                    : 'text-foreground hover:bg-foreground/[0.06]',
                )}
              >
                <Icon className="size-5" aria-hidden />
                {t(item.labelKey)}
              </button>
            );
          })}
        </div>
      ) : null}
      <div
        className={cn(
          // 균등 분할(flex-1) — 가로 스크롤 없이 6탭이 폭에 딱 맞게.
          'flex items-stretch gap-0.5 p-1.5',
          'rounded-[1.5rem] border border-black/5 dark:border-white/10',
          'bg-surface/90 backdrop-blur-xl shadow-pop ring-1 ring-black/[0.02] dark:ring-white/[0.04]',
        )}
      >
        {primaryItems.map((item) => (
          <DockButton
            key={item.key}
            icon={item.icon}
            label={t(item.labelKey)}
            isActive={currentTab === item.key}
            onClick={() => onTabChange(item.key)}
          />
        ))}
        <DockButton
          icon={MoreHorizontal}
          label={moreLabel}
          isActive={moreActive || moreOpen}
          onClick={() => setMoreOpen((current) => !current)}
        />
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
        'relative flex flex-1 min-w-0 flex-col items-center justify-center gap-1',
        'h-14 rounded-[1.125rem] transition-all duration-200 group sm:h-16 sm:rounded-[1.375rem]',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime-400',
        isActive
          ? 'bg-lime-300 text-ink-900 shadow-sm shadow-lime-400/40'
          : 'text-muted-foreground hover:text-foreground hover:bg-foreground/[0.06] active:scale-95',
      )}
    >
      <Icon
        className={cn(
          'size-5 transition-transform duration-200 sm:size-6',
          isActive ? 'scale-105' : 'group-hover:-translate-y-0.5',
        )}
        aria-hidden
      />
      <span className="max-w-full truncate text-[10px] font-bold leading-none tracking-tight sm:text-[11px]">
        {label}
      </span>
    </button>
  );
}
