import type { Metadata } from 'next';

import { fetchPopupForServer, shouldIndexDetail } from './serverData';
import { detailRobots } from '@/lib/indexableDetail';
import { popupDetailTitle } from '@/lib/detailTitle';
import { verifiedPopupImage } from '@/lib/popupEventJsonLd';

/**
 * 팝업 상세의 제목·설명·공유카드와 §14-4 조건부 색인 판정을 한곳에서 만든다.
 *
 * <p>2026-08-11부터 종료일과 찾을 수 있는 장소가 검증된 진행 중 상세만 색인을 허용한다. 날짜가
 * 없거나 끝났거나 장소가 모호하면 계속 noindex다. {@link shouldIndexDetail}을 사이트맵과 공유해
 * "사이트맵에는 있는데 noindex"인 상태가 생기지 않게 한다.
 *
 * <p><b>그런데 왜 제목·설명은 채우는가.</b> {@code noindex} 는 <b>검색 결과에 안 나오게</b> 하는
 * 것이지, 페이지가 자기를 설명하지 말라는 뜻이 아니다. 지금은 상세 URL 을 카톡·X 에 붙여넣으면
 * 루트 레이아웃이 물려준 <b>홈페이지 카드</b>가 뜬다 — 제목이 "POP-SPOT — 서울 팝업스토어
 * 인텔리전스" 이고 {@code og:url} 도 홈이다. 어느 팝업을 공유했는지 받는 사람이 알 수 없다.
 *
 * <p>이 서비스는 착지의 69% 가 딥링크이고 직접 방문이 23% 다. 그 대부분이 누가 링크를 건네준
 * 것이라, 공유 카드는 <b>검색 색인과 무관하게</b> 지금 당장 값이 나오는 자리다.
 *
 * <p><b>robots.txt 로 막지 않는 이유.</b> Disallow 를 걸면 크롤러가 이 meta 를 읽지 못해 URL 만 색인된
 * 채로 남는다. 색인을 지우려면 크롤러가 페이지에 들어와 noindex 를 읽어야 한다.
 */

const SITE = 'https://popspot.co.kr';

/** "07-24 ~ 08-06" · 끝만 알면 "~08-06" · 둘 다 없으면 빈 문자열. 없는 값은 지어내지 않는다. */
function period(m: { openDate?: string; closeDate?: string }): string {
  const from = m.openDate ? m.openDate.slice(5) : '';
  const to = m.closeDate ? m.closeDate.slice(5) : '';
  if (from && to) return `${from} ~ ${to}`;
  if (to) return `~${to}`;
  return from ? `${from} ~` : '';
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const isNumeric = /^\d+$/.test(id);
  // 루트 layout 이 모든 페이지에 홈 canonical 을 물려준다. noindex 여도 자기 URL 을 가리키는 편이
  // 정확하고, 홈을 가리키는 canonical 이 남으면 홈 평가에까지 잡음이 섞인다.
  const canonical = isNumeric ? `${SITE}/popup/${id}` : undefined;

  const base: Metadata = {
    robots: { index: false, follow: false },
    alternates: canonical ? { canonical } : undefined,
  };
  if (!isNumeric) return base;

  // page.tsx 와 <b>같은 함수</b>를 쓴다. 서로 다른 경로로 가져오면 언젠가 한쪽만 고쳐져서
  // 공유 카드에 적힌 것과 페이지에 보이는 것이 달라진다. fetch 캐시도 함께 쓴다.
  const marker = await fetchPopupForServer(id);
  if (!marker) return base;

  // 약관 §14-4와 같은 판정. 사이트맵도 serverData.ts의 같은 함수를 사용한다.
  // follow 를 자격과 무관하게 여는 근거는 detailRobots 주석에 있다.
  const robots = detailRobots(shouldIndexDetail(marker));

  const when = period(marker);
  const where = marker.address?.trim() ?? '';
  // 루트 layout 의 title.template 이 "· POP-SPOT" 을 붙인다. 여기서는 검색자가 찾는
  // "팝업 일정·위치"까지만 중복 없이 붙이고 브랜드명은 템플릿에 맡긴다.
  const title = popupDetailTitle(marker.name);
  // og:title 은 템플릿이 적용되지 않으므로 브랜드를 직접 붙인다.
  const ogTitle = `${title} · POP-SPOT`;
  // 링크를 받은 사람이 갈지 말지 정하는 데 필요한 것 — 언제, 어디서.
  const description =
    [when, where].filter(Boolean).join(' · ') || '서울 팝업스토어 정보를 지도로 한눈에 — POP-SPOT';
  const socialImage = verifiedPopupImage(marker);

  return {
    ...base,
    robots,
    title,
    description,
    openGraph: {
      title: ogTitle,
      description,
      url: canonical,
      siteName: 'POP-SPOT',
      type: 'website',
      images: socialImage ? [socialImage] : undefined,
    },
    twitter: {
      card: socialImage ? 'summary_large_image' : 'summary',
      title: ogTitle,
      description,
      images: socialImage ? [socialImage] : undefined,
    },
  };
}

export default function PopupDetailLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
