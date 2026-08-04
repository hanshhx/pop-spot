import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { TERMS_EFFECTIVE_DATE, shouldIndexDetailOn, type ServerPopup } from './serverData';

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
