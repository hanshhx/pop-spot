// @vitest-environment jsdom

import { StrictMode, act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/i18n', () => ({
  useLocale: () => ({
    t: (key: string) =>
      ({
        'detail.galleryTitle': '주최측 제공 자료',
        'detail.galleryProvidedBy': '자료 제공',
        'gallery.prev': '이전 자료',
        'gallery.next': '다음 자료',
        'gallery.zoom': '크게 보기',
        'common.close': '닫기',
      })[key] ?? key,
  }),
}));

import { PopupGallery } from './PopupGallery';
import type { GalleryImage } from '@/lib/galleryImages';

/**
 * 화면에 실제로 그려지는지까지 본다. 판정 함수만 맞고 렌더가 틀리면 <b>등록해 놓고 안 보이는</b>
 * 상태가 되는데, 그건 아무 테스트도 안 잡는다.
 */

/* jsdom 에는 요소 스크롤이 없다. 없으면 화살표를 누르는 순간 터진다. */
beforeAll(() => {
  Element.prototype.scrollTo = Element.prototype.scrollTo ?? function stub() {};
});

let container: HTMLDivElement | null = null;

function render(images: GalleryImage[] | null | undefined) {
  container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    /*
     * StrictMode 로 감싼다. React 가 상태 갱신 함수를 일부러 두 번 불러 순수한지 검사하는데,
     * Next 개발 서버도 같은 모드로 돈다. 감싸지 않으면 <b>갱신 함수 안에 부수효과를 넣은 실수</b>가
     * 검사에서는 안 보이고 개발 화면에서만 두 칸씩 넘어간다 — 실제로 그렇게 겪었다.
     */
    root.render(
      <StrictMode>
        <PopupGallery images={images} popupName="2026 제주 로컬브랜드 팝업스토어" />
      </StrictMode>,
    );
  });
  return container;
}

afterEach(() => {
  container?.remove();
  container = null;
  document.body.style.overflow = '';
});

const image = (imageUrl: string, extra: Partial<GalleryImage> = {}): GalleryImage => ({
  imageUrl,
  ...extra,
});

const eight = Array.from({ length: 8 }, (_, i) => image(`/partner/jeju-2026/0${i + 1}.webp`));

/* 그림도 버튼이라(눌러서 키운다) 순번으로 고르면 엉뚱한 것을 누른다. 이름으로 고른다. */
const byLabel = (el: HTMLElement, label: string) =>
  [...el.querySelectorAll('button')].filter((b) => b.getAttribute('aria-label')?.startsWith(label));

