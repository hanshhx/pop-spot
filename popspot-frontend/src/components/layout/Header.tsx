'use client';

import { useEffect, useState, type ReactNode } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { LogOut, ShieldCheck, Megaphone, Crown, User as UserIcon, Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import ThemeToggle from '@/components/ThemeToggle';
import { unreadCount as readUnread } from '@/lib/notifications';
import { cn } from '@/lib/utils';
import { Logo } from '@/components/layout/Logo';
import { SeasonMark } from '@/components/layout/SeasonMark';
import { useSeason } from '@/hooks/useSeason';
import { SectionLogo } from '@/components/layout/BrandLogos';
import { DOCK_ITEMS } from '@/components/layout/BottomDock';
import { useLocale } from '@/lib/i18n';
import { localizedPath } from '@/lib/localePath';

export interface HeaderUser {
  userId: string;
  nickname: string;
  isPremium?: boolean;
  role?: string;
  /** v2.16 — 프로필 사진 URL. 헤더 칩에 작은 아바타로 표시. */
  picture?: string;
}

interface HeaderProps {
  user: HeaderUser | null;
  onLogout?: () => void;
  onReportClick?: () => void;
  onLogoClick?: () => void;
  /** v2.16 — UserChip 클릭 시 호출. 프로필 편집 모달 열기. */
  onProfileClick?: () => void;
  /** v2.18.1 — 알림 센터 모달 열기. */
  onBellClick?: () => void;
  subtitle?: string;
  /** 데스크톱(lg+) 상단 네비 — 현재 탭 + 전환 콜백. 모바일은 BottomDock 사용. */
  activeTab?: string;
  onNavChange?: (tab: string) => void;
  /** 좁은 화면에서 로고 옆에 붙는 간단한 언어 선택기. */
  mobileLocaleControl?: ReactNode;
  className?: string;
}

/**
 * 모든 페이지 공통 헤더.
 * - 로고 (POP-SPOT)
 * - 부제목
 * - 우측: 테마 토글 / 제보 (로그인 시) / 관리자 (ADMIN) / 사용자 또는 로그인-가입
 */
export function Header({
  user,
  onLogout,
  onReportClick,
  onLogoClick,
  onProfileClick,
  onBellClick,
  subtitle,
  activeTab,
  onNavChange,
  mobileLocaleControl,
  className,
}: HeaderProps) {
  const { t, locale } = useLocale();
  // 지금 계절 — 서버가 <html data-season> 에 정해 둔 값을 읽는다(관리자 고정 반영).
  const season = useSeason();
  // v2.18.1 — 미확인 알림 개수 (localStorage 기반).
  const [unread, setUnread] = useState(0);
  useEffect(() => {
    const sync = () => setUnread(readUnread());
    sync();
    window.addEventListener('popspot:notifications-changed', sync);
    return () => window.removeEventListener('popspot:notifications-changed', sync);
  }, []);
  const isAdmin = user?.role?.includes('ADMIN');

  return (
    <header
      role="banner"
      className={cn(
        'flex min-w-0 flex-col items-stretch gap-3 md:flex-row md:items-end md:justify-between md:gap-4',
        'border-b border-[var(--color-border)] pb-4',
        className,
      )}
    >
      <div className="flex min-w-0 items-center justify-between gap-2 md:block md:w-auto">
        <Link
          href={localizedPath('/?entered=1', locale)}
          onClick={onLogoClick}
          className="group inline-flex min-w-0 shrink items-start"
        >
          <div className="flex items-start gap-1.5 leading-none">
            {/* 로고 비율이 약 5.1:1 이라 높이를 올리면 폭도 그만큼 늘어난다. max-w 를 같이 올리지
                않으면 폭에서 잘려 높이만 키운 효과가 사라진다. 모바일 h-6(24px)은 데스크톱
                h-14(56px)에 비해 유독 작았다. */}
            <Logo className="h-9 max-w-[188px] transition-opacity group-hover:opacity-80 sm:h-10 sm:max-w-[210px] md:h-14 md:max-w-none" />
            {/* 계절 표시 — 로고 자체는 건드리지 않고 옆에 붙인다. 로고를 계절색으로 칠하면
                브랜드가 흔들린다. 사계절 상주하는 신호라 화면 어디서든 지금이 어느 계절인지 알 수 있다. */}
            <SeasonMark season={season} className="mt-0.5 size-3.5 shrink-0 sm:size-4 md:mt-1 md:size-5" />
          </div>
          {subtitle ? (
            <p className="mt-1 hidden text-[10px] tracking-[0.2em] uppercase text-muted-foreground md:block md:text-xs">
              {subtitle}
            </p>
          ) : (
            <SectionLogo
              name="tagline"
              label="Seoul Popup Store Intelligence"
              className="mt-1.5 hidden h-6 text-muted-foreground md:block"
            />
          )}
        </Link>
        <div className="shrink-0 md:hidden">{mobileLocaleControl}</div>
      </div>

      {/* 데스크톱(lg+) 상단 네비 — 모바일은 하단 BottomDock. */}
      {onNavChange && (
        <nav
          aria-label={t('nav.mainMenu')}
          className="hidden lg:flex items-center gap-10 self-center"
        >
          {DOCK_ITEMS.map((item) => {
            const active = activeTab === item.key;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => onNavChange(item.key)}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'relative py-2 text-[20px] tracking-tight transition-colors',
                  'after:absolute after:left-0 after:right-0 after:-bottom-1 after:h-[3px] after:rounded-full after:transition-colors',
                  active
                    ? 'text-foreground font-bold after:bg-lime-400'
                    : 'text-muted-foreground font-medium hover:text-foreground after:bg-transparent',
                )}
              >
                {t(item.labelKey)}
              </button>
            );
          })}
        </nav>
      )}

      <nav
        aria-label={t('nav.userMenu')}
        className="flex min-w-0 flex-wrap items-center justify-end gap-1.5 md:w-auto md:flex-nowrap md:gap-3"
      >
        <ThemeToggle />

        {onBellClick && user && (
          <button
            type="button"
            onClick={onBellClick}
            aria-label={unread > 0 ? `${t('nav.notifications')} ${unread}` : t('nav.notifications')}
            className={cn(
              'relative inline-flex h-9 w-9 items-center justify-center rounded-pill md:h-11 md:w-11',
              'text-foreground hover:bg-foreground/5 transition-colors',
            )}
          >
            <Bell className="size-4" aria-hidden />
            {unread > 0 && (
              <span
                className="absolute top-1.5 right-1.5 min-w-[16px] h-[16px] px-1 rounded-full bg-hot-400 text-white text-[9px] font-black flex items-center justify-center"
                aria-hidden
              >
                {unread > 9 ? '9+' : unread}
              </span>
            )}
          </button>
        )}

        {/*
          제보는 <b>로그인 없이도</b> 할 수 있다.

          예전엔 여기 user && 가 붙어 있었다. 그런데 서버의 POST /api/popups/report 는 처음부터
          비로그인을 받고 있었고(공개 경로이고, 레이트리밋 목록에도 "인증이 없으면서 데이터를
          조작하는 경로" 로 올라 있다), 제보 모달도 reporterId 를 user?.userId || 'unknown' 으로
          두어 게스트를 상정하고 있었다. 화면만 막고 있었던 셈이다.

          2026-08-09 에 게스트가 "해즈빈 호텔 팝업이 빠졌다" 는 것을 알아채고도 제보할 방법이
          없어 의견 게시판에 남겼다. 의견은 팝업 승인 대기열로 가지 않으므로, 정확한 정보를
          가진 사람이 알려 줬는데도 데이터가 되지 못했다.

          빠진 팝업을 가장 먼저 알아채는 사람은 그 팝업을 보러 온 사람이고, 그 사람이 로그인
          상태일 이유는 없다. 스팸은 이미 두 겹으로 막혀 있다 — 호출 횟수 제한이 걸려 있고,
          제보는 관리자가 승인해야 화면에 나온다.
        */}
        {onReportClick && (
          <Button
            variant="outline"
            size="sm"
            onClick={onReportClick}
            className="h-10 w-10 px-0 sm:w-auto sm:px-3"
            aria-label={t('nav.report')}
          >
            <Megaphone className="size-3.5" aria-hidden />
            <span className="hidden sm:inline">{t('nav.report')}</span>
          </Button>
        )}

        {isAdmin && (
          <Button
            asChild
            variant="outline"
            size="sm"
            className="h-10 w-10 border-hot-400 px-0 text-hot-400 hover:bg-hot-400 hover:text-white sm:w-auto sm:px-3"
          >
            <Link href="/admin" aria-label={t('nav.admin')}>
              <ShieldCheck className="size-3.5" aria-hidden />
              <span className="hidden sm:inline">{t('nav.admin')}</span>
            </Link>
          </Button>
        )}

        {user ? (
          <UserChip user={user} onLogout={onLogout} onProfileClick={onProfileClick} />
        ) : (
          /* 모바일에서도 데스크톱과 동일하게 로그인·회원가입 진입점을 모두 유지한다.
             좁은 화면은 헤더를 두 줄로 나누고 버튼 크기만 줄여 가로 잘림을 막는다. */
          <div className="flex items-center gap-1.5 md:gap-2">
            <Button
              asChild
              variant="ghost"
              size="sm"
              className="h-10 px-2 text-[12px] font-bold sm:px-3 md:text-[15px]"
            >
              <Link href={localizedPath('/login', locale)}>{t('nav.login')}</Link>
            </Button>
            <Button
              asChild
              variant="primary"
              size="sm"
              className="h-10 px-2.5 text-[12px] font-bold sm:px-3 md:text-[15px]"
            >
              <Link href={localizedPath('/signup', locale)}>{t('auth.signup')}</Link>
            </Button>
          </div>
        )}
      </nav>
    </header>
  );
}

