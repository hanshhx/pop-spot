import { describe, expect, it } from 'vitest';

import {
  countDropped,
  creditNames,
  GALLERY_MAX,
  isRenderableGalleryUrl,
  renderableGalleryImages,
  type GalleryImage,
} from './galleryImages';

/**
 * 이 판정이 느슨하면 CSP 가 막는 주소를 화면에 걸어 <b>깨진 칸</b>이 남는다 — 아무것도 안 보이는
 * 것보다 나쁘다. 빡빡하면 주최측이 보낸 자료가 등록해 놓고도 안 보인다.
 */

const API = 'https://backend.example.ts.net';

const image = (imageUrl: string, extra: Partial<GalleryImage> = {}): GalleryImage => ({
  imageUrl,
  ...extra,
});

describe('isRenderableGalleryUrl', () => {
  it('우리가 서빙하는 경로는 그린다', () => {
    expect(isRenderableGalleryUrl('/partner/jeju-01.webp', API)).toBe(true);
    expect(isRenderableGalleryUrl('  /partner/jeju-01.webp  ', API)).toBe(true);
  });

  it('백엔드 오리진의 https 이미지는 그린다 — CSP 가 이미 허용한다', () => {
    expect(isRenderableGalleryUrl(`${API}/files/a.jpg`, API)).toBe(true);
  });

  /* CSP img-src 허용목록에 없는 곳. 걸어 두면 브라우저가 요청을 막아 깨진 칸이 된다. */
  it('남의 도메인은 막는다 — CSP 가 어차피 차단한다', () => {
    expect(isRenderableGalleryUrl('https://cdn.partner.co.kr/a.jpg', API)).toBe(false);
    expect(isRenderableGalleryUrl('https://drive.google.com/a.jpg', API)).toBe(false);
  });

  /*
   * '//host/x' 는 프로토콜 생략 형태라 남의 도메인인데 '/x' 와 한 글자 차이다.
   * 앞 글자만 보는 구현은 여기서 뚫린다.
   */
  it('프로토콜 생략(//host)은 우리 경로가 아니다', () => {
    expect(isRenderableGalleryUrl('//evil.example.com/a.jpg', API)).toBe(false);
  });

  it('스킴이 다르면 다른 오리진이다 — data · javascript 도 막는다', () => {
    expect(isRenderableGalleryUrl(`http://backend.example.ts.net/a.jpg`, API)).toBe(false);
    expect(isRenderableGalleryUrl('data:image/png;base64,AAAA', API)).toBe(false);
    expect(isRenderableGalleryUrl('javascript:alert(1)', API)).toBe(false);
  });

  /*
   * 로컬 개발에서 백엔드는 http 다. 오리진 비교가 이미 스킴을 보므로 https 를 따로 강제할
   * 이유가 없는데, 강제하면 CSP 는 허용하는 이미지를 우리 판정만 막아 개발 환경에서만 갤러리가
   * 통째로 사라진다. 이 검사가 그 회귀를 막는다.
   */
  it('백엔드가 http 인 로컬 개발에서도 그린다', () => {
    const dev = 'http://localhost:8080';
    expect(isRenderableGalleryUrl(`${dev}/files/a.jpg`, dev)).toBe(true);
  });

  it('빈 값은 막는다', () => {
    expect(isRenderableGalleryUrl('', API)).toBe(false);
    expect(isRenderableGalleryUrl('   ', API)).toBe(false);
    expect(isRenderableGalleryUrl(null, API)).toBe(false);
    expect(isRenderableGalleryUrl(undefined, API)).toBe(false);
  });

  it('백엔드 오리진을 몰라도 우리 경로는 살아남는다', () => {
    expect(isRenderableGalleryUrl('/partner/a.webp', undefined)).toBe(true);
    expect(isRenderableGalleryUrl(`${API}/files/a.jpg`, undefined)).toBe(false);
  });
});

describe('renderableGalleryImages', () => {
  it('순서를 지키며 그릴 수 없는 것만 뺀다', () => {
    const result = renderableGalleryImages(
      [image('/a.webp'), image('https://cdn.other/x.jpg'), image('/b.webp')],
      API,
    );

    expect(result.map((i) => i.imageUrl)).toEqual(['/a.webp', '/b.webp']);
  });

  it('상한까지만 그린다', () => {
    const many = Array.from({ length: GALLERY_MAX + 5 }, (_, i) => image(`/p${i}.webp`));

    expect(renderableGalleryImages(many, API)).toHaveLength(GALLERY_MAX);
    expect(countDropped(many, API)).toBe(5);
  });

  it('상한 안이면 버린 것이 없다', () => {
    expect(countDropped([image('/a.webp')], API)).toBe(0);
  });

  it('목록이 없거나 이상해도 터지지 않는다', () => {
    expect(renderableGalleryImages(null, API)).toEqual([]);
    expect(renderableGalleryImages(undefined, API)).toEqual([]);
    expect(renderableGalleryImages([] as GalleryImage[], API)).toEqual([]);
    expect(countDropped(null, API)).toBe(0);
  });
});

describe('creditNames', () => {
  it('같은 제공처는 한 번만 적는다', () => {
    const names = creditNames([
      image('/a.webp', { photoCreditName: '제주창조경제혁신센터' }),
      image('/b.webp', { photoCreditName: '제주창조경제혁신센터' }),
      image('/c.webp', { photoCreditName: '플라이코' }),
    ]);

    expect(names).toEqual(['제주창조경제혁신센터', '플라이코']);
  });

  it('이름이 없으면 아무것도 적지 않는다', () => {
    expect(creditNames([image('/a.webp'), image('/b.webp', { photoCreditName: '  ' })])).toEqual(
      [],
    );
    expect(creditNames(null)).toEqual([]);
  });
});
