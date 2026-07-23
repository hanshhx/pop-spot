'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { reportClientError } from '@/lib/clientErrorReporter';

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Page error', error);
    reportClientError(error);
  }, [error]);

  return (
    <main className="min-h-screen bg-[#0a0a0a] px-6 text-white grid place-items-center">
      <section className="w-full max-w-md rounded-3xl border border-white/15 bg-white/5 p-8 text-center shadow-2xl">
        <p className="mb-3 text-sm font-black uppercase tracking-[0.22em] text-[#c2f970]">
          잠시 문제가 생겼음
        </p>
        <h1 className="text-2xl font-black">화면을 불러오지 못했음</h1>
        <p className="mt-3 text-sm leading-6 text-white/65">
          입력한 내용은 그대로 두고 다시 시도할 수 있음. 계속되면 홈으로 이동해 주기 바람.
        </p>
        <div className="mt-6 grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={reset}
            className="min-h-12 rounded-xl bg-[#c2f970] px-4 font-black text-[#0a0a0a]"
          >
            다시 시도
          </button>
          <Link
            href="/"
            className="min-h-12 rounded-xl border border-white/20 px-4 font-bold grid place-items-center"
          >
            홈으로
          </Link>
        </div>
      </section>
    </main>
  );
}
