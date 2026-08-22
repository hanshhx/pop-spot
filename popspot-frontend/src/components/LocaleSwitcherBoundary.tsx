'use client';

import { Suspense } from 'react';

import LocaleSwitcher from '@/components/LocaleSwitcher';
import type { Locale } from '@/lib/i18n';

/**
 * 정적 페이지에서도 현재 쿼리를 보존하는 언어 선택기를 안전하게 표시한다.
 *
 * LocaleSwitcher 는 현재 주소의 검색 조건까지 다음 언어 주소로 옮기기 위해
 * useSearchParams 를 사용한다. Next.js 정적 생성에서는 그 훅을 Suspense 아래에 두어야 하므로,
 * 상세·SEO 랜딩·의견 페이지가 각자 같은 경계를 반복하지 않도록 여기서 한 번 감싼다.
 */
export default function LocaleSwitcherBoundary({
  locale,
  className = '',
}: {
  locale: Locale;
  className?: string;
}) {
  return (
    <Suspense
      fallback={<span aria-hidden="true" className={`inline-block h-10 w-[74px] ${className}`} />}
    >
      <LocaleSwitcher locale={locale} className={className} />
    </Suspense>
  );
}
