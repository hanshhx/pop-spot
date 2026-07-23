'use client';

import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * POP-SPOT Button.
 *
 * - variant: primary(라임) / accent(핫핑크) / ink(검정) / outline / ghost / link
 * - size: sm / md / lg / icon
 * - asChild: true 면 자식 요소(예: <Link>)를 Button 의 스타일로 변신
 *            (자식 안에 아이콘/텍스트를 명시적으로 배치해야 함)
 * - loading: 자동으로 spinner 표시 + disabled
 * - iconLeft / iconRight: 일반 button 일 때만 자동 배치. asChild 일 때는 무시됨.
 */
const buttonVariants = cva(
  [
    'inline-flex items-center justify-center gap-2',
    'rounded-pill font-semibold whitespace-nowrap',
    'transition-[background-color,color,transform,box-shadow] duration-200',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
    'focus-visible:ring-offset-[var(--color-background)]',
    'disabled:pointer-events-none disabled:opacity-50',
    'active:scale-[0.98]',
  ].join(' '),
  {
    variants: {
      variant: {
        primary: 'bg-lime-300 text-ink-900 hover:bg-lime-400 shadow-sm hover:shadow-md',
        accent: 'bg-hot-400 text-white hover:bg-hot-500 shadow-sm hover:shadow-md',
        ink: 'bg-ink-900 text-cream-200 hover:bg-ink-700 dark:bg-cream-200 dark:text-ink-900 dark:hover:bg-cream-300',
        outline:
          'bg-transparent border border-[var(--color-border-strong)] text-foreground hover:bg-foreground/5',
        ghost: 'bg-transparent text-foreground hover:bg-foreground/5',
        link: 'bg-transparent text-foreground underline-offset-4 hover:underline rounded-none px-0',
      },
      size: {
        sm: 'h-8 px-3 text-xs',
        md: 'h-10 px-4 text-sm',
        lg: 'h-12 px-6 text-base',
        icon: 'h-10 w-10',
      },
      block: {
        true: 'w-full',
        false: '',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md',
      block: false,
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  loading?: boolean;
  iconLeft?: React.ReactNode;
  iconRight?: React.ReactNode;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant,
      size,
      block,
      asChild = false,
      loading = false,
      disabled,
      iconLeft,
      iconRight,
      children,
      ...props
    },
    ref,
  ) => {
    const classes = cn(buttonVariants({ variant, size, block, className }));

    // asChild=true: 자식 요소를 Button 스타일로 변신.
    // Slot은 단일 자식만 받으므로 아이콘은 자식 element 안에 넣어줘야 함.
    if (asChild) {
      const child = React.Children.only(children) as React.ReactElement<{
        className?: string;
        children?: React.ReactNode;
      }>;
      return (
        <Slot ref={ref as never} className={classes} {...props}>
          {React.cloneElement(child, {
            className: cn(child.props.className),
            children: (
              <>
                {loading ? <Loader2 className="size-4 animate-spin" aria-hidden /> : iconLeft}
                {child.props.children}
                {!loading && iconRight}
              </>
            ),
          })}
        </Slot>
      );
    }

    return (
      <button
        ref={ref}
        className={classes}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        {...props}
      >
        {loading ? <Loader2 className="size-4 animate-spin" aria-hidden /> : iconLeft}
        {children}
        {!loading && iconRight}
      </button>
    );
  },
);
Button.displayName = 'Button';
