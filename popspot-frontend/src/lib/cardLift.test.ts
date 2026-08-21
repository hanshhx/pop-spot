import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * 카드에 손을 올렸을 때의 반응을 한 곳에서만 정한다.
 *
 * <p>세 가지가 따로 놀았다 — 팝업 카드는 4px 올라가고, 히어로 썸네일은 2px, 목록 링크는 아예
 * 움직이지 않고 테두리만 라임으로 바뀌었다. 같은 "카드" 인데 손을 올릴 때마다 다르게 반응했다.
 * 마지막 것은 라임을 "누를 수 있는 것" 으로 정한 뒤로 특히 어긋났다 — 손만 올려도 색이 번쩍였다.
 */

const ROOT = path.resolve(__dirname, '../..');
const CSS = fs.readFileSync(path.join(ROOT, 'app/globals.css'), 'utf8');

/** {@code .card-lift} 규칙 세 덩어리를 한 조각으로 잘라 둔다. */
const BLOCK = CSS.slice(CSS.indexOf('.card-lift'), CSS.indexOf('@keyframes bgfade'));

describe('.card-lift', () => {
  it('transform 이 아니라 translate 로 올린다', () => {
    // 이 시험이 이 파일의 존재 이유다.
    //
    // transform 으로 쓰면 카드가 이미 갖고 있던 자리 이동을 통째로 덮어쓴다. 히어로 썸네일은
    // sm:translate-y-3 으로 12px 내려 엇갈리게 놓여 있어서, 손을 올리는 순간 12px 아래에서
    // 2px 위로 14px 튀어 오른다. translate 는 transform 과 다른 속성이라 둘이 더해진다
    // (실측: transform 12px + translate -2px = 10px).
    expect(BLOCK).toMatch(/translate:\s*0\s+-2px/);
    expect(BLOCK).not.toMatch(/transform:\s*translate/);
  });

  it('그림자를 var() 로 가져오지 않는다', () => {
    // @theme 의 --shadow-* 는 유틸리티 안으로 들어가고 :root 에서는 빈 값으로 읽힌다.
    // var(--shadow-lg) 라고 쓰면 오류 없이 그림자만 사라진다 — 눈으로도 알아채기 어렵다.
    expect(BLOCK).not.toMatch(/var\(--shadow-/);
  });

  it('손가락 화면과 움직임 줄이기를 둘 다 막아 둔다', () => {
    // 터치에서는 :hover 가 탭한 뒤에도 남아 한 번 누른 카드가 계속 떠 있는다.
    expect(BLOCK).toMatch(/@media\s*\(hover:\s*hover\)/);
    expect(BLOCK).toMatch(/@media\s*\(prefers-reduced-motion:\s*reduce\)/);
  });

  it('움직임을 끄는 규칙이 켜는 규칙보다 뒤에 온다', () => {
    // 같은 순위끼리는 나중에 적힌 것이 이긴다. 순서가 뒤집히면 설정을 켜도 카드가 그대로 움직인다.
    // .home-flat-grain 을 미디어 쿼리 뒤에 두었다가 같은 이유로 한 번 겪었다.
    expect(BLOCK.indexOf('prefers-reduced-motion')).toBeGreaterThan(BLOCK.indexOf('hover: hover'));
  });
});

describe('카드 hover', () => {
  const FILES = ['app/HomeClient.tsx', 'src/components/main/PopupCard.tsx'];

  it.each(FILES)('%s — 카드마다 따로 올리지 않는다', (rel) => {
    const src = fs.readFileSync(path.join(ROOT, rel), 'utf8');
    // 거리를 다시 손으로 적기 시작하면 세 가지로 갈라졌던 자리로 돌아간다.
    expect(src).not.toMatch(/hover:-?translate-y-/);
  });

  it('.card-lift 를 실제로 쓰고 있다', () => {
    const src = FILES.map((f) => fs.readFileSync(path.join(ROOT, f), 'utf8')).join('\n');
    expect(src).toMatch(/\bcard-lift\b/);
  });
});
