import PopupDetailClient from './PopupDetailClient';
import { buildPopupEventJsonLd, serializeJsonLd } from '@/lib/popupEventJsonLd';
import { fetchPopupForServer, kstToday, shouldIndexDetail } from './serverData';

/**
 * 팝업 상세 — <b>서버가 내용을 그린다.</b>
 *
 * <p>예전에는 이 경로가 통째로 클라이언트 컴포넌트였고, 팝업 정보를 {@code useEffect} 안에서
 * 가져왔다. {@code useEffect} 는 브라우저에서만 도는데 서버가 만드는 HTML 은 그 전에 확정되므로,
 * 크롤러가 받아 가는 문서에는 <b>"불러오는 중…" 밖에 없었다.</b> 라이브에서 확인한 사실이다.
 *
 * <p>그래서 색인을 여는 일보다 이것이 먼저다. 내용이 없는 페이지는 색인을 풀어도 담을 것이 없다.
 *
 * <p>고친 방식은 최소한이다 — 화면 코드는 손대지 않고, 서버가 먼저 데이터를 받아 클라이언트
 * 컴포넌트에 넘긴다. App Router 는 {@code 'use client'} 컴포넌트도 서버에서 HTML 로 그리기
 * 때문에, 데이터만 제때 주면 전체 화면이 그대로 HTML 에 실린다. 지도·찜·스탬프·음악 같은
 * 브라우저 기능은 하나도 건드리지 않았다.
 */
type PopupDetailPageProps = {
  params: Promise<{ id: string }>;
  includeEventJsonLd?: boolean;
};

/**
 * 상세 본문을 언어 경로에서도 함께 쓰되, 검색에 노출하지 않는 번역 경로에는 Event 데이터를 넣지 않는다.
 */
export async function PopupDetailPageContent({
  params,
  includeEventJsonLd = true,
}: PopupDetailPageProps) {
  const { id } = await params;
  // 실패하면 null 이 넘어가고, 클라이언트가 예전처럼 스스로 가져온다. 서버가 못 받았다고
  // 페이지를 못 쓰게 만들지 않는다.
  const initial = await fetchPopupForServer(id);
  const canonical = `https://popspot.co.kr/popup/${id}`;
  const eventJsonLd =
    includeEventJsonLd && /^\d+$/.test(id) && shouldIndexDetail(initial)
      ? buildPopupEventJsonLd(initial, canonical, kstToday())
      : null;

  return (
    <>
      <PopupDetailClient id={id} initial={initial} />
      {eventJsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: serializeJsonLd(eventJsonLd) }}
        />
      )}
    </>
  );
}

export default async function PopupDetailPage(props: PopupDetailPageProps) {
  return <PopupDetailPageContent {...props} />;
}
