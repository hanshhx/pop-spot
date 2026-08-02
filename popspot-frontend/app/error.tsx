'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { reportClientError } from '@/lib/clientErrorReporter';
import { useLocale } from '@/lib/i18n';
import { localizedPath } from '@/lib/localePath';

const COPY = {
  ko: {
    eyebrow: '잠시 문제가 생겼음',
    title: '화면을 불러오지 못했음',
    body: '입력한 내용은 그대로 두고 다시 시도할 수 있음. 계속되면 홈으로 이동해 주기 바람.',
    retry: '다시 시도',
    home: '홈으로',
  },
  en: {
    eyebrow: 'Something went wrong',
    title: 'This page could not be loaded',
    body: 'You can try again without losing what you entered. If the problem continues, return to the home page.',
    retry: 'Try again',
    home: 'Home',
  },
  ja: {
    eyebrow: '問題が発生しました',
    title: '画面を読み込めませんでした',
    body: '入力内容を残したまま、もう一度お試しいただけます。続く場合はホームに戻ってください。',
    retry: 'もう一度試す',
    home: 'ホームへ',
  },
} as const;

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const { locale } = useLocale();
  const copy = COPY[locale];
  useEffect(() => {
    console.error('Page error', error);
    reportClientError(error);
  }, [error]);

  return (
    <main className="min-h-screen bg-[#0a0a0a] px-6 text-white grid place-items-center">
      <section className="w-full max-w-md rounded-3xl border border-white/15 bg-white/5 p-8 text-center shadow-2xl">
        <p className="mb-3 text-sm font-black uppercase tracking-[0.22em] text-[#c2f970]">
          {copy.eyebrow}
        </p>
        <h1 className="text-2xl font-black">{copy.title}</h1>
        <p className="mt-3 text-sm leading-6 text-white/65">{copy.body}</p>
        <div className="mt-6 grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={reset}
            className="min-h-12 rounded-xl bg-[#c2f970] px-4 font-black text-[#0a0a0a]"
          >
            {copy.retry}
          </button>
          <Link
            href={localizedPath('/', locale)}
            className="min-h-12 rounded-xl border border-white/20 px-4 font-bold grid place-items-center"
          >
            {copy.home}
          </Link>
        </div>
      </section>
    </main>
  );
}
