import { detailRobots } from '@/lib/indexableDetail';
import type { Metadata } from 'next';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  if (!/^\d+$/.test(id)) return { robots: { index: false, follow: false } };
  return {
    /*
     * 영문 상세는 색인하지 않는다 — 팝업 이름 대부분이 한국어 원문이라 같은 내용이 세 벌
     * 올라갈 뿐이다(사이트맵도 같은 이유로 뺐다).
     *
     * 다만 follow 는 남긴다. 영문 랜딩 176장이 이 주소로 링크하는데 여기서 길이 끊기면
     * 그 링크가 전부 막다른 골목이 된다 — 크롤 예산을 쓰기만 하고 아무 데도 닿지 않는다.
     * noindex 는 "검색 결과에 올리지 마라" 이지 "여기서 더 가지 마라" 가 아니다.
     */
    robots: detailRobots(false),
    alternates: {
      canonical: `https://popspot.co.kr/en/popup/${id}`,
      languages: {
        'ko-KR': `https://popspot.co.kr/popup/${id}`,
        'en-US': `https://popspot.co.kr/en/popup/${id}`,
        'ja-JP': `https://popspot.co.kr/ja/popup/${id}`,
        'x-default': `https://popspot.co.kr/popup/${id}`,
      },
    },
  };
}

export default function EnPopupDetailLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
