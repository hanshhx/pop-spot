import { describe, expect, it } from 'vitest';

import { isPexelsPhoto, popupCoverUrl, type CoverInput } from './popupCover';

/**
 * 이 판정이 두 방향으로 틀릴 수 있고, 둘 다 실제로 겪었다.
 *
 * <p>느슨하면 스톡 사진이 <b>연출 이미지 고지 없이</b> 실제 팝업 사진인 척 나간다. 빡빡하면
 * 멀쩡한 사진을 못 알아봐 히어로가 카테고리 그라데이션으로 떨어진다 — 2026-09-01 운영에서
 * 제휴처가 보낸 포스터가 정확히 그렇게 사라졌다.
 */

const cover = (extra: Partial<CoverInput>): CoverInput => ({ id: 1, ...extra });

describe('popupCoverUrl', () => {
  /*
   * 이 검사가 이 파일이 생긴 이유다. '/partner/...' 는 우리가 public/ 에서 서빙하는 경로인데,
   * new URL() 은 base 없이 파싱하면 예외를 던진다. 그 예외를 "사진 없음" 으로 읽고 있었다.
   */
  it('우리가 서빙하는 경로도 대표 이미지가 된다', () => {
    expect(
      popupCoverUrl(cover({ imageUrl: '/partner/jeju-2026/01.webp', photoOrigin: 'USER' })),
    ).toBe('/partner/jeju-2026/01.webp');
  });

  it('앞뒤 공백은 털어낸다', () => {
    expect(popupCoverUrl(cover({ imageUrl: '  /partner/a.webp  ', photoOrigin: 'USER' }))).toBe(
      '/partner/a.webp',
    );
  });

  /* '//host/x' 는 남의 도메인인데 '/x' 와 한 글자 차이다. 앞 글자만 보면 뚫린다. */
  it('프로토콜 생략(//host)은 우리 경로가 아니다', () => {
    expect(
      popupCoverUrl(cover({ imageUrl: '//evil.example.com/a.jpg', photoOrigin: 'USER' })),
    ).toBe(null);
  });

  it('원문에서 가져온 실사진은 그대로 쓴다', () => {
    expect(popupCoverUrl(cover({ imageUrl: 'https://cdn.x/a.jpg', photoOrigin: 'CRAWLED' }))).toBe(
      'https://cdn.x/a.jpg',
    );
  });

  /*
   * 출처는 PEXELS 라 하는데 주소는 Pexels 가 아닌 경우. 그대로 쓰면 화면이 "연출 이미지" 라고
   * 고지하면서 엉뚱한 사진을 띄운다 — 고지와 실물이 어긋나면 고지가 아니라 거짓말이 된다.
   */
  it('PEXELS 라면서 Pexels 주소가 아니면 안 쓴다', () => {
    expect(popupCoverUrl(cover({ imageUrl: 'https://cdn.x/a.jpg', photoOrigin: 'PEXELS' }))).toBe(
      null,
    );
    expect(
      popupCoverUrl(cover({ imageUrl: 'https://images.pexels.com/a.jpg', photoOrigin: 'PEXELS' })),
    ).toBe('https://images.pexels.com/a.jpg');
  });

  it('플레이스홀더는 안 쓴다', () => {
    expect(
      popupCoverUrl(
        cover({ imageUrl: 'https://images.pexels.com/a.jpg', photoOrigin: 'PLACEHOLDER' }),
      ),
    ).toBe(null);
  });

  /* photoOrigin 이 없던 시절의 응답. 알려진 스톡·플레이스홀더만 막고 나머지는 살린다. */
  it('출처를 모르는 구버전 응답은 알려진 스톡만 막는다', () => {
    expect(popupCoverUrl(cover({ imageUrl: 'https://images.pexels.com/a.jpg' }))).toBe(
      'https://images.pexels.com/a.jpg',
    );
    expect(
      popupCoverUrl(
        cover({ imageUrl: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff' }),
      ),
    ).toBe(null);
    expect(popupCoverUrl(cover({ imageUrl: 'https://cdn.x/a.jpg' }))).toBe('https://cdn.x/a.jpg');
  });

  it('주소가 없거나 이상하면 null', () => {
    expect(popupCoverUrl(cover({ imageUrl: null }))).toBe(null);
    expect(popupCoverUrl(cover({ imageUrl: '   ' }))).toBe(null);
    expect(popupCoverUrl(cover({ imageUrl: 'not a url', photoOrigin: 'USER' }))).toBe(null);
  });
});

describe('isPexelsPhoto', () => {
  it('Pexels 사진에는 연출 이미지 고지를 붙인다', () => {
    expect(
      isPexelsPhoto(cover({ imageUrl: 'https://images.pexels.com/a.jpg', photoOrigin: 'PEXELS' })),
    ).toBe(true);
  });

  /* 제휴처가 보낸 진짜 자료에 '연출 이미지' 를 붙이면 그쪽이 보낸 것을 가짜라고 말하는 셈이다. */
  it('제휴처가 보낸 자료에는 고지를 붙이지 않는다', () => {
    expect(
      isPexelsPhoto(cover({ imageUrl: '/partner/jeju-2026/01.webp', photoOrigin: 'USER' })),
    ).toBe(false);
  });
});
