'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ArrowLeft } from 'lucide-react';

import { FeedbackForm } from '@/features/feedback/FeedbackForm';
import { MyFeedbackList } from '@/features/feedback/MyFeedbackList';
import { useLocale } from '@/lib/i18n';
import { localizedPath } from '@/lib/localePath';
import type { User } from '@/types/popup';

const USER_KEY = 'user';

/**
 * /feedback — 의견 보내기 전용 페이지.
 *
 * <p>왼쪽에 작성 폼, 오른쪽에 본인 보낸 목록을 표시. 로그인 사용자는 답변까지 확인할 수 있고,
 * 게스트는 작성 폼만 사용. 비회원 접근 허용 페이지라 AuthGuard PUBLIC_PATHS 에 포함.
 */
export default function FeedbackPage() {
  const { t, locale } = useLocale();
  const [userId, setUserId] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const raw = window.localStorage.getItem(USER_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as User;
      setUserId(parsed.userId ?? parsed.id ?? null);
    } catch {
      setUserId(null);
    }
  }, []);

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      <header className="mb-6 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">{t('fb.pageTitle')}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t('fb.pageDescription')}</p>
        </div>
        <Link
          href={localizedPath('/', locale)}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" aria-hidden />
          {t('fb.back')}
        </Link>
      </header>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-5">
        <section className="lg:col-span-3">
          <div className="rounded-lg border border-[var(--color-border-strong)] bg-surface p-5">
            <h2 className="mb-4 text-base font-semibold text-foreground">{t('fb.new')}</h2>
            <FeedbackForm userId={userId} onSubmitted={() => setRefreshKey((v) => v + 1)} />
          </div>
        </section>

        <aside className="lg:col-span-2">
          <div className="rounded-lg border border-[var(--color-border-strong)] bg-surface p-5">
            <h2 className="mb-4 text-base font-semibold text-foreground">{t('fb.mine')}</h2>
            <MyFeedbackList userId={userId} refreshKey={refreshKey} />
          </div>
        </aside>
      </div>
    </main>
  );
}
