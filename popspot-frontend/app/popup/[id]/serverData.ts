import { judgeIndexable } from '@/lib/indexableDetail';

/**
 * 상세 페이지가 서버에서 쓰는 것 — 팝업 하나 가져오기와 색인 자격 판정.
 *
 * <p>{@code page.tsx}(본문)와 {@code layout.tsx}(제목·공유카드)가 같은 함수를 쓴다. 두 곳이 서로
 * 다른 경로로 데이터를 가져오면 언젠가 한쪽만 고쳐져서, 공유 카드에 적힌 것과 페이지에 보이는 것이
 * 달라진다.
 */

/** 화면이 쓰는 모양. PopupDetailClient 의 {@code PopupDetail} 과 같은 필드를 채운다. */
export type ServerPopup = {
  id: number;
  name: string;
  nameEn?: string;
  nameJa?: string;
  content: string;
  address: string;
  locationEn?: string;
  locationJa?: string;
  category: string;
  status?: string;
  openDate?: string;
  closeDate?: string;
  latitude?: string;
  longitude?: string;
  imageUrl?: string;
  photoOrigin?: string;
  photoSourceUrl?: string;
  photoCreditName?: string;
  photoCreditUrl?: string;
  sourceType?: string;
  sourceUrl?: string;
  sourceName?: string;
  reviewStatus?: string;
  officialUrl?: string;
  reservationUrl?: string;
};

/** 서버 시각은 UTC 다. 날짜 판정은 반드시 KST 로 해야 하루가 어긋나지 않는다. */
export function kstToday(): string {
  const kst = new Date(Date.now() + 9 * 60 * 60 * 1000);
  return kst.toISOString().slice(0, 10);
}

/**
 * 팝업 하나.
 *
 * <p>{@code revalidate: 300} — 5분. 마감 임박 팝업의 D-day 가 하루 넘게 굳으면 안 되고, 그렇다고
 * 매 요청마다 백엔드를 두드릴 이유도 없다. 크롤러가 몰려와도 5분에 한 번만 나간다.
 *
 * <p>실패하면 null. 메타데이터나 본문 하나 때문에 페이지를 500 으로 만들지 않는다.
 */
export async function fetchPopupForServer(id: string): Promise<ServerPopup | null> {
  const apiBase = process.env.NEXT_PUBLIC_API_URL;
  if (!apiBase || !/^https?:\/\//.test(apiBase) || !/^\d+$/.test(id)) return null;

  try {
    const res = await fetch(`${apiBase}/api/popups/${id}`, { next: { revalidate: 300 } });
    if (!res.ok) return null;
    const body = await res.json();
    const d = body?.data ?? body;
    if (!d || !d.name) return null;

    return {
      id: Number(d.popupId ?? d.id),
      name: d.name,
      nameEn: d.nameEn ?? undefined,
      nameJa: d.nameJa ?? undefined,
      content: d.content ?? '',
      address: d.location ?? d.address ?? '',
      locationEn: d.locationEn ?? undefined,
      locationJa: d.locationJa ?? undefined,
      category: d.category ?? 'ETC',
      status: d.status ?? undefined,
      openDate: d.startDate ?? d.openDate ?? undefined,
      closeDate: d.endDate ?? d.closeDate ?? undefined,
      latitude: d.latitude ?? undefined,
      longitude: d.longitude ?? undefined,
      imageUrl: d.imageUrl ?? d.image ?? undefined,
      photoOrigin: d.photoOrigin ?? undefined,
      photoSourceUrl: d.photoSourceUrl ?? undefined,
      photoCreditName: d.photoCreditName ?? undefined,
      photoCreditUrl: d.photoCreditUrl ?? undefined,
      sourceType: d.sourceType ?? undefined,
      sourceUrl: d.sourceUrl ?? undefined,
      sourceName: d.sourceName ?? undefined,
      reviewStatus: d.reviewStatus ?? undefined,
      officialUrl: d.officialUrl ?? undefined,
      reservationUrl: d.reservationUrl ?? undefined,
    };
  } catch {
    return null;
  }
}

/**
 * 이 팝업을 검색에 열어도 되는가.
 *
 * <p><b>지금은 항상 false 다.</b> 이용약관 §14-4 가 "자동수집된 개별 팝업스토어 상세 페이지는
 * 사이트맵에 포함하지 않으며 {@code noindex} 로 차단합니다" 라고 공표해 뒀기 때문이다. 코드가
 * 준비돼도 그 문장이 살아 있는 한 열 수 없다 — 약관 개정과 7일 사전 공지(§15-1)가 먼저다.
 *
 * <p>순서를 이렇게 두는 이유: 약관을 먼저 고치면 <b>지키지 못할 문장을 공표</b>하는 것이 된다.
 * 코드가 그 상태가 된 뒤에 약관을 따라가야 한다.
 *
 * <p>약관이 바뀌면 {@code TERMS_ALLOW_DETAIL_INDEX} 를 true 로 바꾸는 것만으로 열린다. 자격
 * 판정은 이미 돌고 있고, 실측으로 1,002건 중 <b>448건(44.7%)</b> 이 통과한다.
 */
const TERMS_ALLOW_DETAIL_INDEX = false;

export function shouldIndexDetail(popup: ServerPopup | null): boolean {
  if (!TERMS_ALLOW_DETAIL_INDEX || !popup) return false;
  return judgeIndexable(
    {
      name: popup.name,
      location: popup.address,
      startDate: popup.openDate,
      endDate: popup.closeDate,
    },
    kstToday(),
  ).ok;
}
