/**
 * 베이스맵 프록시 공용 로직 — /basemap(타일)과 /basemap/version(버전) 이 공유.
 *
 * 핵심: pmtiles 일별 planet 빌드는 매일 파일이 바뀐다(청크 오프셋도 바뀜). 그래서 클라이언트는
 * /basemap/version 으로 "지금 서버가 서빙할 빌드 날짜(v)"를 한 번 받고, 모든 타일 요청에 ?v=날짜
 * 를 붙인다. 서버는 그 날짜 파일을 그대로 서빙하므로 (v = 불변 파일) 장기 immutable 캐시가 안전하다.
 * → 브라우저가 타일을 재요청하지 않아 지도가 빨라지고, 빌드 롤오버로 바이트가 섞이는 일도 없다.
 */

export const OVERRIDE = process.env.BASEMAP_PMTILES_URL; // 설정 시 서울 정적 파일(롤오버 없음)
export const BUILD_BASE = 'https://build.protomaps.com';

let resolvedDate: string | null = null;
let resolvedAt = 0;
const RESOLVE_TTL_MS = 6 * 60 * 60 * 1000; // 6h 마다 최신 빌드 재확인

function ymd(d: Date): string {
  return (
    d.getUTCFullYear().toString() +
    String(d.getUTCMonth() + 1).padStart(2, '0') +
    String(d.getUTCDate()).padStart(2, '0')
  );
}

/** 문자열을 짧은 영숫자 토큰으로 (캐시 키 용도라 충돌 저항만 있으면 충분). */
function shortHash(s: string): string {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(36);
}

/**
 * 최근 14일 중 실제 존재하는 빌드 날짜(YYYYMMDD)를 찾아 캐시.
 *
 * <p>OVERRIDE(서울 정적 파일)일 때는 상수 "static" 을 쓰면 안 된다 — 타일 응답에 1주 immutable
 * 캐시가 걸리는데 버전이 영원히 그대로면, 운영자가 같은 URL 에 파일을 갈아끼웠을 때 브라우저·서버
 * 캐시의 옛 조각과 새 조각이 섞여 pmtiles 오프셋이 깨진다(?v= 를 도입한 이유가 바로 그 사고 방지).
 * 그래서 파일의 ETag/Last-Modified 로 버전을 만든다 → 파일을 바꾸면 v 가 바뀌어 캐시가 자동 무효화된다.
 */
export async function resolveBuildDate(): Promise<string> {
  const now = Date.now();
  if (OVERRIDE) {
    if (resolvedDate && now - resolvedAt < RESOLVE_TTL_MS) return resolvedDate;
    let tag = 'static';
    try {
      const res = await fetch(OVERRIDE, { headers: { Range: 'bytes=0-0' } });
      const sig = res.headers.get('etag') ?? res.headers.get('last-modified');
      if (sig) tag = 's' + shortHash(sig);
    } catch {
      /* 서명을 못 얻으면 상수로 폴백 — 최소한 동작은 유지 */
    }
    resolvedDate = tag;
    resolvedAt = now;
    return tag;
  }
  if (resolvedDate && now - resolvedAt < RESOLVE_TTL_MS) return resolvedDate;

  for (let i = 0; i < 14; i++) {
    const date = ymd(new Date(now - i * 86400000));
    try {
      const res = await fetch(`${BUILD_BASE}/${date}.pmtiles`, { headers: { Range: 'bytes=0-0' } });
      if (res.status === 206 || res.ok) {
        resolvedDate = date;
        resolvedAt = now;
        return date;
      }
    } catch {
      /* 다음 날짜 시도 */
    }
  }
  throw new Error('사용 가능한 Protomaps 빌드를 찾지 못했습니다');
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
export function cacheSet(
  key: string,
  val: { status: number; contentRange: string | null; body: ArrayBuffer },
) {
  if (cache.size >= CACHE_MAX) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  cache.set(key, val);
}
