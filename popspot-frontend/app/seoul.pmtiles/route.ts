/**
 * 지도 베이스맵 타일 파일을 <b>중계</b>한다. 같은 출처로 내보내는 것이 전부의 이유다.
 *
 * <p><b>왜 파일을 저장소에 안 두는가.</b> 56.2 MB 다. Cloudflare Workers 의 정적 자산은
 * <b>파일당 25 MiB</b> 가 한도라(무료·유료 동일) 올라가지 않는다. {@code public/} 에 두면
 * 호스팅이 배포마다 한 벌씩 보관하는 문제도 있었다 — 2026-09-19 Vercel 의 Deployment Storage 가
 * 10GB 한도에 53.43GB 로 차서 배포가 정지됐고, 배포 수(약 640)와 파일 크기의 곱이 그 값과 맞았다.
 *
 * <p><b>왜 브라우저가 원본을 직접 안 받는가.</b> GitHub 릴리스 자산은 Range 를 완벽히 지원하지만
 * ({@code 206} + {@code Accept-Ranges}) <b>{@code Access-Control-Allow-Origin} 을 주지 않는다</b>
 * (2026-09-19 실측). 브라우저의 {@code pmtiles://} 는 교차 출처 fetch 라 그대로는 차단된다.
 * 게다가 최종 주소가 만료되는 서명 토큰을 달고 있어 고정 주소로 쓸 수도 없다.
 *
 * <p>서버끼리의 fetch 에는 CORS 가 없다. 그래서 여기서 받아 같은 출처로 내보낸다. 그러면
 * <b>주소가 예전 그대로</b>라 웹도 앱({@code popspot-app} 이 {@code popspot.co.kr/seoul.pmtiles}
 * 를 문자열로 들고 있다)도 고칠 것이 없다.
 *
 * <p><b>Range 를 그대로 넘긴다.</b> pmtiles 는 머리말·목차·타일을 조각으로 읽는 형식이라
 * Range 가 보존되지 않으면 매번 56MB 를 받는다.
 */

/** 원본. 환경변수로 갈아끼울 수 있다 — 나중에 R2 로 옮겨도 코드는 그대로다. */
const UPSTREAM =
  process.env.BASEMAP_UPSTREAM_URL ??
  'https://github.com/hanshhx/pop-spot/releases/download/basemap-seoul-20260919/seoul.pmtiles';

/**
 * 1년 불변. 파일을 갈아끼우면 {@code ?v=} 가 바뀌어 캐시가 자동 무효화된다
 * ({@code /basemap/version} 이 그 서명을 발급한다).
 *
 * <p>이 헤더가 중요한 이유가 하나 더 있다 — 엣지가 이 응답을 캐시하면 <b>원본까지 가는 횟수</b>가
 * 줄고, 그만큼 Worker 호출도 준다. 무료 한도(10만 요청/일)를 지키는 장치이기도 하다.
 */
const CACHE = 'public, max-age=31536000, immutable';

export async function GET(req: Request): Promise<Response> {
  const range = req.headers.get('range');

  const upstream = await fetch(UPSTREAM, {
    // Range 가 없으면 통짜로 받는다. 막지 않는 이유는 이 주소가 이제 <b>정본</b>이기 때문이다 —
    // 옛 /basemap 은 보조 경로라 거부해도 됐지만 여기서 거부하면 지도가 아예 안 뜬다.
    headers: range ? { Range: range } : {},
    // 엣지 캐시에 태운다. 같은 조각을 여러 사람이 볼 때 원본까지 가지 않는다.
    cf: { cacheEverything: true, cacheTtl: 31536000 },
  } as RequestInit);

  if (!upstream.ok && upstream.status !== 206) {
    // 원본이 죽었을 때 지도만 조용히 비는 것보다, 상태를 그대로 넘겨 화면이 알아채게 둔다.
    return new Response(`basemap upstream ${upstream.status}`, {
      status: upstream.status === 404 ? 502 : upstream.status,
      headers: { 'Cache-Control': 'no-store' },
    });
  }

  const headers = new Headers({
    'Content-Type': 'application/octet-stream',
    'Accept-Ranges': 'bytes',
    'Cache-Control': CACHE,
  });
  // 조각 응답의 경계는 원본이 정한 값을 그대로 옮겨야 한다. 여기서 다시 계산하면
  // 오프셋이 한 바이트만 어긋나도 pmtiles 목차가 깨진다.
  for (const h of ['content-range', 'content-length', 'etag', 'last-modified']) {
    const v = upstream.headers.get(h);
    if (v) headers.set(h, v);
  }

  return new Response(upstream.body, { status: upstream.status, headers });
}

/**
 * HEAD 도 받는다. MapLibre Native(앱)가 크기를 먼저 물어보는 구현이 있어서다.
 * 본문 없이 같은 헤더만 돌려준다.
 */
export async function HEAD(req: Request): Promise<Response> {
  const res = await GET(req);
  return new Response(null, { status: res.status, headers: res.headers });
}
