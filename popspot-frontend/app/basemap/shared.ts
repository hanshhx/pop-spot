/**
 * 베이스맵 프록시 공용 로직 — /basemap(타일)과 /basemap/version(버전) 이 공유.
 *
 * 핵심: pmtiles 일별 planet 빌드는 매일 파일이 바뀐다(청크 오프셋도 바뀜). 그래서 클라이언트는
 * /basemap/version 으로 "지금 서버가 서빙할 빌드 날짜(v)"를 한 번 받고, 모든 타일 요청에 ?v=날짜
 * 를 붙인다. 서버는 그 날짜 파일을 그대로 서빙하므로 (v = 불변 파일) 장기 immutable 캐시가 안전하다.
 * → 브라우저가 타일을 재요청하지 않아 지도가 빨라지고, 빌드 롤오버로 바이트가 섞이는 일도 없다.
 */

export const OVERRIDE = process.env.BASEMAP_PMTILES_URL; // 설정 시 서울 정적 파일(롤오버 없음)
export const BUILD_BASE = "https://build.protomaps.com";

let resolvedDate: string | null = null;
let resolvedAt = 0;
const RESOLVE_TTL_MS = 6 * 60 * 60 * 1000; // 6h 마다 최신 빌드 재확인

function ymd(d: Date): string {
  return (
    d.getUTCFullYear().toString() +
    String(d.getUTCMonth() + 1).padStart(2, "0") +
    String(d.getUTCDate()).padStart(2, "0")
  );
}

/** 최근 14일 중 실제 존재하는 빌드 날짜(YYYYMMDD)를 찾아 캐시. OVERRIDE 시 "static". */
export async function resolveBuildDate(): Promise<string> {
  if (OVERRIDE) return "static";
  const now = Date.now();
  if (resolvedDate && now - resolvedAt < RESOLVE_TTL_MS) return resolvedDate;

  for (let i = 0; i < 14; i++) {
    const date = ymd(new Date(now - i * 86400000));
    try {
      const res = await fetch(`${BUILD_BASE}/${date}.pmtiles`, { headers: { Range: "bytes=0-0" } });
      if (res.status === 206 || res.ok) {
        resolvedDate = date;
        resolvedAt = now;
        return date;
      }
    } catch {
      /* 다음 날짜 시도 */
    }
  }
  throw new Error("사용 가능한 Protomaps 빌드를 찾지 못했습니다");
}

/** 버전(날짜 or "static") → 실제 upstream pmtiles URL. v 는 숫자 8자리만 허용(SSRF 차단). */
export function upstreamUrlForVersion(v: string | null): string | null {
  if (OVERRIDE) return OVERRIDE;
  if (v && /^\d{8}$/.test(v)) return `${BUILD_BASE}/${v}.pmtiles`;
  return null; // 유효한 v 없음 → 호출부에서 resolveBuildDate 로 폴백
}

// Range 조각 캐시(서버 메모리). 서버리스 인스턴스별로 존재.
const cache = new Map<string, { status: number; contentRange: string | null; body: ArrayBuffer }>();
const CACHE_MAX = 1200;

export function cacheGet(key: string) {
  return cache.get(key);
}
export function cacheSet(key: string, val: { status: number; contentRange: string | null; body: ArrayBuffer }) {
  if (cache.size >= CACHE_MAX) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  cache.set(key, val);
}
