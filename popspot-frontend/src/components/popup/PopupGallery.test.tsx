// @vitest-environment jsdom

import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/i18n', () => ({
  useLocale: () => ({
    t: (key: string) =>
      ({ 'detail.galleryTitle': '주최측 제공 자료', 'detail.galleryProvidedBy': '자료 제공' })[
        key
      ] ?? key,
  }),
}));

import { PopupGallery } from './PopupGallery';
import type { GalleryImage } from '@/lib/galleryImages';

/**
 * 화면에 실제로 그려지는지까지 본다. 판정 함수만 맞고 렌더가 틀리면 <b>등록해 놓고 안 보이는</b>
 * 상태가 되는데, 그건 아무 테스트도 안 잡는다.
 */

let container: HTMLDivElement | null = null;

function render(images: GalleryImage[] | null | undefined) {
  container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(<PopupGallery images={images} popupName="제주 로컬브랜드 팝업스토어" />);
  });
  return container;
}

afterEach(() => {
  container?.remove();
  container = null;
});

const image = (imageUrl: string, extra: Partial<GalleryImage> = {}): GalleryImage => ({
  imageUrl,
  ...extra,
});

describe('PopupGallery', () => {
  it('받은 자료를 순서대로 그린다', () => {
    const el = render([image('/partner/jeju-01.webp'), image('/partner/jeju-02.webp')]);

    const srcs = [...el.querySelectorAll('img')].map((img) => img.getAttribute('src'));
    expect(srcs).toEqual(['/partner/jeju-01.webp', '/partner/jeju-02.webp']);
    expect(el.textContent).toContain('주최측 제공 자료');
  });

  /*
   * 오늘 살아 있는 팝업 1,405건이 여기에 해당한다. 빈 제목만 남으면 사이트 전체에
   * "자료 있음" 이라고 써 놓고 아무것도 없는 칸이 생긴다.
   */
  it('자료가 없으면 제목조차 그리지 않는다', () => {
    expect(render([]).textContent).toBe('');
    expect(render(null).textContent).toBe('');
    expect(render(undefined).textContent).toBe('');
  });

  it('CSP 가 막을 주소는 화면에 걸지 않는다', () => {
    const el = render([image('https://cdn.partner.co.kr/a.jpg'), image('/partner/ok.webp')]);

    const srcs = [...el.querySelectorAll('img')].map((img) => img.getAttribute('src'));
    expect(srcs).toEqual(['/partner/ok.webp']);
  });

  it('제공처를 묶음 아래 한 번 적는다', () => {
    const el = render([
      image('/a.webp', { photoCreditName: '제주창조경제혁신센터' }),
      image('/b.webp', { photoCreditName: '제주창조경제혁신센터' }),
    ]);

    expect(el.textContent).toContain('자료 제공 · 제주창조경제혁신센터');
    expect(el.textContent?.match(/제주창조경제혁신센터/g)).toHaveLength(1);
  });

  /* 화면에 안 보이는 사람에게 이 그림이 무엇인지 알려 주는 유일한 통로다. */
  it('대체 텍스트에 팝업 이름과 몇 번째인지가 들어간다', () => {
    const el = render([image('/a.webp'), image('/b.webp')]);

    const alts = [...el.querySelectorAll('img')].map((img) => img.getAttribute('alt'));
    expect(alts[0]).toBe('제주 로컬브랜드 팝업스토어 — 주최측 제공 자료 1');
    expect(alts[1]).toBe('제주 로컬브랜드 팝업스토어 — 주최측 제공 자료 2');
  });

  /* 카드뉴스는 글이 얹힌 그림이다. object-cover 로 맞추면 읽어야 할 글이 잘린다. */
  it('비율을 자르지 않는다 — 카드뉴스의 글이 잘리면 안 된다', () => {
    const el = render([image('/a.webp')]);
    const img = el.querySelector('img');

    expect(img?.className).toContain('h-auto');
    expect(img?.className).not.toContain('object-cover');
  });

  it('느리게 불러온다 — 여덟 장이 첫 화면을 막지 않는다', () => {
    const el = render([image('/a.webp')]);

    expect(el.querySelector('img')?.getAttribute('loading')).toBe('lazy');
  });
});
