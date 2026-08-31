import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

/**
 * {@code public/robots.txt} 를 지키는 시험.
 *
 * <p>이 파일은 정적 파일이라 타입 검사도 린트도 걸리지 않는다. 그런데 한 줄만 잘못 써도
 * <b>사이트 전체가 검색에서 사라진다.</b> 되돌릴 수는 있지만 그때는 이미 크롤러가 다녀간 뒤다.
 * 그래서 여기서 사람이 볼 수 없는 실수를 대신 잡는다.
 *
 * <p>가장 중요한 시험은 "무엇을 막는가" 가 아니라 <b>"무엇을 막지 않는가"</b> 다.
 * {@code /en/popup/} 을 막으려다 {@code /popup/} 을 막으면 사이트맵의 418건이 통째로 사라진다.
 */

const ROBOTS = readFileSync(
  fileURLToPath(new URL('../../public/robots.txt', import.meta.url)),
  'utf8',
);

/** 주석과 빈 줄을 걷어내고 실제 Disallow 값만 뽑는다. */
function disallowedPaths(robots: string): string[] {
  return robots
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => !line.startsWith('#'))
    .filter((line) => /^disallow:/i.test(line))
    .map((line) => line.slice('disallow:'.length).trim())
    .filter((value) => value.length > 0);
}

/** 이 경로가 규칙에 걸리는가. robots.txt 는 접두사 일치다. */
function isBlocked(path: string): boolean {
  return disallowedPaths(ROBOTS).some((rule) => path.startsWith(rule));
}

describe('robots.txt', () => {
  it('색인될 수 없는 다국어 상세를 막는다', () => {
    expect(isBlocked('/en/popup/1')).toBe(true);
    expect(isBlocked('/ja/popup/1350')).toBe(true);
  });

  /*
   * 이 시험이 이 파일의 존재 이유다. 위 두 줄을 쓰다가 '/popup/' 로 잘못 적으면 사이트맵에
   * 실린 418건이 통째로 크롤 금지가 된다 — 그리고 그 사실은 몇 주 뒤 유입이 사라진 다음에야
   * 드러난다.
   */
  it('색인 대상인 한국어 상세와 모든 랜딩은 막지 않는다', () => {
    expect(isBlocked('/popup/1')).toBe(false);
    expect(isBlocked('/popup/1350')).toBe(false);
    expect(isBlocked('/popups/seongsu')).toBe(false);
    expect(isBlocked('/en/popups/seongsu')).toBe(false);
    expect(isBlocked('/ja/popups/seongsu')).toBe(false);
  });

  it('홈과 언어별 홈을 막지 않는다', () => {
    expect(isBlocked('/')).toBe(false);
    expect(isBlocked('/en')).toBe(false);
    expect(isBlocked('/ja')).toBe(false);
  });

  it('원래 막던 것들은 그대로 막는다', () => {
    expect(isBlocked('/admin')).toBe(true);
    expect(isBlocked('/api/popups')).toBe(true);
    expect(isBlocked('/login')).toBe(true);
  });

  it('사이트맵 선언이 살아 있다', () => {
    expect(ROBOTS).toContain('Sitemap: https://popspot.co.kr/sitemap.xml');
    expect(ROBOTS).toContain('Sitemap: https://popspot.co.kr/feed.xml');
  });

  /* 값이 '/' 로 시작하지 않으면 크롤러가 그 줄을 통째로 무시한다 — 조용히 안 막힌다. */
  it('모든 Disallow 값이 슬래시로 시작한다', () => {
    for (const rule of disallowedPaths(ROBOTS)) {
      expect(rule.startsWith('/')).toBe(true);
    }
  });

  it('전체 차단이 들어가 있지 않다', () => {
    expect(disallowedPaths(ROBOTS)).not.toContain('/');
  });
});
