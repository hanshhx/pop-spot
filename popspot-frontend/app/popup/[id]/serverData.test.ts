import { readFileSync } from 'node:fs';
import path from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  TERMS_EFFECTIVE_DATE,
  fetchPopupForServer,
  shouldIndexDetailOn,
  type ServerPopup,
} from './serverData';

/**
 * <b>공표한 것과 다르게 동작하지 않게</b> 막는다.
 *
 * <p>이용약관 §14-4 는 자동수집 상세의 색인 정책을 이용자에게 공표한 문서다. 코드가 그보다 먼저
 * 열리면 약관 위반이고, 늦게 열리면 아무도 모른 채 손해만 본다. 두 날짜가 <b>같은 파일에 없어서</b>
 * 어긋나기 쉬우므로, 여기서 실제 약관 페이지를 읽어 대조한다.
 */

const qualified: ServerPopup = {
  id: 1,
  name: '스트릿레스토랑파이터 팝업',
  content: '',
  address: '서울 송파구 올림픽로 240 롯데백화점 잠실점',
  category: 'FOOD',
  openDate: '2026-07-24',
  closeDate: '2026-12-31',
};

describe('약관 시행일을 코드가 지킨다', () => {
  it('시행일 하루 전까지는 자격을 갖춰도 열지 않는다', () => {
    expect(shouldIndexDetailOn(qualified, '2026-08-10')).toBe(false);
  });

  it('시행일부터 자격을 갖춘 것이 열린다', () => {
    expect(shouldIndexDetailOn(qualified, TERMS_EFFECTIVE_DATE)).toBe(true);
    expect(shouldIndexDetailOn(qualified, '2026-09-01')).toBe(true);
  });

  it('시행일이 지나도 자격을 못 갖추면 안 열린다', () => {
    const vague = { ...qualified, address: '서울' };
    expect(shouldIndexDetailOn(vague, '2026-09-01')).toBe(false);

    const noEnd = { ...qualified, closeDate: undefined };
    expect(shouldIndexDetailOn(noEnd, '2026-09-01')).toBe(false);

    const ended = { ...qualified, closeDate: '2026-08-01' };
    expect(shouldIndexDetailOn(ended, '2026-09-01')).toBe(false);
  });

  it('팝업이 없으면 열지 않는다', () => {
    expect(shouldIndexDetailOn(null, '2026-09-01')).toBe(false);
  });
});

describe('코드의 시행일과 약관에 적힌 시행일이 같다', () => {
  it('이용약관 페이지가 같은 날짜를 공표하고 있다', () => {
    const terms = readFileSync(path.join(process.cwd(), 'app/terms/page.tsx'), 'utf8');
    // 헤더의 "시행일: YYYY-MM-DD".
    const declared = terms.match(/시행일:\s*(\d{4}-\d{2}-\d{2})/)?.[1];

    expect(declared, '약관 페이지에서 시행일을 못 찾았다 — 표기 형식이 바뀌었는지 확인하라').toBe(
      TERMS_EFFECTIVE_DATE,
    );
  });

  it('약관 본문이 조건부 색인을 실제로 공표하고 있다', () => {
    const terms = readFileSync(path.join(process.cwd(), 'app/terms/page.tsx'), 'utf8');
    // 코드는 "종료일 + 위치" 를 조건으로 쓴다. 약관이 그렇게 적혀 있지 않으면
    // 공표한 것보다 넓게 여는 것이다.
    expect(terms).toContain('운영 종료일과 찾아갈 수 있는 위치가 모두 확인된 경우에 한해');
    // 회원 콘텐츠 차단은 이번 개정과 무관하게 유지돼야 한다(§14-5).
    expect(terms).toContain('X-Robots-Tag');
  });
});

describe('상세 페이지 비상 스냅샷', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('네트워크·5xx일 때 기존 상세 ID를 최소 정보로 유지한다', async () => {
    vi.stubEnv('NEXT_PUBLIC_API_URL', 'https://backend.example.com');
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('', { status: 502 })),
    );

    const popup = await fetchPopupForServer('1890');
    expect(popup).toMatchObject({ id: 1890, emergencySnapshot: true });
    expect(popup?.emergencyCapturedAt).toContain('2026-08-11');
  });

  it('정상 서버의 404는 삭제·비공개 결정으로 보고 스냅샷으로 되살리지 않는다', async () => {
    vi.stubEnv('NEXT_PUBLIC_API_URL', 'https://backend.example.com');
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('', { status: 404 })),
    );

    await expect(fetchPopupForServer('1890')).resolves.toBeNull();
  });

  it('목록에서 숨긴 중복 상세는 조회되지만 noindex로 유지한다', async () => {
    vi.stubEnv('NEXT_PUBLIC_API_URL', '');
    const popup = await fetchPopupForServer('525');

    expect(popup?.reviewStatus).toBe('DUPLICATE');
    expect(shouldIndexDetailOn(popup, '2026-08-14')).toBe(false);
  });
});

/**
 * 이 파일의 매핑은 <b>필드를 하나씩 옮겨 적는 관문</b>이다. 백엔드가 새 필드를 보내도 여기에 적지
 * 않으면 조용히 사라지고, 화면은 "원래 그런 것" 처럼 멀쩡히 그려진다.
 *
 * <p>실제로 그렇게 잃었다(2026-09-01). 백엔드 DTO 를 열어 갤러리 8장을 내보내게 했는데 상세에는
 * 아무것도 안 붙었다 — API 응답에는 8장이 그대로 있었다. 관문이 백엔드 DTO 말고 <b>여기에도</b>
 * 있다는 것을 못 봤기 때문이다.
 */
describe('백엔드가 보낸 것을 화면까지 옮긴다', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  const respond = (data: Record<string, unknown>) =>
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(JSON.stringify({ data }), {
            status: 200,
            headers: { 'content-type': 'application/json' },
          }),
      ),
    );

  const jeju = {
    id: 5619,
    name: '2026 제주 로컬브랜드 팝업스토어',
    location: '서울 성동구 KT&G 상상플래닛',
  };

  it('주최측 제공 자료를 흘리지 않는다', async () => {
    vi.stubEnv('NEXT_PUBLIC_API_URL', 'https://backend.example.com');
    respond({
      ...jeju,
      images: [
        { imageUrl: '/partner/jeju-2026/01.webp', photoOrigin: 'USER' },
        { imageUrl: '/partner/jeju-2026/02.webp', photoOrigin: 'USER' },
      ],
    });

    const popup = await fetchPopupForServer('5619');

    expect(popup?.images).toHaveLength(2);
    expect(popup?.images?.map((i) => i.imageUrl)).toEqual([
      '/partner/jeju-2026/01.webp',
      '/partner/jeju-2026/02.webp',
    ]);
  });

  /* 옛 백엔드는 이 필드를 아예 안 보낸다. 빈 배열이 아니라 없음이어야 갤러리가 안 그려진다. */
  it('자료를 안 보내면 undefined 다', async () => {
    vi.stubEnv('NEXT_PUBLIC_API_URL', 'https://backend.example.com');
    respond(jeju);

    expect((await fetchPopupForServer('5619'))?.images).toBeUndefined();
  });

  it('배열이 아닌 값이 와도 터지지 않는다', async () => {
    vi.stubEnv('NEXT_PUBLIC_API_URL', 'https://backend.example.com');
    respond({ ...jeju, images: '여덟 장' });

    expect((await fetchPopupForServer('5619'))?.images).toBeUndefined();
  });
});
