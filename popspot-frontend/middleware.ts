import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * POP-SPOT — 루트(/) 진입 시 인트로 페이지로 리다이렉트.
 *
 * <p>정책:
 * <ul>
 *   <li>인트로 페이지를 매번 우선 노출 (인트로의 ENTER 클릭이 {@code /?entered=1} 로 라우팅).</li>
 *   <li>v2.15.2 — Deep link 쿼리 (예: {@code /?tab=MY}, {@code /?tab=MAP&popup=123})
 *       가 있으면 사용자가 의도적으로 특정 화면에 진입한 것으로 간주해 인트로를 거치지
 *       않고 그 쿼리를 보존한 채 메인으로 통과시킨다. 이전 구현은 entered=1 만 인정해
 *       deep link 가 모두 인트로로 튕기는 회귀가 있었음.</li>
 *   <li>게스트 7일 정책 자체는 클라이언트 (localStorage) 에서 관리하므로 미들웨어는 인트로
 *       페이지 진입까지만 책임진다. 만료 후 회원가입 강제는 인트로 페이지 컴포넌트가 처리.</li>
 *   <li>matcher 가 "/" 로 한정되어 다른 경로 / API / 정적 파일에는 영향 없음.</li>
 * </ul>
 */
const DEEP_LINK_PARAMS = ["tab", "popup", "music", "course", "mate"] as const;

export function middleware(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;

  if (pathname !== "/") {
    return NextResponse.next();
  }

  const entered = searchParams.get("entered");
  if (entered === "1") {
    return NextResponse.next();
  }

  // v2.15.2 — deep link 쿼리가 있으면 entered=1 자동 부착 후 메인 진입.
  // 인트로 페이지를 거치지 않아야 사이트맵 / 외부 링크 / 검색결과에서 직접 진입한
  // 사용자가 의도한 탭/팝업 화면을 그대로 본다.
  const hasDeepLink = DEEP_LINK_PARAMS.some((key) => searchParams.has(key));
  if (hasDeepLink) {
    const url = request.nextUrl.clone();
    url.searchParams.set("entered", "1");
    return NextResponse.redirect(url);
  }

  // 기본 동작 — 인트로로 보낸다.
  const url = request.nextUrl.clone();
  url.pathname = "/intro";
  url.search = "";
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/"],
};
