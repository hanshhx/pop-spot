'use client';

import { useEffect, useState } from 'react';
import { reportClientError } from '@/lib/clientErrorReporter';
import { localeFromPath } from '@/lib/localePath';

const COPY = {
  ko: {
    title: '앱을 다시 불러와야 함',
    body: '일시적인 오류가 발생했음. 다시 시도해도 해결되지 않으면 잠시 후 접속해 주기 바람.',
    retry: '다시 불러오기',
  },
  en: {
    title: 'POP-SPOT needs to reload',
    body: 'A temporary problem occurred. If reloading does not help, please try again in a few minutes.',
    retry: 'Reload',
  },
  ja: {
    title: 'POP-SPOTを再読み込みしてください',
    body: '一時的な問題が発生しました。再読み込みしても直らない場合は、しばらくしてからお試しください。',
    retry: '再読み込み',
  },
} as const;

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  // 전역 오류 화면은 루트 레이아웃까지 대체하므로 LocaleProvider를 쓸 수 없다.
  // 서버와 첫 브라우저 렌더는 같은 영어 문구로 맞추고, 마운트 후 현재 주소의 언어로 전환한다.
  const [locale, setLocale] = useState<'ko' | 'en' | 'ja'>('en');
  const copy = COPY[locale];

  useEffect(() => {
    console.error('Global error', error);
    reportClientError(error);
  }, [error]);

  useEffect(() => {
    setLocale(localeFromPath(window.location.pathname));
  }, []);

  return (
    <html lang={locale}>
      <body className="m-0 bg-[#0a0a0a] text-white">
        <main className="min-h-screen px-6 grid place-items-center">
          <section className="w-full max-w-md text-center">
            <p className="text-sm font-black tracking-[0.2em] text-[#c2f970]">POP-SPOT</p>
            <h1 className="mt-3 text-2xl font-black">{copy.title}</h1>
            <p className="mt-3 text-sm leading-6 text-white/65">{copy.body}</p>
            <button
              type="button"
              onClick={reset}
              className="mt-6 min-h-12 w-full rounded-xl bg-[#c2f970] px-4 font-black text-[#0a0a0a]"
            >
              {copy.retry}
            </button>
          </section>
        </main>
      </body>
    </html>
  );
}
