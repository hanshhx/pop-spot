import { judgeIndexable } from '@/lib/indexableDetail';
import {
  EMERGENCY_SNAPSHOT_META,
  findEmergencyMarker,
  isEmergencyDuplicate,
} from '@/lib/emergencyPopupData';

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
  emergencySnapshot?: boolean;
  emergencyCapturedAt?: string;
};

function emergencyPopup(id: string): ServerPopup | null {
  const marker = findEmergencyMarker(id);
  if (!marker) return null;
  return {
    id: marker.id,
    name: marker.name,
    nameEn: marker.nameEn ?? undefined,
    nameJa: marker.nameJa ?? undefined,
    content: '',
    address: marker.location ?? '',
    locationEn: marker.locationEn ?? undefined,
    locationJa: marker.locationJa ?? undefined,
    category: marker.category ?? 'ETC',
    openDate: marker.startDate ?? undefined,
    closeDate: marker.endDate ?? undefined,
    latitude: marker.latitude ?? undefined,
    longitude: marker.longitude ?? undefined,
    reviewStatus: isEmergencyDuplicate(marker.id) ? 'DUPLICATE' : undefined,
    emergencySnapshot: true,
    emergencyCapturedAt: EMERGENCY_SNAPSHOT_META.capturedAt,
  };
}

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
  if (!/^\d+$/.test(id)) return null;
  if (!apiBase || !/^https?:\/\//.test(apiBase)) return emergencyPopup(id);

  try {
    const res = await fetch(`${apiBase}/api/popups/${id}`, { next: { revalidate: 300 } });
    // 정상 서버의 삭제·비공개 결정을 스냅샷이 되살리면 안 된다.
    if (res.status === 404 || res.status === 410) return null;
    if (!res.ok) return res.status >= 500 ? emergencyPopup(id) : null;
    const body = await res.json();
    const d = body?.data ?? body;
    if (!d || !d.name) return emergencyPopup(id);

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
    return emergencyPopup(id);
  }
}

/**
 * 개정 약관 §14-4 의 <b>시행일</b>. 이 날부터 자격을 갖춘 상세가 색인된다.
 *
 * <p>{@code app/terms/page.tsx} 헤더에 적힌 시행일과 <b>같아야 한다.</b> 약관은 2026-08-04 에
 * 공지했고, 제15조 제1항이 요구하는 7일이 지난 2026-08-11 에 시행된다.
 *
 * <p><b>사람이 스위치를 켜지 않는다.</b> 손으로 켜는 방식이면 두 가지가 어긋난다 — 잊어서 안
 * 켜지거나, 공지 기간이 끝나기 전에 켜진다. 후자는 <b>공표한 것과 다르게 동작하는</b> 것이라
 * 약관 위반이다. 날짜를 코드에 두면 둘 다 일어나지 않는다.
 *
 * <p>되돌리려면 이 날짜를 먼 미래로 미루면 된다. 배포 한 번으로 전체가 다시 noindex 가 된다.
 */
export const TERMS_EFFECTIVE_DATE = '2026-08-11';

/**
 * 이 팝업을 검색에 열어도 되는가.
 *
 * <p>두 조건을 모두 만족해야 한다 — 약관 시행일이 지났고, 그 팝업이 자격을 갖췄을 것.
 * 자격 판정은 실측으로 1,002건 중 <b>448건(44.7%)</b> 이 통과한다.
 *
 * <p>약관을 코드보다 먼저 고치지 않은 이유: 그러면 <b>지키지 못할 문장을 공표</b>하는 것이 된다.
 * 코드가 그 상태가 된 뒤에 약관이 따라갔고, 시행일까지는 코드가 옛 약관대로 동작한다.
 */
export function shouldIndexDetail(popup: ServerPopup | null): boolean {
  return shouldIndexDetailOn(popup, kstToday());
}

/** 날짜를 받는 형태 — 시행일 경계를 테스트로 못박기 위해 나눠 뒀다. */
export function shouldIndexDetailOn(popup: ServerPopup | null, today: string): boolean {
  if (!popup) return false;
  if (popup.reviewStatus === 'DUPLICATE') return false;
  if (today < TERMS_EFFECTIVE_DATE) return false;
  return judgeIndexable(
    {
      name: popup.name,
      location: popup.address,
      startDate: popup.openDate,
      endDate: popup.closeDate,
    },
    today,
  ).ok;
}
