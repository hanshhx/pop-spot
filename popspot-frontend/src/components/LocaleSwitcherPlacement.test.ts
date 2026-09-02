import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(join(process.cwd(), path), 'utf8');

const header = read('src/components/layout/Header.tsx');
const siteChrome = read('src/components/layout/SiteChrome.tsx');
const detailPage = read('app/popup/[id]/PopupDetailClient.tsx');
const detailLayout = read('app/popup/[id]/layout.tsx');
const landingPage = read('app/popups/[slug]/page.tsx');
const landingLayout = read('app/popups/layout.tsx');
const home = read('app/HomeClient.tsx');

/**
 * <b>모든 화면에서 언어를 바꿀 수 있어야 한다. 단 한 자리에서.</b>
 *
 * <p><b>왜 지키나.</b> 예전에 언어 전환이 히어로 카드 안에 있었는데, 그 카드가 비로그인일 때만
 * 그려져서 <b>로그인한 외국인 회원은 언어를 바꿀 방법이 아예 없었다.</b> 화면에서 조용히 사라지는
 * 부류라 아무도 신고하지 않는다.
 *
 * <p><b>왜 검사를 다시 썼나.</b> 옛 검사는 "상세 파일 안에 {@code <LocaleSwitcher>} 글자가 있는가" 를
 * 봤다. 그러면 자리를 옮기는 순간 — 더 나은 자리로 옮겨도 — 깨진다. 지키려던 것은 파일이 아니라
 * <b>도달 가능성</b>이므로, 헤더가 그것을 들고 있고 그 헤더가 각 화면에 붙는지를 본다.
 *
 * <p>중복도 함께 막는다. 화면마다 다른 자리에 같은 것이 있으면 사이트가 두 겹으로 읽힌다 —
 * 2026-09-02 이전이 그랬다(홈은 검색존 옆, 랜딩은 우상단 알약, 상세는 사진 위 오버레이).
 */
describe('언어 전환 자리', () => {
  it('헤더가 언어 전환을 들고 있다', () => {
    expect(header).toContain('<LocaleSwitcher locale={locale}');
  });

  it('그 헤더를 사이트 껍데기가 그린다', () => {
    expect(siteChrome).toContain('<Header');
  });

  /* 껍데기가 안 씌워진 화면이 생기면 그 화면에서만 언어를 못 바꾸게 된다. */
  it.each([
    ['팝업 상세', detailLayout],
    ['SEO 랜딩', landingLayout],
  ])('%s 는 껍데기 안에 있다', (_이름, layout) => {
    expect(layout).toContain('<SiteChrome>');
  });

  /* 홈은 헤더를 직접 그린다(껍데기를 쓰지 않는다). 그래도 같은 헤더다. */
  it('홈도 같은 헤더를 쓴다', () => {
    expect(home).toContain('<Header');
  });

  it.each([
    ['팝업 상세', detailPage],
    ['SEO 랜딩', landingPage],
    ['홈', home],
  ])('%s 는 자기 언어 전환을 따로 두지 않는다', (_이름, source) => {
    expect(source).not.toContain('<LocaleSwitcher');
  });
});
