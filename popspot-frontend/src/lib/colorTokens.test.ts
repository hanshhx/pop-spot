import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * 홈이 글자색을 <b>의미 토큰</b>으로만 정하는지 지킨다.
 *
 * <p>고정 회색({@code text-gray-500})은 다크모드에 반응하지 않는다. 그래서 쓸 때마다 짝이 되는
 * {@code dark:text-white/60} 을 같이 적어야 했고, 홈에만 그 짝이 열세 가지로 늘어나 있었다.
 * 같은 성격의 글자가 화면마다 다른 밝기로 보였고, 짝을 빠뜨리면 어두운 바탕에 어두운 글자가 남았다.
 *
 * <p>세 단계로 줄였다 — 본문 {@code text-foreground}, 보조 {@code text-muted-foreground},
 * 흐림 {@code text-subtle-foreground}. 셋 다 다크모드 값을 스스로 갖고 있어 {@code dark:} 를
 * 적을 필요가 없다.
 *
 * <p>이 시험이 막는 것은 "회색을 쓰지 마라" 가 아니라 <b>고정 회색과 다크 짝을 손으로 다시 적는 것</b>
 * 이다. 색이 있는 면 위의 흰 글자처럼 토큰으로 표현할 수 없는 자리는 그대로 둔다.
 */

const ROOT = path.resolve(__dirname, '../..');

/** 홈 화면을 그리는 파일들. 여기부터 정리하고 나머지 화면으로 넓힌다. */
const HOME_FILES = ['app/HomeClient.tsx', 'src/components/main/PopupCard.tsx'];

/** 고정 회색 글자색. 100~300 은 어두운 면 위에서 쓰는 밝은 회색이라 뺀다. */
const HARDCODED_GREY = /\btext-gray-(?:400|500|600|700|800|900)\b/;

/** 그 회색을 받치려고 손으로 적은 다크 짝. */
const MANUAL_DARK_TEXT = /\bdark:text-(?:white|black)\//;

function read(rel: string): string[] {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8').split('\n');
}

describe('홈 글자색', () => {
  it.each(HOME_FILES)('%s — 고정 회색과 다크 짝을 함께 적지 않는다', (rel) => {
    const offenders = read(rel)
      .map((line, i) => ({ line, no: i + 1 }))
      .filter(({ line }) => HARDCODED_GREY.test(line) && MANUAL_DARK_TEXT.test(line))
      .map(({ line, no }) => `${rel}:${no}  ${line.trim().slice(0, 100)}`);

    expect(offenders).toEqual([]);
  });

  it('세 토큰이 실제로 쓰이고 있다', () => {
    // 토큰만 정의해 두고 아무도 안 쓰면 위 시험은 통과하지만 화면은 그대로다.
    const src = HOME_FILES.map(read).flat().join('\n');
    expect(src).toMatch(/\btext-foreground\b/);
    expect(src).toMatch(/\btext-muted-foreground\b/);
    expect(src).toMatch(/\btext-subtle-foreground\b/);
  });
});

describe('globals.css', () => {
  const css = fs.readFileSync(path.join(ROOT, 'app/globals.css'), 'utf8');

  it('흐림 단계가 낮과 다크 양쪽에 정의돼 있다', () => {
    // 한쪽만 있으면 반대 모드에서 조용히 다른 색을 물려받는다 — 화면이 깨지지 않아 눈치채기 어렵다.
    const hits = css.match(/--color-subtle-foreground:/g) ?? [];
    expect(hits).toHaveLength(2);
  });

  it('흐림은 보조보다 연하다', () => {
    // 순서가 뒤집히면 '덜 중요한 것' 이 더 진하게 보인다. 낮모드 값으로 확인한다.
    const light = css.slice(0, css.indexOf(':root.dark'));
    expect(light).toMatch(/--color-muted-foreground:\s*var\(--color-ink-500\)/);
    expect(light).toMatch(/--color-subtle-foreground:\s*var\(--color-ink-400\)/);
  });
});
