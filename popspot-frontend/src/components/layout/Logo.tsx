import { cn } from "@/lib/utils";

/**
 * popspot 로고 마크 — "P-핀".
 *
 * <p>글자 P 의 카운터(속파임) 속 점 = 위치 점, 기둥 끝의 뾰족함 = 핀 꼬리.
 * 즉 P 이자 지도 핀(spot) 이라는 이중 의미를 한 글자에 담은 모노그램.
 *
 * <p>단색({@code fill=currentColor}) 이라 부모의 {@code color} 를 상속 — 라임/잉크/흰색 어디든 올라간다.
 * viewBox 는 마크 실제 bbox 에 맞춰 잘라(여백 최소화) 워드마크와 간격이 일정하게 보이도록 했다.
 */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="24 9 60 86"
      fill="currentColor"
      className={className}
      aria-hidden
      focusable="false"
    >
      <path
        fillRule="evenodd"
        d="M27 13H56a26 26 0 0 1 0 52H46v9l-9 17-10-17V13Z M46 29v22h9a11 11 0 0 0 0-22Z"
      />
      <circle cx="50" cy="40" r="5" />
    </svg>
  );
}

export interface LogoProps {
  /** 루트에 적용 — 보통 font-size 를 지정해 로고 전체 크기를 제어한다. */
  className?: string;
  /** 마크 색/크기 오버라이드 (기본: 라임 + 0.92em). 다크 배경에선 {@code text-lime-300} 등. */
  markClassName?: string;
  /** 워드마크 색 오버라이드 (기본: {@code text-foreground}). 어두운 배경에선 {@code text-cream-200} 등. */
  wordmarkClassName?: string;
  /** 워드마크를 숨기고 마크만 — 모바일 헤더/공간 협소 시. */
  showWordmark?: boolean;
}

/**
 * popspot 브랜드 로고 (마크 + 워드마크).
 *
 * <p>워드마크는 사이트 기본 폰트(Wanted Sans) {@code font-extrabold}, 자간 -0.05em, 가운데 'o' 에
 * 라임 포인트(파비콘 마크와 색을 잇는 장치). 크기는 부모 font-size 를 따르고 마크는 0.92em 로 함께 스케일.
 */
export function Logo({
  className,
  markClassName,
  wordmarkClassName,
  showWordmark = true,
}: LogoProps) {
  return (
    <span
      className={cn("inline-flex items-center gap-[0.28em] leading-none", className)}
      {...(showWordmark ? {} : { role: "img", "aria-label": "popspot" })}
    >
      <LogoMark className={cn("h-[0.92em] w-auto shrink-0 text-lime-500", markClassName)} />
      {showWordmark && (
        <span
          className={cn(
            "font-extrabold tracking-[-0.05em] text-foreground",
            wordmarkClassName,
          )}
        >
          p<span className="text-lime-500">o</span>pspot
        </span>
      )}
    </span>
  );
}
