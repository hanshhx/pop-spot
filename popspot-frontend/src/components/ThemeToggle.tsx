'use client';

import { useTheme } from 'next-themes';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Sun, Moon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLocale } from '@/lib/i18n';
import { THEME_SWITCHING_CLASS, themeSwitchMs } from '@/lib/themeTransition';

/**
 * 라이트/다크 토글.
 * SSR 시점에는 placeholder 자리만 잡고, mount 후 실제 아이콘 표시 (hydration mismatch 방지).
 */
export default function ThemeToggle() {
  const { t } = useLocale();
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const isDark = resolvedTheme === 'dark';

  /**
   * 전환하는 <b>동안에만</b> 전역 transition 을 켠다. 규칙은 globals.css 의 .theme-switching.
   *
   * <p>타이머를 ref 로 들고 있는 이유: 전환이 끝나기 전에 다시 누르면 앞선 타이머가 뒤늦게
   * 발화해 <b>한창 흐르는 중에 클래스를 떼어 버린다.</b> 두 번째 전환만 딱딱해지는데, 재현이
   * 어려워 원인을 찾기 힘든 종류의 버그다.
   */
  const timerRef = useRef(0);
  useEffect(() => () => window.clearTimeout(timerRef.current), []);

  const toggle = useCallback(() => {
    const root = document.documentElement;
    root.classList.add(THEME_SWITCHING_CLASS);
    setTheme(isDark ? 'light' : 'dark');

    window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(
      () => root.classList.remove(THEME_SWITCHING_CLASS),
      // 전환이 끝나고 한 프레임 뒤에 뗀다. 딱 맞춰 떼면 마지막 프레임이 잘려 미세하게 튄다.
      themeSwitchMs(root) + 40,
    );
  }, [isDark, setTheme]);

  return (
    <Button
      variant="outline"
      size="icon"
      onClick={toggle}
      aria-label={isDark ? t('theme.toLight') : t('theme.toDark')}
      className="rounded-pill"
    >
      {mounted ? (
        isDark ? (
          <Sun className="size-4" aria-hidden />
        ) : (
          <Moon className="size-4" aria-hidden />
        )
      ) : (
        <span className="size-4" aria-hidden />
      )}
    </Button>
  );
}
