import { isIndexableDetail } from '@/lib/indexableDetail';

export type PopupEventInput = {
  name: string;
  address: string;
  openDate?: string;
  closeDate?: string;
  imageUrl?: string;
  photoOrigin?: string;
};

/** 실제 팝업 사진으로 출처가 명시된 URL만 검색·공유 메타데이터에 사용한다. */
export function verifiedPopupImage(popup: {
  imageUrl?: string | null;
  photoOrigin?: string | null;
}): string | null {
  const origin = popup.photoOrigin?.trim().toUpperCase();
  if (origin !== 'CRAWLED' && origin !== 'USER') return null;
  try {
    const url = new URL(popup.imageUrl?.trim() ?? '');
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.toString() : null;
  } catch {
    return null;
  }
}

function validYmd(value?: string): value is string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
  );
}

/**
 * 검색에 공개해도 되는 팝업 하나만 Event 구조화 데이터로 바꾼다.
 *
 * 목록 페이지에서 여러 Event를 선언하지 않는다. Google은 Event마다 고유한 상세 URL과 그 행사
 * 하나에 집중한 페이지를 요구한다. 날짜·장소가 검증되지 않았거나 약관상 색인 대상이 아니면 null을
 * 반환해, 경고를 없애려고 값을 추측하는 길도 막는다.
 */
export function buildPopupEventJsonLd(
  popup: PopupEventInput | null,
  canonical: string,
  today: string,
): Record<string, unknown> | null {
  if (!popup || !validYmd(popup.openDate) || !validYmd(popup.closeDate)) return null;
  if (
    !isIndexableDetail(
      {
        name: popup.name,
        location: popup.address,
        startDate: popup.openDate,
        endDate: popup.closeDate,
      },
      today,
    )
  ) {
    return null;
  }

  const name = popup.name.trim();
  const address = popup.address.trim();
  const image = verifiedPopupImage(popup);
  return {
    '@context': 'https://schema.org',
    '@type': 'Event',
    name,
    startDate: popup.openDate,
    endDate: popup.closeDate,
    eventStatus: 'https://schema.org/EventScheduled',
    eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
    url: canonical,
    ...(image ? { image: [image] } : {}),
    location: {
      '@type': 'Place',
      name: address,
      address: {
        '@type': 'PostalAddress',
        name: address,
        addressCountry: 'KR',
      },
    },
    description: `${name}. 운영 기간 ${popup.openDate}~${popup.closeDate}. 장소 ${address}.`,
  };
}

/** 외부 수집 이름이 script 블록을 닫지 못하게 '<'를 이스케이프한다. */
export function serializeJsonLd(value: unknown): string {
  return JSON.stringify(value).replace(/</g, '\\u003c');
}
