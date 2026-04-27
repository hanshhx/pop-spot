import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * 모든 카드의 기본 컨테이너.
 *
 * - tone="surface" (기본): 흰색/다크 ink-700 배경 + border
 * - tone="muted": cream-300 / ink-800 (서브 영역)
 * - tone="ink": 항상 검정 (강조 카드)
 * - radius: md / lg / xl (기본 lg)
 * - elevation: flat / sm / md / lg
 */
type Tone = "surface" | "muted" | "ink";
type Radius = "md" | "lg" | "xl";
type Elevation = "flat" | "sm" | "md" | "lg";

const toneClass: Record<Tone, string> = {
  surface:
    "bg-surface text-surface-foreground border border-[var(--color-border)]",
  muted:
    "bg-cream-300 dark:bg-ink-800 text-foreground border border-[var(--color-border)]",
  ink: "bg-ink-900 text-cream-200 border border-ink-700",
};

const radiusClass: Record<Radius, string> = {
  md: "rounded-md",
  lg: "rounded-lg",
  xl: "rounded-xl",
};

const elevationClass: Record<Elevation, string> = {
  flat: "",
  sm: "shadow-sm",
  md: "shadow-md",
  lg: "shadow-lg",
};

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  tone?: Tone;
  radius?: Radius;
  elevation?: Elevation;
  asChild?: boolean;
}

export const Card = React.forwardRef<HTMLDivElement, CardProps>(
  (
    {
      className,
      tone = "surface",
      radius = "lg",
      elevation = "sm",
      ...props
    },
    ref
  ) => (
    <div
      ref={ref}
      className={cn(
        toneClass[tone],
        radiusClass[radius],
        elevationClass[elevation],
        "transition-shadow duration-200",
        className
      )}
      {...props}
    />
  )
);
Card.displayName = "Card";

export const CardHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex flex-col gap-1 p-5 md:p-6", className)}
    {...props}
  />
));
CardHeader.displayName = "CardHeader";

export const CardTitle = React.forwardRef<
  HTMLHeadingElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h3
    ref={ref}
    className={cn("text-lg font-bold tracking-tight", className)}
    {...props}
  />
));
CardTitle.displayName = "CardTitle";

export const CardDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
));
CardDescription.displayName = "CardDescription";

export const CardContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("p-5 md:p-6 pt-0", className)} {...props} />
));
CardContent.displayName = "CardContent";

export const CardFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex items-center p-5 md:p-6 pt-0", className)}
    {...props}
  />
));
CardFooter.displayName = "CardFooter";
