'use client';

import { useTheme } from 'next-themes';
import { useCallback, useEffect, useState } from 'react';
import { flushSync } from 'react-dom';
import { Sun, Moon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLocale } from '@/lib/i18n';
import { runTransientClass, THEME_SWITCHING_CLASS } from '@/lib/transientClass';
import { useDocumentDark } from '@/lib/documentTheme';

/**
 * 라이트/다크 토글.
 * SSR 시점에는 placeholder 자리만 잡고, mount 후 실제 아이콘 표시 (hydration mismatch 방지).
 */
export default function ThemeToggle() {
  const { t } = useLocale();
  const { setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  /*
   * 지금 다크인지는 <html> 의 클래스에서 읽는다. next-themes 의 resolvedTheme 은 마운트 직후
   * 잠깐 undefined 인데, 클래스는 그 전에 인라인 스크립트가 이미 붙여 둔다. 그 창에서 누르면
   * isDark 가 false 로 잡혀 이미 다크인 화면에 다시 다크를 거는 헛손질이 된다.
   * 지도에서 같은 어긋남이 지도를 반대 테마로 굳혔었다 — 경위는 lib/documentTheme 주석.
   */
  const isDark = useDocumentDark();

  /**
   * 테마 전환.
   *
   * <h3>왜 CSS transition 이 아니라 브라우저에 맡기는가</h3>
   *
   * <p>전역 transition 방식은 부드럽긴 했지만 눈에 띄게 버벅였다. 재 봤더니 홈에서 클래스를
   * 뒤집는 순간 <b>동시 전환 1,771개</b>가 시작되고 스타일 재계산에 <b>316ms</b> 가 걸린다 —
   * 그동안 메인 스레드가 통째로 막힌다. 그중 1,174개가 {@code color} 였는데, color 는 상속
   * 속성이라 조상이 흐르면 자손은 자기 전환 없이도 따라온다. 대부분이 헛일이었던 셈이다.
   *
   * <p>{@link Document.startViewTransition} 은 전후 화면을 스냅샷으로 떠서 GPU 에서 겹쳐
   * 넘긴다. 요소가 몇 개든 텍스처 두 장을 합성하는 비용이고, 배경 영상과 지도(WebGL)처럼
   * 색으로 바뀌지 않는 면도 그림째로 함께 넘어간다.
   *
   * <p>{@code flushSync} 가 필요한 이유: 스냅샷은 콜백이 끝난 시점의 DOM 으로 뜬다. 그런데
   * next-themes 는 {@code setTheme} 에서 상태만 바꾸고 {@code <html>} 클래스는 그 뒤 effect 에서
   * 붙인다. 그냥 부르면 콜백이 끝날 때까지 화면이 그대로라 <b>바뀐 것이 없는 크로스페이드</b>가
   * 된다.
   *
   * <p>이 API 가 없는 브라우저(파이어폭스)에서는 예전 방식으로 물러선다.
   */
  const toggle = useCallback(() => {
    const next = isDark ? 'light' : 'dark';
    const calm = window.matchMedia('(prefers-reduced-motion: no-preference)').matches;

    if (calm && typeof document.startViewTransition === 'function') {
      document.startViewTransition(() => flushSync(() => setTheme(next)));
      return;
    }

    runTransientClass(document.documentElement, THEME_SWITCHING_CLASS, '--theme-switch-ms');
    setTheme(next);
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
