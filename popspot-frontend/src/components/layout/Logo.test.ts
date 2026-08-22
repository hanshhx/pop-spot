import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * 로고의 계절 교체 범위를 붙잡는다.
 *
 * <p>한 번 어긴 적이 있어서 테스트로 남긴다. `.st1{fill:...}` 을 통째로 계절색으로 바꿨더니
 * 워드마크와 함께 <b>핀 마크까지</b> 계절을 탔다. 핀은 파비콘·앱 아이콘에서 단독으로 쓰이는
 * 유일한 요소라 사계절 고정이어야 한다. 눈으로는 21px 헤더에서 잘 안 보이고, 파비콘을 따로
 * 확인하는 사람도 없어서 그대로 배포됐다.
 */

const SRC = readFileSync(join(__dirname, 'Logo.tsx'), 'utf8');

/** 가로 락업 SVG 에서 워드마크 그룹과 핀 부분을 나눈다. */
function lockup(): { wordmark: string; pin: string } {
  const svg = SRC.slice(SRC.indexOf('const LOGO_SVG'), SRC.indexOf('const SYMBOL_SVG'));
  const [wordmark, pin] = svg.split('</g>');
  return { wordmark, pin };
}

describe('계절 로고', () => {
  it('워드마크의 SPOT 네 글자만 계절색을 쓴다', () => {
    const { wordmark } = lockup();
    expect(wordmark.match(/class="sp"/g)).toHaveLength(4);
    expect(SRC).toContain('.sp{fill:var(--s-hi,#b8d565)}');
  });

  it('핀 마크는 계절을 타지 않는다 — 파비콘·앱 아이콘에서 단독으로 쓰인다', () => {
    const { pin } = lockup();
    expect(pin, '핀에 계절 클래스가 새어 들어갔다').not.toContain('class="sp"');
    expect(pin, '핀에 계절 변수가 새어 들어갔다').not.toContain('--s-');
    expect(SRC).toContain('.st1{fill:#b8d565}');
  });

  it('심볼 단독(LogoMark)은 사계절 라임 고정이다', () => {
    const symbol = SRC.slice(SRC.indexOf('const SYMBOL_SVG'), SRC.indexOf('export interface'));
    expect(symbol).toContain('.st0{fill:#b3d35f}');
    expect(symbol, '마크 단독 렌더에 계절색이 들어갔다').not.toContain('--s-');
  });

  it('POP(잉크)은 계절색이 아니다 — 잉크가 바뀌면 다른 브랜드로 읽힌다', () => {
    expect(SRC).toContain('.st0{fill:currentColor}');
  });
});
