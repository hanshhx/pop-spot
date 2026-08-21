'use client';

import { Map as MapIcon, Route, Ticket, User, Users, Music2, MoreHorizontal } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import { useLocale, type MessageKey } from '@/lib/i18n';
import { dockSlots } from '@/lib/dockSlots';

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
/**
 * 도크 앞 네 칸 — <b>표시 순서</b>다. 아래 배열 순서와 다르다.
 *
 * <p>배열을 잘라 쓰면(시안이 그렇게 적혀 있다) 메이트·마이가 빠지고 음악·여권이 앞으로 나온다.
 * 배열 자체는 데스크탑 상단 네비게이션이 같이 쓰므로 순서를 바꿀 수도 없다.
 */
const PRIMARY_KEYS = ['MAP', 'COURSE', 'MATE', 'MY'] as const;

/** 다섯째 칸 뒤에 접어 두는 탭. */
const SECONDARY_KEYS = ['MUSIC', 'PASSPORT'] as const;

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
  const { t, locale } = useLocale();
  const [moreOpen, setMoreOpen] = useState(false);
  const {
    primary: primaryItems,
    secondary: secondaryItems,
    fifth,
  } = dockSlots(DOCK_ITEMS, PRIMARY_KEYS, SECONDARY_KEYS, currentTab);
  const moreLabel = locale === 'ko' ? '더보기' : locale === 'ja' ? 'その他' : 'More';

  /**
   * 다섯째 칸은 두 얼굴이다 — 평소에는 "더보기", 음악·여권을 보고 있을 때는 그 탭.
   *
   * <p>예전에는 늘 "더보기" 였다. 음악 탭에 들어가면 이 칸에 라임만 켜지고, 정작 <b>무엇이
   * 열려 있는지는 아무 데도 안 적혀</b> 있었다. 앞 네 칸은 이름이 보이는데 이 칸만 안 보였다.
   */
  const fifthIcon = fifth.openItem?.icon ?? MoreHorizontal;
  const fifthLabel = fifth.openItem ? t(fifth.openItem.labelKey) : moreLabel;

  return (
    <nav
      // 지도 카드가 이 도크를 재서 컨트롤을 비켜세운다(useMapBottomInset).
      data-bottom-dock=""
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
            isCurrent={currentTab === item.key}
            onClick={() => onTabChange(item.key)}
          />
        ))}
        <DockButton
          icon={fifthIcon}
          label={fifthLabel}
          isActive={fifth.isCurrent || moreOpen}
          isCurrent={fifth.isCurrent}
          hasMore={fifth.hasMore}
          hasPopup
          expanded={moreOpen}
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
  /**
   * 지금 보고 있는 화면인가. {@code isActive} 와 나누는 이유는 다섯째 칸 때문이다 —
   * 그 칸은 메뉴가 열려 있을 때도 켜지는데, 그건 "여기 있다" 가 아니라 "메뉴가 열렸다" 다.
   */
  isCurrent?: boolean;
  /** 이 칸 뒤에 다른 탭이 더 있는가. 점 하나로 알린다. */
  hasMore?: boolean;
  /** 눌렀을 때 메뉴가 열리는 버튼인가. */
  hasPopup?: boolean;
  expanded?: boolean;
  onClick?: () => void;
}

function DockButton({
  icon: Icon,
  label,
  isActive,
  isCurrent = false,
  hasMore = false,
  hasPopup = false,
  expanded = false,
  onClick,
}: DockButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      // 탭 이동은 누름 상태가 아니라 "지금 여기" 다. aria-pressed 는 토글 버튼의 말이라
      // 화면 낭독기가 "선택됨" 이라고만 읽고 어디에 있는지는 알려주지 않았다.
      aria-current={isCurrent ? 'page' : undefined}
      aria-haspopup={hasPopup ? 'menu' : undefined}
      aria-expanded={hasPopup ? expanded : undefined}
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
      {/* 이 칸이 탭 하나를 보여주는 동안에는 나머지로 가는 길이 화면에서 사라진다.
          점 하나로 "여기 더 있다" 만 남긴다. 읽어 줄 내용은 아니라 화면 낭독기에선 숨긴다. */}
      {hasMore && (
        <span
          className="absolute right-2.5 top-2 size-1 rounded-full bg-ink-900/35"
          aria-hidden
        />
      )}
    </button>
  );
}
