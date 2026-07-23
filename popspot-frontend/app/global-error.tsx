'use client';

import { useEffect } from 'react';
import { reportClientError } from '@/lib/clientErrorReporter';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Global error', error);
    reportClientError(error);
  }, [error]);

  return (
    <html lang="ko">
      <body className="m-0 bg-[#0a0a0a] text-white">
        <main className="min-h-screen px-6 grid place-items-center">
          <section className="w-full max-w-md text-center">
            <p className="text-sm font-black tracking-[0.2em] text-[#c2f970]">POP-SPOT</p>
            <h1 className="mt-3 text-2xl font-black">앱을 다시 불러와야 함</h1>
            <p className="mt-3 text-sm leading-6 text-white/65">
              일시적인 오류가 발생했음. 다시 시도해도 해결되지 않으면 잠시 후 접속해 주기 바람.
            </p>
            <button
              type="button"
              onClick={reset}
              className="mt-6 min-h-12 w-full rounded-xl bg-[#c2f970] px-4 font-black text-[#0a0a0a]"
            >
              다시 불러오기
            </button>
          </section>
        </main>
      </body>
    </html>
  );
}
