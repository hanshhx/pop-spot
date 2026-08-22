'use client';

import { useTheme } from 'next-themes';
import { useCallback, useEffect, useState } from 'react';
import { Sun, Moon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLocale } from '@/lib/i18n';
import { runTransientClass, THEME_SWITCHING_CLASS } from '@/lib/transientClass';

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

  /** 전환하는 <b>동안에만</b> 전역 transition 을 켠다. 규칙은 globals.css 의 .theme-switching. */
  const toggle = useCallback(() => {
    runTransientClass(document.documentElement, THEME_SWITCHING_CLASS, '--theme-switch-ms');
    setTheme(isDark ? 'light' : 'dark');
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
