import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * POP-SPOT — 루트(/) 진입 시 인트로 페이지로 리다이렉트.
 *
 *  - 매번 방문할 때마다 인트로를 보여주려는 정책.
 *  - 인트로의 ENTER 버튼이 `/?entered=1` 으로 라우팅하면
 *    이 미들웨어는 통과시키므로 메인이 그대로 표시된다.
 *  - matcher 가 "/" 로 한정되어 있어 다른 경로 / API / 정적 파일에는 영향 없음.
 */
export function middleware(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;

  if (pathname === "/") {
    const entered = searchParams.get("entered");
    if (entered !== "1") {
      const url = request.nextUrl.clone();
      url.pathname = "/intro";
      url.search = ""; // 쿼리스트링 제거
      return NextResponse.redirect(url);
    }
  }

  return NextResponse.next();
}

/**
 * 루트(/) 한 경로에만 적용.
 * Next.js 가 자동으로 /_next/* , /api/* , 정적 자산 등은 제외시키지만
 * 명시적으로 "/" 만 매칭해서 안전 마진까지 확보.
 */
export const config = {
  matcher: ["/"],
};
