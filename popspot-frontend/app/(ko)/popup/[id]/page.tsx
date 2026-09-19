import PopupDetailClient from './PopupDetailClient';
import { Breadcrumb, type Crumb } from '@/components/seo/Breadcrumb';
import { classifyRegion, REGIONS } from '@/lib/regions';
import { buildPopupEventJsonLd, serializeJsonLd } from '@/lib/popupEventJsonLd';
import { fetchPopupForServer, kstToday, shouldIndexDetail, type ServerPopup } from './serverData';
import { loadPublicMarkers } from '@/lib/emergencyPopupData';
import { isOpenNow, kstTodayStart } from '@/lib/popupSlices';
import { nearbyWithin, type Nearby } from '@/lib/nearby';
import { nearestStation } from '@/lib/nearestStation';

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
 * 도보 12분 안의 열려 있는 이웃 최대 3곳을 서버에서 계산한다.
 *
 * <p><b>클라이언트가 아니라 여기서 계산하는 이유.</b> 마커 전체 목록은 355KB 다. 그걸 그대로
 * {@code PopupDetailClient} 에 넘기면 상세 페이지마다(=크롤러가 보는 모든 문서에) 그 전체가
 * RSC 페이로드에 실린다. 여기서 최대 3곳만 추려 그 결과만 내려보낸다.
 *
 * <p><b>종료된 팝업을 거른다.</b> {@code /api/map/markers} 는 서버에서 날짜 필터를 하지 않는다
 * (`PopupStoreService.java:196-200`). 걸러내지 않으면 닫힌 곳을 "여기까지 왔으면" 추천에 올리게
 * 되는데, 그건 이 브랜치의 앞선 두 커밋이 막 없앤 것과 같은 결함이다.
 *
 * <p>실패해도 페이지를 막지 않는다 — 좌표가 없거나 {@code loadPublicMarkers} 가 실패하면 빈
 * 배열을 돌려주고, 그러면 블록 자체가 그려지지 않는다({@code PopupDetailClient} 쪽 조건).
 */
async function loadNearbyPopups(popup: ServerPopup | null): Promise<Nearby[]> {
  if (!popup) return [];
  const lat = popup.latitude ? parseFloat(popup.latitude) : NaN;
  const lng = popup.longitude ? parseFloat(popup.longitude) : NaN;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return [];

  try {
    const { markers } = await loadPublicMarkers();
    const today = kstTodayStart();
    const openMarkers = markers.filter((m) => isOpenNow(m.startDate, m.endDate, today));
    return nearbyWithin({ lat, lng }, openMarkers, 12, 3, popup.id);
  } catch {
    return [];
  }
}

/**
 * 주소 아래 「가는 법」 한 줄의 재료 — 가장 가까운 역 + 도보 분.
 *
 * <p><b>클라이언트가 아니라 여기서 계산하는 이유.</b> {@code nearestStation} 은 역 509곳
 * (JSON 파일 기준 39KB)을 통째로 순회한다. {@code PopupDetailClient}(`'use client'`)에서
 * 그 함수를 부르면 이 JSON 이 모든 방문자의 클라이언트 번들에 실린다 — 정작 화면에 쓰는 값은
 * {@code { name, minutes } } 30바이트 남짓인데, 그걸 만들려고 39KB 를 내려보내는 셈이다.
 * {@link loadNearbyPopups} 가 마커 355KB 를 서버에만 두는 것과 같은 이유로, 여기서 계산해
 * 결과값만 내려보낸다.
 */
function loadNearestStation(popup: ServerPopup | null): { name: string; minutes: number } | null {
  if (!popup) return null;
  const lat = popup.latitude ? parseFloat(popup.latitude) : NaN;
  const lng = popup.longitude ? parseFloat(popup.longitude) : NaN;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return nearestStation(lat, lng);
}

/**
 * 상세 본문을 언어 경로에서도 함께 쓰되, 검색에 노출하지 않는 번역 경로에는 Event 데이터를 넣지 않는다.
 */
/**
 * 이 팝업이 속한 자리 — 홈 › 지역 › 팝업명.
 *
 * <p>가운데 칸이 이 작업의 목적이다. 상세에서 랜딩으로 가는 링크가 <b>0개</b>였다(2026-08-30
 * 실측). 검색으로 들어온 사람이 팝업 하나를 보고 나면 "성수에 다른 것도 있나" 로 갈 방법이 없었고,
 * 크롤러에게도 상세가 막다른 골목이었다.
 *
 * <p>지역을 못 알아보는 팝업(주소가 모호하거나 서울 밖)은 <b>이번 달 목록</b>으로 보낸다. 가운데
 * 칸을 비우면 이 페이지는 다시 막다른 골목이 되는데, 어느 팝업이든 "이번 달" 에는 속하므로 그쪽이
 * 늘 참인 길이다.
 */
function detailCrumbs(popup: ServerPopup | null): Crumb[] {
  const home: Crumb = { name: '홈', href: '/' };
  if (!popup) return [home];

  const region = REGIONS.find((r) => r.code === classifyRegion(popup.address));
  const middle: Crumb = region
    ? { name: region.label, href: `/popups/${region.slug}` }
    : { name: '이번 달 팝업', href: '/popups/this-month' };

  return [home, middle, { name: popup.name }];
}

export async function PopupDetailPageContent({
  params,
  includeEventJsonLd = true,
}: PopupDetailPageProps) {
  const { id } = await params;
  // 실패하면 null 이 넘어가고, 클라이언트가 예전처럼 스스로 가져온다. 서버가 못 받았다고
  // 페이지를 못 쓰게 만들지 않는다.
  const initial = await fetchPopupForServer(id);
  const nearby = await loadNearbyPopups(initial);
  const station = loadNearestStation(initial);
  const canonical = `https://popspot.co.kr/popup/${id}`;
  const eventJsonLd =
    includeEventJsonLd && /^\d+$/.test(id) && shouldIndexDetail(initial)
      ? buildPopupEventJsonLd(initial, canonical, kstToday())
      : null;

  return (
    <>
      <Breadcrumb items={detailCrumbs(initial)} />
      <PopupDetailClient id={id} initial={initial} nearby={nearby} station={station} />
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
