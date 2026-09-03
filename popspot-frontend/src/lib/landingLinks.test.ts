import { describe, expect, it } from 'vitest';

import { landingLinks } from './landingLinks';

/**
 * 홈에서 랜딩으로 가는 길이 <b>랜딩끼리만큼</b> 많아야 한다.
 *
 * <p>2026-09-03 실측: 랜딩끼리는 107~108개씩 이어져 있는데 홈은 27개뿐이었다. 홈이 사이트에서 가장
 * 힘이 센 페이지인데 거기서 랜딩으로 보내는 길이 가장 적었다.
 *
 * <p>목록을 두 벌로 두면 갈라진다. 새 지역이나 브랜드를 더했을 때 한쪽에만 반영되면 그 랜딩은
 * 사이트 안에서 들어가는 길이 반쪽이 되는데, <b>화면에는 아무 표시도 안 난다.</b>
 */
describe('landingLinks', () => {
  it('랜딩끼리 잇는 수만큼 나온다', () => {
    expect(landingLinks('ko').length).toBeGreaterThanOrEqual(80);
  });

  /* 같은 곳으로 두 번 보내면 링크만 늘고 얻는 것이 없다. */
  it('중복이 없다', () => {
    const slugs = landingLinks('ko').map((l) => l.slug);

    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it('보고 있는 랜딩은 뺀다 — 자기 자신으로 가는 링크는 뜻이 없다', () => {
    const all = landingLinks('ko');
    const one = all[5].slug;

    expect(landingLinks('ko', one).map((l) => l.slug)).not.toContain(one);
    expect(landingLinks('ko', one)).toHaveLength(all.length - 1);
  });

  it('지역·기간·카테고리·브랜드가 모두 들어 있다', () => {
    const kinds = new Set(landingLinks('ko').map((l) => l.kind));

    for (const kind of ['region', 'period', 'category', 'brand']) {
      expect(kinds).toContain(kind);
    }
  });

  /* 영어·일본어 화면에서 한국어 이름만 나오면 그 링크는 눌리지 않는다. */
  it.each(['ko', 'en', 'ja'] as const)('%s 라벨이 비어 있지 않다', (locale) => {
    const links = landingLinks(locale);

    expect(links.every((l) => l.label.trim().length > 0)).toBe(true);
  });

  it('slug 에 공백이나 슬래시가 없다 — 주소가 깨진다', () => {
    expect(landingLinks('ko').every((l) => /^[a-z0-9-]+$/.test(l.slug))).toBe(true);
  });
});

/**
 * 급상승 검색어로 연 랜딩은 앞에 크게 둔다. 그 표시가 {@code kind} 로는 안 갈린다 — 우선 링크의
 * kind 는 region·brand 처럼 일반 종류와 <b>같은 값</b>이라, 예전에 kind 로 거르려다 하나도 못
 * 잡았다(우선 칩이 통째로 사라졌다).
 */
describe('우선 링크 표시', () => {
  it('우선 링크가 하나 이상 있다', () => {
    expect(landingLinks('ko').filter((l) => l.priority).length).toBeGreaterThan(0);
  });

  it('우선 링크가 목록 앞쪽에 온다', () => {
    const links = landingLinks('ko');
    const lastPriority = links.map((l) => l.priority).lastIndexOf(true);
    const firstNormal = links.findIndex((l) => !l.priority);

    expect(lastPriority).toBeLessThan(firstNormal);
  });

  /* kind 로 거르면 안 된다는 것을 못 박는다. */
  it('kind 로는 우선 여부를 알 수 없다', () => {
    const priorityKinds = new Set(
      landingLinks('ko')
        .filter((l) => l.priority)
        .map((l) => l.kind),
    );
    const normalKinds = new Set(
      landingLinks('ko')
        .filter((l) => !l.priority)
        .map((l) => l.kind),
    );

    expect([...priorityKinds].some((k) => normalKinds.has(k))).toBe(true);
  });
});
