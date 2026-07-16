/**
 * 베이스맵 빌드 버전 — 클라이언트가 지도 만들기 전에 한 번 호출.
 * 반환한 v(빌드 날짜 또는 "static")를 모든 타일 요청에 ?v= 로 붙여 immutable 캐시를 가능케 한다.
 */

import { resolveBuildDate } from "../shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const preferredRegion = ["icn1"];

export async function GET(): Promise<Response> {
  try {
    const v = await resolveBuildDate();
    return new Response(JSON.stringify({ v }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        // 브라우저/CDN 이 1시간 캐시 — 빌드는 하루 단위라 충분.
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch {
    // 실패 시에도 지도는 v 없이(폴백 경로로) 뜨게 200 + null.
    return new Response(JSON.stringify({ v: null }), {
      status: 200,
      headers: { "Content-Type": "application/json", "Cache-Control": "public, max-age=60" },
    });
  }
}
