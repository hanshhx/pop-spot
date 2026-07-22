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
  photoSourceUrl?: string | null;
  photoCreditName?: string | null;
  photoCreditUrl?: string | null;
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

function hasHost(url: string, host: string): boolean {
  try {
    return new URL(url).hostname.toLowerCase() === host;
  } catch {
    return false;
  }
}

/** 명시적 출처 또는 Pexels CDN 주소로 연출 이미지 여부를 판정한다. */
export function isPexelsPhoto(popup: CoverInput): boolean {
  if (!isHttpImage(popup.imageUrl)) return false;
  if (popup.photoOrigin) {
    return popup.photoOrigin.toUpperCase() === "PEXELS" && hasHost(popup.imageUrl, "images.pexels.com");
  }
  return hasHost(popup.imageUrl, "images.pexels.com");
}

/**
 * 실제 팝업 사진과 출처가 확인된 Pexels 연출 이미지만 반환한다. Pexels 사진은 화면에서 반드시 연출 이미지 고지와 출처를 함께 표시한다.
 *
 * photoOrigin이 없는 구버전 응답은 알려진 스톡 호스트와 플레이스홀더만 차단해, 기존 사용자 업로드 사진을 잃지 않는다.
 */
export function popupCoverUrl(popup: CoverInput, _width = 800): string | null {
  if (!isHttpImage(popup.imageUrl)) return null;
  const imageUrl = popup.imageUrl.trim();

  if (popup.photoOrigin) {
    const origin = popup.photoOrigin.toUpperCase();
    if (REAL_PHOTO_ORIGINS.has(origin)) return imageUrl;
    return origin === "PEXELS" && hasHost(imageUrl, "images.pexels.com") ? imageUrl : null;
  }
  if (hasHost(imageUrl, "images.pexels.com")) return imageUrl;
  return isKnownStockOrPlaceholder(imageUrl) ? null : imageUrl;
}
