'use client';

import { AlertTriangle, RefreshCw } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { useLocale } from '@/lib/i18n';
import { cn } from '@/lib/utils';

interface ErrorStateProps {
  /** 한 줄 타이틀. 미지정 시 화면 언어에 맞춘 기본 문구. */
  title?: string;
  /** 사용자 친화 메시지. 기술 용어 / stack trace 노출 금지. 미지정 시 기본 문구. */
  message?: string;
  /** 재시도 버튼 클릭 핸들러. 미지정 시 버튼 미노출. */
  onRetry?: () => void;
  /** 점선 테두리 카드형 (default true) vs 텍스트형. */
  bordered?: boolean;
  className?: string;
}

/**
 * v2.18 — 에러 상태 표시 공용 컴포넌트.
 *
 * <p>이전엔 "오류" / "Network Error" / "서버와 연결할 수 없습니다" 등 산발적이고 일부는 stack
 * trace 까지 노출. 본 컴포넌트로 통일해 사용자 친화 메시지 + 재시도 버튼 + 일관된 톤.
 *
 * @example
 *   <ErrorState message="목록을 불러오지 못했습니다." onRetry={refetch} />
 */
export function ErrorState({
  title,
  message,
  onRetry,
  bordered = true,
  className,
}: ErrorStateProps) {
  const { t } = useLocale();
  // 기본 문구를 매개변수 기본값에 두지 않는 이유 — t() 는 훅에서 나오고, 훅은 본문 안에서만 부를 수 있다.
  const heading = title ?? t('misc.errorTitle');
  const body = message ?? t('misc.errorMessage');

  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center text-center',
        'py-8 px-6 gap-3',
        bordered && 'rounded-md border border-danger/30 bg-danger/5',
        className,
      )}
      role="alert"
    >
      <AlertTriangle className="size-7 text-danger" aria-hidden />
      <p className="text-sm font-semibold text-foreground">{heading}</p>
      <p className="text-xs text-muted-foreground max-w-xs whitespace-pre-line">{body}</p>
      {onRetry && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          iconLeft={<RefreshCw className="size-3.5" aria-hidden />}
          onClick={onRetry}
        >
          {t('misc.errorRetry')}
        </Button>
      )}
    </div>
  );
}
