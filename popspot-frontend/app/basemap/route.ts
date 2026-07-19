/**
 * 베이스맵 타일 프록시 — Protomaps planet pmtiles 로 Range 요청을 중계한다.
 *
 * 성능: 클라이언트가 ?v=<빌드날짜> 를 붙여 요청하면(= 불변 파일) 장기 immutable 캐시를 건다.
 * 그러면 브라우저가 같은 타일을 다시 안 받아 지도가 빨라진다. v 없는 요청(구버전/직접 호출)은
 * 최신 빌드로 폴백하되 짧게만 캐시해 롤오버 혼선을 막는다.
 *
 * ⚠️ /api/* 는 next.config rewrites 로 백엔드에 넘어가므로, 이 라우트는 일부러 /basemap 에 둔다.
 */

import { BUILD_BASE, OVERRIDE, cacheGet, cacheSet, resolveBuildDate, upstreamUrlForVersion } from "../basemap/shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// 서울 유저 근처에서 실행(왕복 지연 ↓). 플랜이 리전 지정을 막으면 무시된다.
export const preferredRegion = ["icn1"];

// 한 번에 중계할 수 있는 최대 바이트. pmtiles 조각은 헤더 16KB·디렉터리·타일 모두 이보다 훨씬 작다.
// 이 상한이 없으면 `Range: bytes=0-1073741823` 한 방으로 1GB 를 arrayBuffer 에 올려 함수가 OOM 으로 죽는다.
const MAX_RANGE_BYTES = 4 * 1024 * 1024;

/** `bytes=start-end` 단일 범위만 허용하고 길이를 상한으로 제한. 그 외(다중·열린·suffix)는 거부. */
function parseRange(range: string): { ok: true } | { ok: false; reason: string } {
  const m = /^bytes=(\d+)-(\d+)$/.exec(range.trim());
  if (!m) return { ok: false, reason: "single closed byte range required" };
  const start = Number(m[1]);
  const end = Number(m[2]);
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || end < start) {
    return { ok: false, reason: "invalid range bounds" };
  }
  if (end - start + 1 > MAX_RANGE_BYTES) return { ok: false, reason: "range too large" };
  return { ok: true };
}

export async function GET(req: Request): Promise<Response> {
  const range = req.headers.get("range") ?? "";
  // Range 없는 요청은 거부 — 없이 upstream 을 부르면 planet 전체가 응답으로 와서 서버 메모리가 터진다.
  if (!range) {
    return new Response("Range header required", { status: 416, headers: { "Accept-Ranges": "bytes" } });
  }
  // 크기·형식 검증 — 인증 없는 공개 엔드포인트라 대용량 range 로 메모리를 고갈시킬 수 있다.
  const checked = parseRange(range);
  if (!checked.ok) {
    return new Response(checked.reason, { status: 416, headers: { "Accept-Ranges": "bytes" } });
  }

  const v = new URL(req.url).searchParams.get("v");
  // v 가 유효(숫자 8자리/OVERRIDE)면 그 빌드로 고정 → immutable 캐시 안전.
  let upstreamUrl = upstreamUrlForVersion(v);
  const pinned = upstreamUrl !== null;
  if (!upstreamUrl) {
    try {
      upstreamUrl = OVERRIDE ?? `${BUILD_BASE}/${await resolveBuildDate()}.pmtiles`;
    } catch (e) {
      return new Response((e as Error).message, { status: 502 });
    }
  }

  const cacheKey = `${upstreamUrl}|${range}`;
  const cached = cacheGet(cacheKey);
  if (cached) {
    return new Response(cached.body, {
      status: cached.status,
      headers: baseHeaders(cached.contentRange, cached.body.byteLength, pinned),
    });
  }

  let status: number;
  let body: ArrayBuffer;
  let contentRange: string | null;
  try {
    const upstream = await fetch(upstreamUrl, { headers: { Range: range } });
    status = upstream.status;
    body = await upstream.arrayBuffer();
    contentRange = upstream.headers.get("content-range");
  } catch {
    return new Response("upstream fetch failed", { status: 502 });
  }

  cacheSet(cacheKey, { status, contentRange, body });

  return new Response(body, { status, headers: baseHeaders(contentRange, body.byteLength, pinned) });
}

function baseHeaders(contentRange: string | null, len: number, pinned: boolean): HeadersInit {
  const h: Record<string, string> = {
    "Content-Type": "application/octet-stream",
    "Accept-Ranges": "bytes",
    "Content-Length": String(len),
    // v 로 빌드가 고정(=불변 파일)이면 1주 immutable — 브라우저가 재요청 안 함(지도 속도 ↑).
    // v 없는 폴백은 롤오버로 바이트가 바뀔 수 있어 짧게(5분)만.
    "Cache-Control": pinned ? "public, max-age=604800, immutable" : "public, max-age=300",
    // Range 별로 다른 응답임을 캐시에 알림.
    Vary: "Range",
  };
  if (contentRange) h["Content-Range"] = contentRange;
  return h;
}
