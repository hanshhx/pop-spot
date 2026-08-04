import type { Metadata } from 'next';

/**
 * 팝업 상세 — 제목·설명·공유카드는 채우되, 검색 색인은 <b>계속 막는다.</b>
 *
 * <p><b>왜 색인을 막는가.</b> 이용약관 <b>§14-4</b> 가 "자동수집된 개별 팝업스토어 상세 페이지는
 * 사이트맵에 포함하지 않으며 {@code noindex} 메타 태그로 검색엔진 색인을 명시적으로 차단합니다"
 * 라고 공표해 뒀다.
 *
 * <p>예전 주석은 원인을 채팅(ChatRoom)이라고 적었는데 <b>틀렸다.</b> 회원 콘텐츠 조항은 그 다음
 * 항목(§14-5)이고, §14-4 는 그와 별개로 <b>자동수집 상세 전체</b>를 막는다. 즉 채팅을 이 URL 에서
 * 떼어도 색인은 못 연다. 열려면 약관 개정과 7일 사전 공지(§15-1)가 먼저이고, <b>코드가 그 상태가
 * 된 뒤에</b> 약관을 고쳐야 한다 — 지키지 못할 문장을 먼저 공표할 수는 없다.
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

/** 공유 카드에 쓸 최소 정보. 지도 마커 API 가 이미 내려주는 값만 쓴다. */
type Marker = {
  id: number;
  name: string;
  location: string | null;
  startDate: string | null;
  endDate: string | null;
};

/**
 * 팝업 하나를 찾는다.
 *
 * <p>{@code sitemap.ts} 와 <b>같은 요청·같은 옵션</b>을 쓴다. Next 가 fetch 캐시를 공유하므로 백엔드
 * 호출이 늘지 않는다. 실패하면 null — 공유 카드가 예전처럼 홈 값으로 떨어질 뿐, 상세가 깨지지 않는다.
 * 메타데이터 하나 때문에 페이지를 500 으로 만들지 않는다.
 */
async function findMarker(id: string): Promise<Marker | null> {
  const apiBase = process.env.NEXT_PUBLIC_API_URL;
  if (!apiBase || !/^https?:\/\//.test(apiBase)) return null;

  try {
    const res = await fetch(`${apiBase}/api/map/markers`, { next: { revalidate: 3600 } });
    if (!res.ok) return null;
    const markers = (await res.json()) as Marker[];
    return markers.find((m) => String(m.id) === id) ?? null;
  } catch {
    return null;
  }
}

/** "07-24 ~ 08-06" · 끝만 알면 "~08-06" · 둘 다 없으면 빈 문자열. 없는 값은 지어내지 않는다. */
function period(m: Marker): string {
  const from = m.startDate ? m.startDate.slice(5) : '';
  const to = m.endDate ? m.endDate.slice(5) : '';
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

  const marker = await findMarker(id);
  if (!marker) return base;

  const when = period(marker);
  const where = marker.location?.trim() ?? '';
  // 루트 layout 의 title.template 이 "· POP-SPOT" 을 붙인다. 여기서 또 붙이면
  // "짱구는못말려 대축제 | POP-SPOT · POP-SPOT" 이 된다. 이름만 넘긴다.
  const title = marker.name;
  // og:title 은 템플릿이 적용되지 않으므로 브랜드를 직접 붙인다.
  const ogTitle = `${marker.name} · POP-SPOT`;
  // 링크를 받은 사람이 갈지 말지 정하는 데 필요한 것 — 언제, 어디서.
  const description =
    [when, where].filter(Boolean).join(' · ') || '서울 팝업스토어 정보를 지도로 한눈에 — POP-SPOT';

  return {
    ...base,
    title,
    description,
    openGraph: {
      title: ogTitle,
      description,
      url: canonical,
      siteName: 'POP-SPOT',
      type: 'website',
    },
    twitter: { card: 'summary_large_image', title: ogTitle, description },
  };
}

export default function PopupDetailLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
