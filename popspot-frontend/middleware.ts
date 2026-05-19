import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * POP-SPOT — 루트(/) 진입 시 인트로 페이지로 리다이렉트.
 *
 * <p>정책:
 * <ul>
 *   <li>인트로 페이지를 매번 우선 노출 (인트로의 ENTER 클릭이 {@code /?entered=1} 로 라우팅).</li>
 *   <li>게스트 7일 정책 자체는 클라이언트 (localStorage) 에서 관리하므로 미들웨어는 인트로
 *       페이지 진입까지만 책임진다. 만료 후 회원가입 강제는 인트로 페이지 컴포넌트가 처리.</li>
 *   <li>matcher 가 "/" 로 한정되어 다른 경로 / API / 정적 파일에는 영향 없음.</li>
 * </ul>
 */
export function middleware(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;

  if (pathname === "/") {
    const entered = searchParams.get("entered");
    if (entered !== "1") {
      const url = request.nextUrl.clone();
      url.pathname = "/intro";
      url.search = "";
      return NextResponse.redirect(url);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/"],
};
