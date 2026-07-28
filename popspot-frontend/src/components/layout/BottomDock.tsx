'use client';

import { Map as MapIcon, Route, Ticket, User, Users, Music2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useLocale, type MessageKey } from '@/lib/i18n';

export type DockTab = 'MAP' | 'COURSE' | 'MUSIC' | 'PASSPORT' | 'MY' | 'MATE' | 'FEEDBACK';

interface BottomDockProps {
  currentTab: DockTab;
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
  { key: 'MATE', icon: Users, labelKey: 'dock.mate' },
];

/**
 * 화면 하단 고정 네비게이션.
 *
 * <p>v2.17 — 7개 탭이 모바일에서 너무 좁아지던 문제 해결. 모바일 (md 이하) 에선 **가로 스크롤**
 * 가능하게 만들어 좁은 화면에서도 모든 탭 접근 가능. 데스크탑은 기존과 동일하게 한 줄 정렬.
 */
export function BottomDock({ currentTab, onTabChange }: BottomDockProps) {
  const { t } = useLocale();
  return (
    <nav
      aria-label={t('nav.mainMenu')}
      className={cn(
        'fixed bottom-4 md:bottom-6 left-1/2 -translate-x-1/2 z-50 lg:hidden',
        'w-[95%] max-w-[560px]',
      )}
    >
      <div
        className={cn(
          // 균등 분할(flex-1) — 가로 스크롤 없이 6탭이 폭에 딱 맞게.
          'flex items-stretch gap-1 p-2.5',
          'rounded-[1.75rem] border border-black/5 dark:border-white/10',
          'bg-surface/90 backdrop-blur-xl shadow-pop ring-1 ring-black/[0.02] dark:ring-white/[0.04]',
        )}
      >
        {DOCK_ITEMS.map((item) => (
          <DockButton
            key={item.key}
            icon={item.icon}
            label={t(item.labelKey)}
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
        'relative flex flex-1 min-w-0 flex-col items-center justify-center gap-1',
        'h-16 md:h-[72px] rounded-[1.375rem] transition-all duration-200 group',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime-400',
        isActive
          ? 'bg-lime-300 text-ink-900 shadow-sm shadow-lime-400/40'
          : 'text-muted-foreground hover:text-foreground hover:bg-foreground/[0.06] active:scale-95',
      )}
    >
      <Icon
        className={cn(
          'size-7 transition-transform duration-200',
          isActive ? 'scale-110' : 'group-hover:-translate-y-0.5',
        )}
        aria-hidden
      />
      <span className="text-[12px] font-bold tracking-tight leading-none">{label}</span>
    </button>
  );
}
