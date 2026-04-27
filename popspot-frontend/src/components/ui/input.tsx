"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * 텍스트 입력 — `<Input>`.
 * 폼 라벨과 에러는 <Field> 로 감싸서 사용:
 *
 *   <Field label="이메일" error={errors.email}>
 *     <Input type="email" name="email" />
 *   </Field>
 */
export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean;
  iconLeft?: React.ReactNode;
  iconRight?: React.ReactNode;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, invalid, iconLeft, iconRight, ...props }, ref) => {
    if (iconLeft || iconRight) {
      return (
        <div className="relative w-full">
          {iconLeft && (
            <span
              className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            >
              {iconLeft}
            </span>
          )}
          <input
            ref={ref}
            className={cn(
              inputBase,
              iconLeft && "pl-10",
              iconRight && "pr-10",
              invalid && invalidClass,
              className
            )}
            aria-invalid={invalid || undefined}
            {...props}
          />
          {iconRight && (
            <span
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            >
              {iconRight}
            </span>
          )}
        </div>
      );
    }
    return (
      <input
        ref={ref}
        className={cn(inputBase, invalid && invalidClass, className)}
        aria-invalid={invalid || undefined}
        {...props}
      />
    );
  }
);
Input.displayName = "Input";

const inputBase = cn(
  "flex h-11 w-full rounded-md border border-[var(--color-border-strong)]",
  "bg-surface text-surface-foreground",
  "px-4 py-2 text-sm",
  "placeholder:text-muted-foreground",
  "transition-colors duration-150",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
  "focus-visible:border-transparent",
  "disabled:opacity-50 disabled:cursor-not-allowed",
  "file:border-0 file:bg-transparent file:text-sm file:font-medium"
);

const invalidClass =
  "border-danger focus-visible:ring-danger";

/* ------------------------------------------------------------ */
/*  <Field>  — label + helper + error wrapper                   */
/* ------------------------------------------------------------ */
export interface FieldProps {
  label?: React.ReactNode;
  helper?: React.ReactNode;
  error?: React.ReactNode;
  required?: boolean;
  htmlFor?: string;
  className?: string;
  children: React.ReactNode;
}

export function Field({
  label,
  helper,
  error,
  required,
  htmlFor,
  className,
  children,
}: FieldProps) {
  const generatedId = React.useId();
  const id = htmlFor ?? generatedId;

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      {label && (
        <label
          htmlFor={id}
          className="text-xs font-semibold text-foreground tracking-wide"
        >
          {label}
          {required && (
            <span className="text-danger ml-0.5" aria-label="필수">
              *
            </span>
          )}
        </label>
      )}
      {React.isValidElement(children)
        ? React.cloneElement(children as React.ReactElement<{ id?: string }>, {
            id,
          })
        : children}
      {error ? (
        <p className="text-xs text-danger" role="alert">
          {error}
        </p>
      ) : helper ? (
        <p className="text-xs text-muted-foreground">{helper}</p>
      ) : null}
    </div>
  );
}
