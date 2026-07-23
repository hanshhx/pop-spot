import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

/**
 * 작은 라벨/태그.
 * - tone: lime / hot / violet / ink / outline / muted / success / warning / danger
 * - size: sm / md
 */
const badgeVariants = cva(
  'inline-flex items-center gap-1 rounded-pill font-semibold tracking-wide whitespace-nowrap',
  {
    variants: {
      tone: {
        lime: 'bg-lime-300 text-lime-900',
        hot: 'bg-hot-400 text-white',
        violet: 'bg-violet-400 text-white',
        ink: 'bg-ink-900 text-cream-200 dark:bg-cream-200 dark:text-ink-900',
        outline: 'bg-transparent border border-[var(--color-border-strong)] text-foreground',
        muted: 'bg-cream-300 dark:bg-ink-800 text-muted-foreground',
        success: 'bg-success/15 text-success',
        warning: 'bg-warning/15 text-warning',
        danger: 'bg-danger/15 text-danger',
      },
      size: {
        sm: 'text-[10px] h-5 px-2',
        md: 'text-xs h-6 px-2.5',
      },
    },
    defaultVariants: {
      tone: 'muted',
      size: 'md',
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {}

export function Badge({ className, tone, size, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ tone, size }), className)} {...props} />;
}
