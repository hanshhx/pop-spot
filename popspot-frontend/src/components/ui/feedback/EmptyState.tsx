'use client';

import { type ReactNode } from 'react';
import { Inbox } from 'lucide-react';

import { cn } from '@/lib/utils';

interface EmptyStateProps {
  /** 좌측 또는 상단 아이콘. 미지정 시 lucide Inbox. */
  icon?: ReactNode;
  /** 굵은 타이틀 한 줄. */
  title: string;
  /** 설명 1~2 줄. */
  description?: string;
  /** 액션 버튼 (보통 회원가입 유도 / 데이터 추가 안내). */
  action?: ReactNode;
  /** 추가 className — 부모에서 패딩/마진 조정. */
  className?: string;
  /** 점선 테두리 카드형 (default true) vs 단순 텍스트형 (false). */
  bordered?: boolean;
}

/**
 * v2.18 — 빈 상태 표시 공용 컴포넌트.
 *
 * <p>이전엔 위시리스트 / 메이트 게시판 / 코스 / 의견 등 각 컴포넌트가 자체 빈 상태 UI 를 따로
 * 만들어 톤이 다 달랐다. 본 컴포넌트로 통일해 일관된 사용자 경험 + 다음에 빈 상태 만들 때
 * 결정 부담 ↓.
 *
 * @example
 *   <EmptyState title="아직 보낸 의견이 없습니다" description="자유롭게 의견을 남겨 주세요" />
 */
export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
  bordered = true,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center text-center',
        'py-10 px-6 gap-3',
        bordered && 'rounded-md border border-dashed border-[var(--color-border-strong)]',
        className,
      )}
    >
      <div className="text-muted-foreground">
        {icon ?? <Inbox className="size-8" aria-hidden />}
      </div>
      <p className="text-sm font-semibold text-foreground">{title}</p>
      {description && (
        <p className="text-xs text-muted-foreground max-w-xs whitespace-pre-line">{description}</p>
      )}
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
}
