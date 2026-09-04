/**
 * 베이스맵 버전 해석 — /basemap/version 이 쓴다.
 *
 * 핵심: 클라이언트는 지도를 만들기 전에 "지금 서빙 중인 파일의 버전(v)"을 한 번 받고, 모든 타일
 * 요청에 ?v= 를 붙인다. v 가 곧 파일 서명이라, 파일을 갈아끼우면 값이 바뀌어 브라우저 캐시가
 * 자동으로 무효화된다 → 옛 목차와 새 조각이 섞이는 사고를 막는다.
 *
 * 예전엔 타일 라우트도 이 파일의 캐시·URL 생성기를 함께 썼다. 2026-09-04 에 타일 중계를 없애면서
 * 그쪽 코드는 지웠다(파일 끝 주석 참고). 지금 남은 공개 API 는 resolveBuildDate 하나다.
 */

const BUILD_BASE = 'https://build.protomaps.com';

/** 저장소에 동봉한 서울 추출본. public/ 에 있으므로 같은 도메인에서 그대로 서빙된다. */
const BUNDLED_SEOUL = '/seoul.pmtiles';

/**
 * 기본 소스 = 동봉한 서울 파일. 환경변수로 덮어쓸 수 있다.
 *
 * <p>왜 코드에 기본값을 두는가: 예전엔 {@code BASEMAP_PMTILES_URL} 이 없으면 전 세계 planet 빌드
 * (수십 GB)를 원격에서 조금씩 잘라 읽었다. 실측 결과 조각 하나에 0.25~0.83초가 걸렸고, 지도 한 화면을
 * 그리려면 머리말·목차·타일로 여러 번 왕복해야 해서 첫 렌더가 2~4초였다. 게다가 planet 빌드는 매일
 * 파일이 바뀌어(v=20260726) 브라우저 캐시도 하루마다 무효화됐다.
 *
 * <p>환경변수를 "설정하면 빨라지는" 방식으로 두면, 설정을 깜빡했을 때 아무도 모르게 계속 느린 상태로
 * 남는다(실제로 그랬다). 그래서 기본값을 빠른 쪽으로 뒤집고, 환경변수는 예외 상황용으로만 남긴다.
 *
 * <p>서버(Route Handler)에서 fetch 하므로 절대 URL 이 필요하다 — Vercel 이 주입하는 도메인을 쓴다.
 * 로컬 개발은 dev 서버 자신을 가리킨다. 둘 다 못 얻으면 undefined 를 반환해 planet 빌드로 폴백한다.
 */
function bundledSeoulUrl(): string | undefined {
  const prod = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  if (prod) return `https://${prod}${BUNDLED_SEOUL}`;
  const deploy = process.env.VERCEL_URL;
  if (deploy) return `https://${deploy}${BUNDLED_SEOUL}`;
  if (process.env.NODE_ENV !== 'production') {
    return `http://localhost:${process.env.PORT ?? 3000}${BUNDLED_SEOUL}`;
  }
  return undefined;
}

const OVERRIDE = process.env.BASEMAP_PMTILES_URL ?? bundledSeoulUrl();

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

/**
 * 문자열을 짧은 영숫자 토큰으로 (캐시 키 용도라 충돌 저항만 있으면 충분).
 *
 * <p>32비트를 base36 으로 찍으므로 최대 7자다 — 타일 라우트의 {@code sanitizeVersion} 이
 * 통과시키는 모양이 이 길이에 맞춰져 있다.
 */
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

/*
 * 2026-09-04 정리 — 여기 있던 `upstreamUrlForVersion` 과 Range 조각 메모리 캐시(cacheGet/cacheSet,
 * 최대 1200칸)를 지웠다. 타일 라우트가 중계를 그만두고 정적 파일로 넘기면서 호출자가 사라졌다.
 * 남겨 두면 "쓰는 사람 없는데 살아 있는 코드" 가 다시 쌓인다 — 이번 문제의 원인이 정확히 그것이었다.
 *
 * 이 파일의 남은 공개 API 는 `resolveBuildDate` 하나이며, /basemap/version 만 쓴다.
 */
