import type { Metadata } from 'next';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  if (!/^\d+$/.test(id)) return { robots: { index: false, follow: false } };
  return {
    robots: { index: false, follow: false },
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
  return <>{children}</>;
}
