/**
 * 상세 '제공 자료' 갤러리에 <b>실제로 그릴 수 있는</b> 사진만 남긴다.
 *
 * <p><b>왜 프론트에도 판정이 필요한가.</b> 백엔드가 보냈다고 그려지는 것이 아니다. 우리 CSP 의
 * {@code img-src} 는 허용목록이라, 목록에 없는 도메인의 이미지는 <b>브라우저가 요청 자체를
 * 막는다.</b> 그러면 화면에는 깨진 칸만 남는다 — 아무것도 안 보이는 것보다 나쁘다. "고장 난
 * 사이트" 로 읽히기 때문이다.
 *
 * <p><b>왜 우리가 서빙하는 것만 받는가.</b> 남의 서버 이미지를 주소로만 걸어 두는 것(핫링크)은
 * 두 가지로 깨진다. 저쪽이 파일을 옮기면 우리 화면이 조용히 비고, 저쪽 대역폭을 우리가 쓰는
 * 셈이라 권리자가 원하지 않을 수 있다. 자료를 받아 우리 쪽에 두면 둘 다 사라진다.
 */

export interface GalleryImage {
  imageUrl: string;
  photoOrigin?: string | null;
  photoCreditName?: string | null;
  photoCreditUrl?: string | null;
  photoSourceUrl?: string | null;
}

/**
 * 한 팝업에 그릴 수 있는 최대 장수.
 *
 * <p>{@code photoOrigin='USER'} 는 관리자뿐 아니라 사용자 업로드 경로로도 들어올 수 있다. 상한이
 * 없으면 한 팝업에 수백 장이 붙어 상세가 열리지 않는다. 넘치는 분량은 <b>조용히 버리지 않고</b>
 * {@link countDropped} 로 셀 수 있게 남긴다 — 등록해 놓고 안 보이는 이유를 알 수 있어야 한다.
 */
export const GALLERY_MAX = 24;

/**
 * 이 주소를 우리가 그릴 수 있는가.
 *
 * @param apiOrigin 백엔드 오리진({@code NEXT_PUBLIC_API_URL}). CSP 가 이미 허용하는 곳이라
 *     백엔드가 직접 서빙하는 이미지도 받는다. 값이 없으면 same-origin 경로만 남는다.
 */
export function isRenderableGalleryUrl(
  url: string | null | undefined,
  apiOrigin?: string | null,
): boolean {
  const value = url?.trim();
  if (!value) return false;

  /* '//host/x' 는 프로토콜 생략 형태라 남의 도메인이다 — '/x' 와 헷갈리기 쉬워 먼저 막는다. */
  if (value.startsWith('//')) return false;

  /* '/partner/a.webp' — 우리가 public/ 에서 서빙한다. CSP 의 'self'. */
  if (value.startsWith('/')) return true;

  if (!apiOrigin?.trim()) return false;
  try {
    /*
     * 오리진 비교는 스킴까지 본다 — 'http://x' 와 'https://x' 는 서로 다른 오리진이다. 그래서
     * https 를 따로 강제하지 않는다. 강제하면 백엔드가 http 인 로컬 개발에서만 갤러리가 사라진다
     * — CSP 의 img-src 는 그때 http://localhost 를 허용하는데도.
     */
    return new URL(value).origin === new URL(apiOrigin.trim()).origin;
  } catch {
    return false;
  }
}

/** 그릴 수 있는 것만, 받은 순서 그대로, 상한까지. */
export function renderableGalleryImages(
  images: GalleryImage[] | null | undefined,
  apiOrigin?: string | null,
): GalleryImage[] {
  if (!Array.isArray(images)) return [];
  return images
    .filter((image) => isRenderableGalleryUrl(image?.imageUrl, apiOrigin))
    .slice(0, GALLERY_MAX);
}

/** 상한 때문에 못 그린 장수. 0 이면 전부 나갔다. */
export function countDropped(
  images: GalleryImage[] | null | undefined,
  apiOrigin?: string | null,
): number {
  if (!Array.isArray(images)) return 0;
  const renderable = images.filter((image) =>
    isRenderableGalleryUrl(image?.imageUrl, apiOrigin),
  ).length;
  return Math.max(0, renderable - GALLERY_MAX);
}

/**
 * 갤러리 아래 한 줄로 보여줄 제공처 이름들 — 중복 없이, 나온 순서대로.
 *
 * <p>출처 표시는 <b>사진마다</b>가 아니라 <b>묶음 아래 한 번</b>이 낫다. 카드뉴스 여덟 장이 전부
 * 같은 곳에서 왔는데 여덟 번 적으면 읽히지 않는다. 저작권법 제37조는 "출처를 명시" 하라고 할 뿐
 * 매 장마다 반복하라고 하지 않는다.
 */
export function creditNames(images: GalleryImage[] | null | undefined): string[] {
  if (!Array.isArray(images)) return [];
  const seen = new Set<string>();
  const names: string[] = [];
  for (const image of images) {
    const name = image?.photoCreditName?.trim();
    if (!name || seen.has(name)) continue;
    seen.add(name);
    names.push(name);
  }
  return names;
}