function UserChip({
  user,
  onLogout,
  onProfileClick,
}: {
  user: HeaderUser;
  onLogout?: () => void;
  onProfileClick?: () => void;
}) {
  const { t } = useLocale();
  const ChipInner = (
    <>
      <Avatar picture={user.picture} isDark={user.isPremium === true} size={26} />
      {user.isPremium && (
        <Badge tone="lime" size="sm" className="px-1.5 hidden md:inline-flex">
          <Crown className="size-3" aria-hidden />
          PRO
        </Badge>
      )}
      {/* v2.17 — 모바일에선 아바타만, 데스크탑부터 닉네임 노출 */}
      <span className="hidden md:inline text-sm font-semibold">{user.nickname}</span>
    </>
  );

  return (
    <div
      className={cn(
        // v2.17 — 모바일에서도 표시. 닉네임은 모바일에서 숨겨 칩 크기 축소.
        'inline-flex items-center gap-2 pl-1.5 pr-2 py-1',
        'rounded-pill border',
        user.isPremium
          ? 'bg-ink-900 text-cream-200 border-ink-900 dark:bg-cream-200 dark:text-ink-900 dark:border-cream-200'
          : 'bg-surface text-foreground border-[var(--color-border)]',
      )}
    >
      {onProfileClick ? (
        <button
          type="button"
          onClick={onProfileClick}
          aria-label={t('nav.editProfile')}
          className="inline-flex items-center gap-2 transition-opacity hover:opacity-80"
        >
          {ChipInner}
        </button>
      ) : (
        <div className="inline-flex items-center gap-2">{ChipInner}</div>
      )}
      {onLogout && (
        <button
          type="button"
          onClick={onLogout}
          className="inline-flex items-center gap-1 rounded-pill px-1 py-1 text-xs opacity-70 transition-opacity hover:opacity-100 md:px-2"
          aria-label={t('nav.logout')}
        >
          <LogOut className="size-3" aria-hidden />
          <span className="hidden md:inline">{t('nav.logout')}</span>
        </button>
      )}
    </div>
  );
}

interface AvatarProps {
  picture?: string;
  isDark: boolean;
  size: number;
}

/**
 * v2.16 — 헤더용 작은 원형 아바타. 사진이 없으면 lime 배경 + UserIcon fallback.
 *
 * <p>{@code unoptimized} prop 으로 외부 OAuth 도메인의 사진도 무리 없이 표시.
 */
function Avatar({ picture, isDark, size }: AvatarProps) {
  const dimension = { width: size, height: size };
  if (picture) {
    return (
      <Image
        src={picture}
        alt=""
        width={size}
        height={size}
        className="rounded-full object-cover border border-[var(--color-border)]"
        style={dimension}
        unoptimized
      />
    );
  }
  return (
    <span
      className={cn(
        'rounded-full inline-flex items-center justify-center border border-[var(--color-border)]',
        isDark ? 'bg-cream-200/20' : 'bg-lime-300/20',
      )}
      style={dimension}
    >
      <UserIcon className="size-3.5 text-lime-500" aria-hidden />
    </span>
  );
}
