import { describe, expect, it } from 'vitest';

import { buildPopupEventJsonLd, serializeJsonLd } from './popupEventJsonLd';

const TODAY = '2026-08-12';

describe('buildPopupEventJsonLd', () => {
  it('검증된 상세 한 건만 사실 기반 Event로 만든다', () => {
    const value = buildPopupEventJsonLd(
      {
        name: '테스트 팝업',
        address: '서울특별시 성동구 연무장길 1',
        openDate: '2026-08-01',
        closeDate: '2026-08-31',
      },
      'https://popspot.co.kr/popup/42',
      TODAY,
    );

    expect(value).toMatchObject({
      '@type': 'Event',
      name: '테스트 팝업',
      startDate: '2026-08-01',
      endDate: '2026-08-31',
      url: 'https://popspot.co.kr/popup/42',
    });
    expect(value).not.toHaveProperty('offers');
    expect(value).not.toHaveProperty('image');
    expect(value).not.toHaveProperty('organizer');
  });

  it('출처가 확인된 실제 사진만 Event에 포함한다', () => {
    const base = {
      name: '테스트 팝업',
      address: '서울특별시 성동구 연무장길 1',
      openDate: '2026-08-01',
      closeDate: '2026-08-31',
      imageUrl: 'https://cdn.example.com/popup.jpg',
    };

    expect(
      buildPopupEventJsonLd(
        { ...base, photoOrigin: 'CRAWLED' },
        'https://popspot.co.kr/popup/42',
        TODAY,
      ),
    ).toHaveProperty('image', ['https://cdn.example.com/popup.jpg']);
    expect(
      buildPopupEventJsonLd(
        { ...base, photoOrigin: 'PEXELS' },
        'https://popspot.co.kr/popup/42',
        TODAY,
      ),
    ).not.toHaveProperty('image');
  });

  it.each([
    [{ name: '날짜 없음', address: '서울 성동구', closeDate: '2026-08-31' }],
    [
      {
        name: '잘못된 날짜',
        address: '서울 성동구',
        openDate: '2026-02-30',
        closeDate: '2026-08-31',
      },
    ],
    [
      {
        name: '모호한 장소',
        address: '서울',
        openDate: '2026-08-01',
        closeDate: '2026-08-31',
      },
    ],
    [
      {
        name: '이미 종료',
        address: '서울 성동구 연무장길 1',
        openDate: '2026-07-01',
        closeDate: '2026-08-11',
      },
    ],
  ])('불확실하거나 색인 대상이 아니면 내보내지 않는다', (popup) => {
    expect(buildPopupEventJsonLd(popup, 'https://popspot.co.kr/popup/1', TODAY)).toBeNull();
  });

  it('수집 이름이 script 태그를 닫지 못하게 한다', () => {
    expect(serializeJsonLd({ name: '</script><script>alert(1)</script>' })).not.toContain(
      '</script>',
    );
  });
});
