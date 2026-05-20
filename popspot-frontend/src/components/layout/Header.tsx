"use client";

import Link from "next/link";
import { LogOut, ShieldCheck, Megaphone, Crown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import ThemeToggle from "@/components/ThemeToggle";
import { cn } from "@/lib/utils";

export interface HeaderUser {
  userId: string;
  nickname: string;
  isPremium?: boolean;
  role?: string;
}

interface HeaderProps {
  user: HeaderUser | null;
  onLogout?: () => void;
  onReportClick?: () => void;
  onLogoClick?: () => void;
  subtitle?: string;
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
  subtitle = "Seoul Popup Store Intelligence",
  className,
}: HeaderProps) {
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
        <h1 className="font-display-en text-3xl md:text-5xl font-extrabold tracking-tighter leading-none transition-colors group-hover:text-lime-500">
          POP-SPOT<span className="text-lime-300">.</span>
        </h1>
        <p className="text-[10px] md:text-xs mt-1 tracking-[0.2em] uppercase text-muted-foreground">
          {subtitle}
        </p>
      </Link>

      <nav
        aria-label="사용자 메뉴"
        className="flex items-center gap-2 md:gap-3 self-end md:self-auto"
      >
        <ThemeToggle />

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
          <UserChip user={user} onLogout={onLogout} />
        ) : (
          <div className="hidden md:flex items-center gap-2">
            <Button asChild variant="ghost" size="sm">
              <Link href="/login">로그인</Link>
            </Button>
            <Button asChild variant="primary" size="sm">
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
}: {
  user: HeaderUser;
  onLogout?: () => void;
}) {
  return (
    <div
      className={cn(
        "hidden md:inline-flex items-center gap-3 pl-3 pr-2 py-1.5",
        "rounded-pill border",
        user.isPremium
          ? "bg-ink-900 text-cream-200 border-ink-900 dark:bg-cream-200 dark:text-ink-900 dark:border-cream-200"
          : "bg-surface text-foreground border-[var(--color-border)]"
      )}
    >
      {user.isPremium && (
        <Badge tone="lime" size="sm" className="px-1.5">
          <Crown className="size-3" aria-hidden />
          PRO
        </Badge>
      )}
      <span className="text-sm font-semibold">{user.nickname}</span>
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
