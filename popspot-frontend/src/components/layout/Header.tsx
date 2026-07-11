"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { LogOut, ShieldCheck, Megaphone, Crown, User as UserIcon, Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import ThemeToggle from "@/components/ThemeToggle";
import { unreadCount as readUnread } from "@/lib/notifications";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/layout/Logo";
import { SectionLogo } from "@/components/layout/BrandLogos";
import { DOCK_ITEMS } from "@/components/layout/BottomDock";

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
  /** v2.18 — 글로벌 검색 모달 열기. */
  onSearchClick?: () => void;
  /** v2.18.1 — 알림 센터 모달 열기. */
  onBellClick?: () => void;
  subtitle?: string;
  /** 데스크톱(lg+) 상단 네비 — 현재 탭 + 전환 콜백. 모바일은 BottomDock 사용. */
  activeTab?: string;
  onNavChange?: (tab: string) => void;
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
  onSearchClick,
  onBellClick,
  subtitle,
  activeTab,
  onNavChange,
  className,
}: HeaderProps) {
  // v2.18.1 — 미확인 알림 개수 (localStorage 기반).
  const [unread, setUnread] = useState(0);
  useEffect(() => {
    const sync = () => setUnread(readUnread());
    sync();
    window.addEventListener("popspot:notifications-changed", sync);
    return () =>
      window.removeEventListener("popspot:notifications-changed", sync);
  }, []);
  const isAdmin = user?.role?.includes("ADMIN");

  return (
    <header
      role="banner"
      className={cn(
        "flex flex-col gap-4 md:flex-row md:items-end md:justify-between",
        "border-b border-[var(--color-border)] pb-4",
        className
      )}
    >
      <Link
        href="/?entered=1"
        onClick={onLogoClick}
        className="group inline-flex flex-col"
      >
        <h1 className="leading-none">
          <Logo className="h-10 md:h-14 transition-opacity group-hover:opacity-80" />
        </h1>
        {subtitle ? (
          <p className="text-[10px] md:text-xs mt-1 tracking-[0.2em] uppercase text-muted-foreground">
            {subtitle}
          </p>
        ) : (
          <SectionLogo
            name="tagline"
            label="Seoul Popup Store Intelligence"
            className="h-5 md:h-6 mt-1.5 text-muted-foreground"
          />
        )}
      </Link>

      {/* 데스크톱(lg+) 상단 네비 — 모바일은 하단 BottomDock. */}
      {onNavChange && (
        <nav
          aria-label="주요 메뉴"
          className="hidden lg:flex items-center gap-10 self-center"
        >
          {DOCK_ITEMS.map((item) => {
            const active = activeTab === item.key;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => onNavChange(item.key)}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative py-2 text-[20px] tracking-tight transition-colors",
                  "after:absolute after:left-0 after:right-0 after:-bottom-1 after:h-[3px] after:rounded-full after:transition-colors",
                  active
                    ? "text-foreground font-bold after:bg-lime-400"
                    : "text-muted-foreground font-medium hover:text-foreground after:bg-transparent"
                )}
              >
                {item.label}
              </button>
            );
          })}
        </nav>
      )}

      <nav
        aria-label="사용자 메뉴"
        className="flex items-center gap-2 md:gap-3 self-end md:self-auto"
      >
        <ThemeToggle />

        {onBellClick && (
          <button
            type="button"
            onClick={onBellClick}
            aria-label={unread > 0 ? `알림 ${unread}건` : "알림"}
            className={cn(
              "relative inline-flex items-center justify-center h-10 w-10 rounded-pill",
              "text-foreground hover:bg-foreground/5 transition-colors"
            )}
          >
            <Bell className="size-4" aria-hidden />
            {unread > 0 && (
              <span
                className="absolute top-1.5 right-1.5 min-w-[16px] h-[16px] px-1 rounded-full bg-hot-400 text-white text-[9px] font-black flex items-center justify-center"
                aria-hidden
              >
                {unread > 9 ? "9+" : unread}
              </span>
            )}
          </button>
        )}

        {user && onReportClick && (
          <Button
            variant="outline"
            size="sm"
            onClick={onReportClick}
            iconLeft={<Megaphone className="size-3.5" aria-hidden />}
          >
            제보하기
          </Button>
        )}

        {isAdmin && (
          <Button
            asChild
            variant="outline"
            size="sm"
            className="border-hot-400 text-hot-400 hover:bg-hot-400 hover:text-white"
          >
            <Link href="/admin">
              <ShieldCheck className="size-3.5" aria-hidden />
              관리자
            </Link>
          </Button>
        )}

        {user ? (
          <UserChip user={user} onLogout={onLogout} onProfileClick={onProfileClick} />
        ) : (
          <div className="hidden md:flex items-center gap-2">
            <Button asChild variant="ghost" size="md" className="text-sm md:text-[15px] font-bold">
              <Link href="/login">로그인</Link>
            </Button>
            <Button asChild variant="primary" size="md" className="text-sm md:text-[15px] font-bold">
              <Link href="/signup">회원가입</Link>
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
  const ChipInner = (
    <>
      <Avatar
        picture={user.picture}
        isDark={user.isPremium === true}
        size={26}
      />
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
        "inline-flex items-center gap-2 pl-1.5 pr-2 py-1",
        "rounded-pill border",
        user.isPremium
          ? "bg-ink-900 text-cream-200 border-ink-900 dark:bg-cream-200 dark:text-ink-900 dark:border-cream-200"
          : "bg-surface text-foreground border-[var(--color-border)]"
      )}
    >
      {onProfileClick ? (
        <button
          type="button"
          onClick={onProfileClick}
          aria-label="프로필 수정"
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
          className="inline-flex items-center gap-1 px-2 py-1 rounded-pill text-xs opacity-70 hover:opacity-100 transition-opacity"
          aria-label="로그아웃"
        >
          <LogOut className="size-3" aria-hidden />
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
        "rounded-full inline-flex items-center justify-center border border-[var(--color-border)]",
        isDark ? "bg-cream-200/20" : "bg-lime-300/20"
      )}
      style={dimension}
    >
      <UserIcon className="size-3.5 text-lime-500" aria-hidden />
    </span>
  );
}
