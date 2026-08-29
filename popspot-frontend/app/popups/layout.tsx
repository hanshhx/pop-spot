import type { ReactNode } from 'react';

import { SiteChrome } from '@/components/layout/SiteChrome';

/**
 * 검색 랜딩이 입는 사이트 껍데기.
 *
 * <p>여기까지 오는 사람은 홈을 거치지 않는다 — 구글·네이버에서 바로 떨어진다. 그런데 헤더도
 * 푸터도 {@code HomeClient} 안에만 있어서, 이 페이지에는 사이트의 나머지로 가는 길이 맨 위
 * "돌아가기" 한 줄뿐이었다. 실측(2026-08-29) 방문자 1,561명 중 <b>514명(32.9%)이 랜딩 한 장만
 * 보고 떠났다.</b>
 *
 * <p>영문·일문 랜딩({@code app/en/popups}, {@code app/ja/popups})도 같은 껍데기를 쓴다. 페이지
 * 본문은 세 언어가 같은 컴포넌트를 재수출하는데 레이아웃만 따로 두면, 언젠가 한쪽에만 무엇이
 * 붙어 화면이 갈린다.
 */
export default function PopupsLandingLayout({ children }: { children: ReactNode }) {
  return <SiteChrome>{children}</SiteChrome>;
}
