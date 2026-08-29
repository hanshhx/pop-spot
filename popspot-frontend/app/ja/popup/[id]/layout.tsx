import { detailRobots } from '@/lib/indexableDetail';
import type { Metadata } from 'next';

import { SiteChrome } from '@/components/layout/SiteChrome';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  if (!/^\d+$/.test(id)) return { robots: { index: false, follow: false } };
  return {
    // 근거는 영문판(app/en/popup/[id]/layout.tsx)과 같다 — 색인은 막되 길은 열어 둔다.
    // 일문 랜딩 176장이 이 주소로 링크하므로, 여기서 끊으면 그만큼이 막다른 골목이 된다.
    robots: detailRobots(false),
    alternates: {
      canonical: `https://popspot.co.kr/ja/popup/${id}`,
      languages: {
        'ko-KR': `https://popspot.co.kr/popup/${id}`,
        'en-US': `https://popspot.co.kr/en/popup/${id}`,
        'ja-JP': `https://popspot.co.kr/ja/popup/${id}`,
        'x-default': `https://popspot.co.kr/popup/${id}`,
      },
    },
  };
}

export default function JaPopupDetailLayout({ children }: { children: React.ReactNode }) {
  // 근거는 한국어판(app/popup/[id]/layout.tsx) 주석에 있다.
  return <SiteChrome>{children}</SiteChrome>;
}
