import type { NextRequest } from 'next/server';

import { APP_RETURN_SCHEME } from '@/lib/oauthAppFlow';

/**
 * 소셜 로그인 결과가 앱으로 돌아가는 문.
 *
 * <p>이 주소는 <b>두 가지로 열린다</b>:
 *
 * <ul>
 *   <li><b>App Links 가 검증된 기기</b> — 안드로이드가 이 페이지를 <b>열지 않고</b> 앱에 바로 넘긴다.
 *       커스텀 스킴과 달리 다른 앱이 가로챌 수 없다({@code .well-known/assetlinks.json}).
 *   <li><b>그 밖</b> — 브라우저가 이 페이지를 열고, 여기서 {@code popspot://} 로 넘긴다. 지금 깔린
 *       빌드에는 아직 인텐트 필터가 없어서 <b>전부 이 경로</b>다.
 * </ul>
 *
 * <p>그래서 다음 네이티브 빌드가 나가면 <b>앱도 웹도 고칠 것이 없다</b> — 같은 주소가 저절로 더
 * 안전한 길로 바뀐다.
 *
 * <h3>왜 페이지가 아니라 라우트 핸들러인가</h3>
 *
 * <p>Next 페이지로 만들면 여기에 오는 데 클라이언트 번들이 전부 내려와야 한다(실측 1.16MB).
 * 여기서 할 일은 <b>주소 하나로 넘기는 것</b>뿐이라 1KB 짜리 HTML 이면 충분하고, 그만큼 앱이 빨리
 * 열린다 — 교환 코드는 60초짜리다.
 *
 * <p>{@code 302 Location: popspot://…} 로 하지 않는 이유는, 스킴 리다이렉트를 막는 브라우저에서
 * <b>빈 오류 페이지</b>만 남기 때문이다. 사람이 누를 수 있는 버튼을 함께 그려 둔다.
 */

export const dynamic = 'force-dynamic';

/** 넘길 수 있는 값. 주소로 들어오는 것은 무엇이든 올 수 있으므로 아는 것만 통과시킨다. */
const PASS_THROUGH = ['code', 'error', 'n'] as const;

/** 값의 모양. 교환 코드는 UUID, 난수는 영숫자, 오류는 짧은 낱말이다. */
const VALUE_SHAPE = /^[A-Za-z0-9_-]{1,120}$/;

function escapeHtml(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string,
  );
}

export async function GET(request: NextRequest): Promise<Response> {
  const params = new URLSearchParams();
  for (const key of PASS_THROUGH) {
    const value = request.nextUrl.searchParams.get(key);
    if (value && VALUE_SHAPE.test(value)) params.set(key, value);
  }
  const query = params.toString();
  const target = query ? `${APP_RETURN_SCHEME}?${query}` : APP_RETURN_SCHEME;
  const safe = escapeHtml(target);

  /* 인라인 스크립트는 CSP 의 script-src 'self' 'unsafe-inline' 안에 든다(next.config.ts).
     제스처 없이 스킴으로 넘기는 것을 막는 브라우저가 있어, 넘기기 전에 화면을 먼저 그린다. */
  const html = `<!doctype html>
<html lang="ko"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex">
<title>팝스팟으로 돌아가는 중</title>
<style>
:root{color-scheme:dark}
body{margin:0;min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:18px;
background:#0a0a0a;color:#f5f3ee;font:600 15px/1.6 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;text-align:center;padding:24px}
a{display:inline-block;background:#c2f970;color:#0a0a0a;text-decoration:none;padding:14px 28px;border-radius:999px;font-weight:800}
p{margin:0;color:rgba(245,243,238,.6);font-weight:500;font-size:13px}
</style></head><body>
<div>팝스팟으로 돌아가는 중…</div>
<a id="go" href="${safe}">앱 열기</a>
<p>앱이 열리지 않으면 위 버튼을 눌러 주세요.</p>
<script>setTimeout(function(){location.href=document.getElementById('go').href},120)</script>
</body></html>`;

  return new Response(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      /* 교환 코드가 담긴 주소다. 어디에도 남기지 않는다. */
      'Cache-Control': 'no-store',
    },
  });
}