const press = (el: HTMLElement, label: string, nth = 0) => {
  act(() => {
    byLabel(el, label)[nth].dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
};

describe('PopupGallery', () => {
  it('받은 자료를 순서대로 그린다', () => {
    const el = render(eight);

    expect([...el.querySelectorAll('img')].map((i) => i.getAttribute('src'))).toEqual(
      eight.map((i) => i.imageUrl),
    );
  });

  /*
   * 제목 줄은 화면에서 뺐다. 눈으로 못 보는 사람에게는 이 블록이 무엇인지 알 길이 이름표뿐이라,
   * 같이 지워지지 않았는지 확인한다.
   */
  it('제목 줄은 없지만 이름표는 남는다', () => {
    const el = render(eight);

    expect(el.querySelector('h2')).toBeNull();
    expect(el.querySelector('section')?.getAttribute('aria-label')).toBe('주최측 제공 자료');
  });

  /*
   * 오늘 살아 있는 팝업 1,405건이 여기에 해당한다. 빈 껍데기가 남으면 사이트 전체에
   * "자료 있음" 이라고 써 놓고 아무것도 없는 칸이 생긴다.
   */
  it('자료가 없으면 아무것도 그리지 않는다', () => {
    expect(render([]).querySelector('section')).toBeNull();
    expect(render(null).querySelector('section')).toBeNull();
    expect(render(undefined).querySelector('section')).toBeNull();
  });

  it('CSP 가 막을 주소는 화면에 걸지 않는다', () => {
    const el = render([image('https://cdn.partner.co.kr/a.jpg'), image('/partner/ok.webp')]);

    expect([...el.querySelectorAll('img')].map((i) => i.getAttribute('src'))).toEqual([
      '/partner/ok.webp',
    ]);
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
    const alts = [...render(eight).querySelectorAll('img')].map((i) => i.getAttribute('alt'));

    expect(alts[0]).toBe('2026 제주 로컬브랜드 팝업스토어 — 주최측 제공 자료 1');
    expect(alts[7]).toBe('2026 제주 로컬브랜드 팝업스토어 — 주최측 제공 자료 8');
  });

  /*
   * 카드뉴스는 글이 얹힌 그림이다. object-cover 로 맞추면 읽어야 할 글이 잘린다.
   * contain 이면 어떤 비율이 와도 한 조각도 안 잘린다.
   */
  it('한 조각도 자르지 않는다', () => {
    const img = render(eight).querySelector('img');

    expect(img?.className).toContain('object-contain');
    expect(img?.className).not.toContain('object-cover');
  });

  /* 첫 장은 바로 보이는 자리다. 미루면 빈 칸을 먼저 보게 된다. */
  it('첫 장은 바로 부르고 나머지는 미룬다', () => {
    const loading = [...render(eight).querySelectorAll('img')].map((i) =>
      i.getAttribute('loading'),
    );

    expect(loading[0]).toBe('eager');
    expect(loading.slice(1)).toEqual(Array(7).fill('lazy'));
  });
});

describe('넘기기', () => {
  it('여러 장이면 앞뒤 화살표가 있다', () => {
    const el = render(eight);

    expect(byLabel(el, '이전 자료')).toHaveLength(1);
    expect(byLabel(el, '다음 자료')).toHaveLength(1);
  });

  /* 한 장뿐인데 화살표가 있으면 눌러도 아무 일이 없다 — 고장 난 것처럼 보인다. */
  it('한 장뿐이면 화살표를 안 그린다', () => {
    const el = render([image('/only.webp')]);

    expect(byLabel(el, '이전 자료')).toHaveLength(0);
    expect(byLabel(el, '다음 자료')).toHaveLength(0);
    expect(el.textContent).not.toContain('1 / 1');
  });

  /* 첫 장에서 '이전' 은 갈 곳이 없다. 눌리면 아무 일 없는 버튼이 된다. */
  it('첫 장에서는 이전이 막혀 있다', () => {
    const el = render(eight);

    expect(byLabel(el, '이전 자료')[0].disabled).toBe(true);
    expect(byLabel(el, '다음 자료')[0].disabled).toBe(false);
  });

  /* 끝이 어디인지 모르면 계속 넘겨 봐야 한다. */
  it('몇 장 중 몇 번째인지 알려 준다', () => {
    expect(render(eight).textContent).toContain('1 / 8');
  });

  it('다음을 누를 때마다 한 장씩 넘어간다', () => {
    const el = render(eight);

    press(el, '다음 자료');
    expect(el.textContent).toContain('2 / 8');
    press(el, '다음 자료');
    expect(el.textContent).toContain('3 / 8');
    press(el, '다음 자료');
    expect(el.textContent).toContain('4 / 8');
  });

  it('이전을 누르면 되돌아간다', () => {
    const el = render(eight);

    press(el, '다음 자료');
    press(el, '다음 자료');
    press(el, '이전 자료');

    expect(el.textContent).toContain('2 / 8');
  });

  /**
   * 스크롤이 실제로 따라오는 환경을 흉내 낸다. 갱신 함수 안에 스크롤 명령을 넣으면 React 의 이중
   * 호출이 두 번째에 이미 옮겨진 위치를 읽어 <b>한 번 눌러도 두 칸</b> 간다. 여기서 잡힌다.
   */
  function withScroll(el: HTMLElement, startAt = 0) {
    const track = el.querySelector('.overflow-x-auto') as HTMLElement;
    let pos = startAt;
    Object.defineProperty(track, 'clientWidth', { value: 400, configurable: true });
    Object.defineProperty(track, 'scrollLeft', {
      get: () => pos,
      set: (v: number) => {
        pos = v;
      },
      configurable: true,
    });
    track.scrollTo = ((options: ScrollToOptions) => {
      pos = options.left ?? pos;
    }) as typeof track.scrollTo;
    return () => pos;
  }

  it('한 번 누르면 정확히 한 칸만 간다', () => {
    const el = render(eight);
    const at = withScroll(el);

    press(el, '다음 자료');

    expect(at()).toBe(400);
    expect(el.textContent).toContain('2 / 8');
  });

  /*
   * 손가락으로 쓸어 넘겼는데 scroll 이벤트가 아직 안 온 상태. 상태(0)를 믿고 계산하면 3번 장을
   * 보는 사람이 다음을 눌렀을 때 2번으로 <b>되돌아간다.</b> 실제 위치를 읽으면 그런 일이 없다.
   */
  it('쓸어 넘긴 뒤 눌러도 되돌아가지 않는다', () => {
    const el = render(eight);
    withScroll(el, 800);

    press(el, '다음 자료');

    expect(el.textContent).toContain('4 / 8');
  });

  /* 끝에서 더 눌러도 넘어가지 않는다. 넘어가면 빈 칸이 보인다. */
  it('마지막을 넘어가지 않는다', () => {
    const el = render(eight);

    for (let i = 0; i < 12; i++) press(el, '다음 자료');

    expect(el.textContent).toContain('8 / 8');
    expect(byLabel(el, '다음 자료')[0].disabled).toBe(true);
    expect(byLabel(el, '이전 자료')[0].disabled).toBe(false);
  });
});

describe('크게 보기', () => {
  const zoomed = (el: HTMLElement) => el.querySelector('[role="dialog"]');

  it('그림을 누르면 화면 가득 열린다', () => {
    const el = render(eight);
    expect(zoomed(el)).toBeNull();

    press(el, '주최측 제공 자료 3');

    expect(zoomed(el)).not.toBeNull();
    expect(zoomed(el)?.querySelector('img')?.getAttribute('src')).toBe(
      '/partner/jeju-2026/03.webp',
    );
  });

  /* 키운 화면에서도 넘길 수 있어야 한다. 못 넘기면 닫고 다시 눌러야 한다. */
  it('키운 채로 앞뒤로 넘긴다', () => {
    const el = render(eight);
    press(el, '주최측 제공 자료 3');

    press(el, '다음 자료', 1);
    expect(zoomed(el)?.querySelector('img')?.getAttribute('src')).toBe(
      '/partner/jeju-2026/04.webp',
    );

    press(el, '이전 자료', 1);
    press(el, '이전 자료', 1);
    expect(zoomed(el)?.querySelector('img')?.getAttribute('src')).toBe(
      '/partner/jeju-2026/02.webp',
    );
  });

  it('첫 장·마지막 장에서는 그쪽 화살표가 막힌다', () => {
    const el = render(eight);
    press(el, '주최측 제공 자료 1');

    expect(byLabel(el, '이전 자료')[1].disabled).toBe(true);

    for (let i = 0; i < 10; i++) press(el, '다음 자료', 1);

    expect(byLabel(el, '다음 자료')[1].disabled).toBe(true);
  });

  it('닫기를 누르면 닫힌다', () => {
    const el = render(eight);
    press(el, '주최측 제공 자료 3');

    press(el, '닫기');

    expect(zoomed(el)).toBeNull();
  });

  /* 키워서 넘긴 것이 헛일이 되면 안 된다 — 닫으면 그 장이 아래에도 보여야 한다. */
  it('닫으면 갤러리가 보고 있던 장에 맞춰진다', () => {
    const el = render(eight);
    press(el, '주최측 제공 자료 1');
    press(el, '다음 자료', 1);
    press(el, '다음 자료', 1);

    press(el, '닫기');

    expect(el.textContent).toContain('3 / 8');
  });

  /*
   * 나가는 길이 셋이다 — 닫기 버튼, 바깥 누르기, Escape. 위의 '닫으면 맞춰진다' 는 버튼만 봤고,
   * 그래서 Escape 가 다른 길로 닫혀 아래 갤러리를 안 맞추던 것을 못 잡았다. 길마다 확인한다.
   */
  it('Escape 로 닫아도 갤러리가 보고 있던 장에 맞춰진다', () => {
    const el = render(eight);
    press(el, '주최측 제공 자료 1');
    press(el, '다음 자료', 1);
    press(el, '다음 자료', 1);

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    });

    expect(zoomed(el)).toBeNull();
    expect(el.textContent).toContain('3 / 8');
  });

  it('바깥을 눌러 닫아도 맞춰진다', () => {
    const el = render(eight);
    press(el, '주최측 제공 자료 1');
    press(el, '다음 자료', 1);

    /* 그림 뒤에 깔린 판. 닫기 버튼과 이름이 같아 두 번째가 그것이다. */
    press(el, '닫기', 0);

    expect(zoomed(el)).toBeNull();
    expect(el.textContent).toContain('2 / 8');
  });

  /* 마우스 없이 온 사람에게 나갈 길이 버튼 하나뿐이면 갇힌 것과 같다. */
  it('Escape 로 닫히고 방향키로 넘어간다', () => {
    const el = render(eight);
    press(el, '주최측 제공 자료 2');

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
    });
    expect(zoomed(el)?.querySelector('img')?.getAttribute('src')).toBe(
      '/partner/jeju-2026/03.webp',
    );

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    });
    expect(zoomed(el)).toBeNull();
  });

  /* 뒤 페이지가 같이 굴러다니면 어디를 보고 있었는지 잃는다. */
  it('키운 동안 뒤 페이지는 안 굴러간다', () => {
    const el = render(eight);
    press(el, '주최측 제공 자료 1');
    expect(document.body.style.overflow).toBe('hidden');

    press(el, '닫기');
    expect(document.body.style.overflow).not.toBe('hidden');
  });
});
