/**
 * 베이스맵 타일 프록시 — Protomaps 의 planet pmtiles 로 Range 요청을 중계한다.
 *
 * 왜 필요한가:
 *  - Protomaps 원본(build.protomaps.com)은 CORS 헤더가 없어 브라우저가 직접 못 읽는다.
 *  - 이 라우트가 same-origin 으로 감싸주면 브라우저 pmtiles 클라이언트가 필요한 조각만 받는다.
 *  - 운영에서는 서울만 잘라낸 정적 .pmtiles 를 같은 방식(같은 경로)으로 서빙하면 된다
 *    (BASEMAP_PMTILES_URL 로 교체). 즉 이 프록시는 로컬/개발용 편의 + 운영 확장점.
 *
 * ⚠️ /api/* 는 next.config rewrites 로 백엔드에 넘어가므로, 이 라우트는 일부러 /basemap 에 둔다.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Protomaps 일별 planet 빌드. latest 별칭이 없어 최근 날짜를 역순 탐색해 캐시한다.
const OVERRIDE = process.env.BASEMAP_PMTILES_URL;
const BUILD_BASE = "https://build.protomaps.com";

let resolvedUrl: string | null = OVERRIDE ?? null;
let resolvedAt = 0;
const RESOLVE_TTL_MS = 6 * 60 * 60 * 1000; // 6시간마다 재확인(날짜 롤오버 대비)

function ymd(d: Date): string {
  return (
    d.getUTCFullYear().toString() +
    String(d.getUTCMonth() + 1).padStart(2, "0") +
    String(d.getUTCDate()).padStart(2, "0")
  );
}

/** 최근 14일 중 실제 존재하는 pmtiles URL 을 찾아 캐시. */
async function resolvePmtilesUrl(): Promise<string> {
  if (OVERRIDE) return OVERRIDE;
  const now = Date.now();
  if (resolvedUrl && now - resolvedAt < RESOLVE_TTL_MS) return resolvedUrl;

  for (let i = 0; i < 14; i++) {
    const d = new Date(now - i * 86400000);
    const url = `${BUILD_BASE}/${ymd(d)}.pmtiles`;
    try {
      const res = await fetch(url, { headers: { Range: "bytes=0-0" } });
      if (res.status === 206 || res.ok) {
        resolvedUrl = url;
        resolvedAt = now;
        return url;
      }
    } catch {
      /* 다음 날짜 시도 */
    }
  }
  throw new Error("사용 가능한 Protomaps 빌드를 찾지 못했습니다");
}

// dev 편의용 소형 Range 캐시(같은 조각 재요청 시 upstream 왕복 절약).
const cache = new Map<string, { status: number; contentRange: string | null; body: ArrayBuffer }>();
const CACHE_MAX = 1200;

export async function GET(req: Request): Promise<Response> {
  const range = req.headers.get("range") ?? "";
  // Range 헤더가 없으면 거부한다. 없이 upstream 을 부르면 136GB planet 전체가 응답으로 오고
  // arrayBuffer() 가 그걸 통째로 메모리에 올려 서버가 죽는다. pmtiles 클라이언트는 항상
  // Range 로 필요한 조각만 요청하므로 정상 지도 트래픽엔 영향이 없다(봇·프리페치만 걸러짐).
  if (!range) {
    return new Response("Range header required", {
      status: 416,
      headers: { "Accept-Ranges": "bytes" },
    });
  }

  let upstreamUrl: string;
  try {
    upstreamUrl = await resolvePmtilesUrl();
  } catch (e) {
    return new Response((e as Error).message, { status: 502 });
  }

  const cacheKey = `${upstreamUrl}|${range}`;
  const cached = cache.get(cacheKey);
  if (cached) {
    return new Response(cached.body, {
      status: cached.status,
      headers: baseHeaders(cached.contentRange, cached.body.byteLength),
    });
  }

  // upstream 네트워크 실패를 잡아 500(스택 노출) 대신 502 로 응답.
  let upstream: Response;
  let body: ArrayBuffer;
  try {
    upstream = await fetch(upstreamUrl, { headers: { Range: range } });
    body = await upstream.arrayBuffer();
  } catch {
    return new Response("upstream fetch failed", { status: 502 });
  }
  const contentRange = upstream.headers.get("content-range");

  // FIFO 축출 — 가득 차면 가장 오래된 항목을 지워 메모리를 상한선 안에 묶는다.
  if (cache.size >= CACHE_MAX) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  cache.set(cacheKey, { status: upstream.status, contentRange, body });

  return new Response(body, {
    status: upstream.status,
    headers: baseHeaders(contentRange, body.byteLength),
  });
}

function baseHeaders(contentRange: string | null, len: number): HeadersInit {
  const h: Record<string, string> = {
    "Content-Type": "application/octet-stream",
    "Accept-Ranges": "bytes",
    "Content-Length": String(len),
    // 정적 파일(BASEMAP_PMTILES_URL)은 롤오버가 없어 길게 캐시.
    // 기본(일별 planet)은 UTC 롤오버로 청크 오프셋이 바뀌므로, 브라우저가 서로 다른 빌드의
    // 바이트를 섞지 않도록 캐시하지 않는다(서버 in-memory 캐시는 빌드별 keyed 라 여전히 빠름).
    "Cache-Control": OVERRIDE ? "public, max-age=86400" : "no-store",
  };
  if (contentRange) h["Content-Range"] = contentRange;
  return h;
}
