'use client';

import { ThemeProvider } from 'next-themes';
import { useEffect, useState, type ReactNode } from 'react';

/**
 * 클라이언트 전용 Provider 묶음.
 *
 * <p>SSR hydration mismatch 회피를 위해 마운트 이후에만 {@link ThemeProvider} 를 활성화한다.
 * 첫 렌더 (서버) 에서는 children 만 그대로 노출 → CSS 변수가 없는 상태로 잠깐 보이지만 깜빡임이
 * `class="dark"` mismatch 보다 훨씬 덜 눈에 띈다.
 *
 * <p>{@code attribute="class"} 가 있어야 `<html>` 태그에 `class="dark"` 가 붙어 Tailwind dark
 * variant 가 동작한다. `enableSystem` 은 OS 다크 모드 자동 추종.
 */
export function Providers({ children }: { children: ReactNode }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return <>{children}</>;

  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      {children}
    </ThemeProvider>
  );
}
