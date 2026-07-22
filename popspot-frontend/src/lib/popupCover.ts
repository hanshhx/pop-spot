/** 팝업 대표 이미지의 출처와 URL을 함께 검증한다. */

const PLACEHOLDER_MARKERS = ["photo-1542291026-7eec264c27ff"];
const STOCK_IMAGE_HOSTS = new Set(["images.pexels.com", "images.unsplash.com"]);
const REAL_PHOTO_ORIGINS = new Set(["CRAWLED", "USER"]);

export interface CoverInput {
  id: string | number;
  category?: string | null;
  imageUrl?: string | null;
  /** 백엔드 사진 출처(CRAWLED/USER/PEXELS/PLACEHOLDER). */
  photoOrigin?: string | null;
}

function isHttpImage(url?: string | null): url is string {
  if (!url?.trim()) return false;
  try {
    const parsed = new URL(url.trim());
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function isKnownStockOrPlaceholder(url: string): boolean {
  if (PLACEHOLDER_MARKERS.some((marker) => url.includes(marker))) return true;
  try {
    return STOCK_IMAGE_HOSTS.has(new URL(url).hostname.toLowerCase());
  } catch {
    return true;
  }
}

/**
 * 실제 팝업 사진만 반환한다. Pexels·Unsplash 스톡과 PLACEHOLDER는 사진보다 정보형 UI가 정확하므로 null을 반환한다.
 *
 * photoOrigin이 없는 구버전 응답은 알려진 스톡 호스트와 플레이스홀더만 차단해, 기존 사용자 업로드 사진을 잃지 않는다.
 */
export function popupCoverUrl(popup: CoverInput, _width = 800): string | null {
  if (!isHttpImage(popup.imageUrl)) return null;
  const imageUrl = popup.imageUrl.trim();

  if (popup.photoOrigin) {
    return REAL_PHOTO_ORIGINS.has(popup.photoOrigin.toUpperCase()) ? imageUrl : null;
  }
  return isKnownStockOrPlaceholder(imageUrl) ? null : imageUrl;
}
