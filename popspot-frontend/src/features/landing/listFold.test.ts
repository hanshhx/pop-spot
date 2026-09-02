import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const landing = readFileSync(join(process.cwd(), 'app/popups/[slug]/page.tsx'), 'utf8');

/**
 * <b>접는 것과 버리는 것은 다르다.</b>
 *
 * <p>랜딩 목록은 60곳 중 12곳만 펼치고 나머지를 {@code <details>} 로 접는다. 접힌 것은 첫 HTML 에
 * 그대로 있어야 한다 — 실측(2026-09-02)으로 서버가 내려주는 HTML 에 상세 링크가 61개 들어 있는 것을
 * 확인했다(목록 60 + 제휴 배너 1).
 *
 * <p><b>왜 검사가 필요한가.</b> 나중에 누군가 "어차피 12곳만 보이니까" 하고 뒤쪽 렌더를 지우면,
 * 48곳이 HTML 에서 통째로 사라진다. 화면은 그대로라 아무도 눈치채지 못하고, 사이트맵에는 주소가
 * 있으니 구글은 그 팝업들을 알지만 들어갈 링크가 없어 "발견됨 - 색인 안 됨" 에 그대로 남는다.
 * 이 페이지가 존재하는 이유가 검색 유입이므로, 조용히 잃으면 안 되는 종류다.
 *
 * <p>페이지를 나누는 방식(?page=2)을 안 쓴 경위는 목록 아래 주석에 있다.
 */
describe('랜딩 목록 접기', () => {
  it('펼치는 수가 전체 한도보다 적다 — 아니면 접을 것이 없다', () => {
    const visible = landing.match(/const LIST_VISIBLE = (\d+);/);
    const limit = landing.match(/const LIST_LIMIT = (\d+);/);

    expect(visible).not.toBeNull();
    expect(limit).not.toBeNull();
    expect(Number(visible![1])).toBeLessThan(Number(limit![1]));
  });

  /* 이 검사가 이 파일의 존재 이유다. 뒤쪽을 안 그리면 48곳이 HTML 에서 사라진다. */
  it('접히는 쪽도 실제로 그린다 — 잘라 버리지 않는다', () => {
    expect(landing).toContain('sorted.slice(LIST_VISIBLE, LIST_LIMIT).map(renderListItem)');
  });

  it('그 목록이 details 안에 있다 — 자바스크립트 없이 열린다', () => {
    expect(landing).toMatch(
      /<details[\s\S]{0,600}sorted\.slice\(LIST_VISIBLE, LIST_LIMIT\)[\s\S]{0,200}<\/details>/,
    );
  });

  /* 펼친 쪽과 접힌 쪽이 같은 함수를 써야 한 쪽만 고쳐지는 날이 안 온다. */
  it('펼친 쪽과 접힌 쪽이 같은 렌더를 쓴다', () => {
    expect(landing).toContain('sorted.slice(0, LIST_VISIBLE).map(renderListItem)');
  });
});
