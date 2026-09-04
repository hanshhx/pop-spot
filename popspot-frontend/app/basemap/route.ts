/**
 * 베이스맵 타일 경로 — 이제 중계하지 않고 정적 파일로 넘긴다.
 *
 * <p>예전엔 이 핸들러가 pmtiles 조각을 직접 중계했다(원본 fetch → arrayBuffer → 메모리 캐시).
 * 지금 지도는 웹·앱 모두 {@code /seoul.pmtiles} 를 직접 부르므로(`mapStyle.ts` 의 basemapTileUrl,
 * 커밋 350c2e2) <b>이 경로에는 정상 호출자가 없다</b>. 그런데 공개 핸들러라 밖에서는 부를 수 있었고,
 * 중계 구조 때문에 요청 하나가 최대 4MB 다운로드 + 메모리 캐시 한 칸이 됐다. 게다가
 * {@code OVERRIDE} 가 있으면 URL 결정에서 {@code v} 를 무시하는데 <b>캐시 키에는 검증 없이
 * 들어가서</b>, {@code ?v=아무값} 이면 매번 캐시 미스 → 매번 새 다운로드였다.
 *
 * <p>그래서 중계를 없앤다. 이 함수는 이제 아무것도 내려받지 않으므로 <b>원본 다운로드·버퍼링·
 * 메모리 캐시에서 오던 자원 고갈 경로가 통째로 사라진다</b> — 상한을 조이는 것과 다르다.
 *
 * <p>삭제가 아니라 리다이렉트인 이유: 설치된 구버전 앱이 아직 이 주소를 쓸 가능성이 남아 있다.
 * 리다이렉트면 그 클라이언트도 따라가서 같은 파일을 받으므로 <b>지도가 죽지 않는다</b>.
 * 실제 삭제는 전달한 빌드가 이 경로를 안 쓴다는 것을 확인한 뒤에 한다.
 *
 * <p>⚠️ {@code /api/*} 는 next.config rewrites 로 백엔드에 넘어가므로, 이 라우트는 일부러
 * {@code /basemap} 에 둔다.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
// 서울 유저 근처에서 실행(왕복 지연 ↓). 플랜이 리전 지정을 막으면 무시된다.
export const preferredRegion = ['icn1'];

/**
 * 넘겨 줄 정적 파일. <b>같은 출처의 상대 경로</b>라 목적지가 밖으로 샐 수 없다.
 *
 * <p>{@code OVERRIDE}(절대 URL, 환경변수 유래)를 쓰지 않는 이유가 이것이다 — 그러면 환경변수
 * 하나가 리다이렉트 목적지를 바꾸는 구조가 된다.
 */
const STATIC_PMTILES = '/seoul.pmtiles';

/** 한 번에 요청할 수 있는 최대 바이트. 중계는 없어졌지만 기존 계약을 그대로 지킨다. */
const MAX_RANGE_BYTES = 4 * 1024 * 1024;

/** `bytes=start-end` 단일 범위만 허용하고 길이를 상한으로 제한. 그 외(다중·열린·suffix)는 거부. */
function parseRange(range: string): { ok: true } | { ok: false; reason: string } {
  const m = /^bytes=(\d+)-(\d+)$/.exec(range.trim());
  if (!m) return { ok: false, reason: 'single closed byte range required' };
  const start = Number(m[1]);
  const end = Number(m[2]);
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || end < start) {
    return { ok: false, reason: 'invalid range bounds' };
  }
  if (end - start + 1 > MAX_RANGE_BYTES) return { ok: false, reason: 'range too large' };
  return { ok: true };
}

/**
 * 클라이언트가 보낸 {@code v} 중 <b>우리가 발급할 수 있는 모양</b>만 통과시킨다.
 *
 * <p>{@code v} 는 파일 서명이라 브라우저·CDN 의 캐시 키가 된다. 우리가 발급하지 않은 값을 그대로
 * 넘기면 같은 파일 하나에 대해 서로 다른 캐시 항목이 무한히 생긴다 — 중계할 때 서버 메모리에서
 * 나던 문제가 캐시 계층으로 자리만 옮기는 셈이다.
 *
 * <p>발급 가능한 모양은 {@code resolveBuildDate()} 가 만드는 세 가지뿐이다:
 * {@code "static"}(서명을 못 얻은 폴백), {@code "s" + 32비트 해시의 base36}, 8자리 날짜.
 */
export function sanitizeVersion(v: string | null): string | null {
  if (!v) return null;
  return /^(static|s[0-9a-z]{1,7}|\d{8})$/.test(v) ? v : null;
}

/**
 * 넘길 주소. 모양이 성한 {@code v} 는 <b>보존한다</b> — 파일을 갈아끼우면 값이 바뀌어 브라우저
 * 캐시가 자동 무효화되는 장치라, 여기서 떼면 구클라이언트가 옛 목차와 새 조각을 섞게 된다.
 */
export function redirectTargetFor(v: string | null): string {
  const safe = sanitizeVersion(v);
  return safe ? `${STATIC_PMTILES}?v=${encodeURIComponent(safe)}` : STATIC_PMTILES;
}

export async function GET(req: Request): Promise<Response> {
  const range = req.headers.get('range') ?? '';
  // Range 없는 요청은 그대로 거부한다. 중계가 없어져 우리 메모리가 터지지는 않지만, 이 경로가
  // 56MB 통짜 내려받기의 두 번째 문이 될 이유가 없다.
  if (!range) {
    return new Response('Range header required', {
      status: 416,
      headers: { 'Accept-Ranges': 'bytes' },
    });
  }
  const checked = parseRange(range);
  if (!checked.ok) {
    return new Response(checked.reason, { status: 416, headers: { 'Accept-Ranges': 'bytes' } });
  }

  const v = new URL(req.url).searchParams.get('v');

  // 307 인 이유가 둘이다. (1) "요청을 그대로 다시 보내라" 를 명시해 Range 가 보존된다.
  // (2) 영구가 아니라 임시라, 나중에 이 경로를 지울 때 브라우저에 굳은 리다이렉트가 안 남는다.
  // no-store 도 같은 이유다 — 리다이렉트 자체를 캐시에 남기지 않는다.
  return new Response(null, {
    status: 307,
    headers: {
      Location: redirectTargetFor(v),
      'Cache-Control': 'no-store',
    },
  });
}
