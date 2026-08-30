import { NextResponse, type NextRequest } from 'next/server';

import { env } from '@/lib/env';
import {
  APP_FLOW_COOKIE,
  APP_FLOW_COOKIE_MAX_AGE_SECONDS,
  APP_FLOW_COOKIE_PATH,
} from '@/lib/oauthAppFlow';

/**
 * 앱에서 소셜 로그인을 시작하는 자리.
 *
 * <p><b>왜 앱이 백엔드를 직접 열지 않는가.</b> 웹 로그인 버튼은
 * {@code window.location.href = `${API_BASE_URL}/oauth2/authorization/${provider}`} 로 백엔드 호스트를
 * 직접 연다. 앱이 같은 일을 하려면 백엔드 주소를 앱 안에 박아야 하는데, 그건
 * {@code popspot-app/src/lib/env.ts} 가 피하려고 만든 바로 그 상황이다 — VM 이 바뀌면 <b>설치된 앱이
 * 전부 죽고</b> 복구 수단이 스토어 재심사(수일)밖에 없다. 여기로 한 번 들르면 주소가 바뀌어도
 * Vercel 환경변수만 고치면 된다.
 *
 * <p><b>왜 302 인가.</b> 302 는 브라우저가 따라간다 — 이 함수가 백엔드 주소를 <b>해석할 필요가
 * 없다</b>. Vercel 이 ts.net 을 못 푸는 기존 문제({@code app/api/[...path]/route.ts} 주석)는 여기
 * 해당하지 않는다. 우리는 문자열만 만들어 준다.
 *
 * <h3>쿠키 하나가 하는 일</h3>
 *
 * <p>백엔드 {@code OAuth2SuccessHandler} 는 성공하면 {@code app.oauth2.redirect-uri} <b>한 곳으로만</b>
 * 되돌린다(웹 주소). 앱에서 시작했든 웹에서 시작했든 같은 자리로 온다. 그래서 "이 브라우저 흐름은
 * 앱이 시작했다" 를 흐름 내내 들고 다닐 것이 필요하다.
 *
 * <p>{@code SameSite=Lax} 라야 한다. 돌아오는 길이 백엔드 호스트에서 popspot.co.kr 로 오는
 * <b>교차 사이트 최상위 이동</b>인데, Lax 는 그런 GET 이동에 쿠키를 실어 준다({@code Strict} 는 안
 * 실어 주고, 그러면 콜백이 앱에서 온 것을 모른다).
 *
 * <p>값은 앱이 만든 <b>1회용 난수</b>다. 돌아갈 때 그것을 그대로 되돌려 주면 앱이 "내가 시작한
 * 로그인" 임을 확인할 수 있다 — 없으면 남이 만든 딥링크 하나로 피해자가 공격자 계정에 로그인된다.
 * 난수가 없으면(옛 앱) {@code 1} 로 두어 흐름 자체는 되게 한다.
 */

/** 백엔드가 등록해 둔 제공자. 이 밖의 값은 백엔드까지 보내지 않고 여기서 막는다. */
const PROVIDERS = new Set(['kakao', 'naver', 'google']);

/**
 * 난수에 허용하는 모양.
 *
 * <p>이 값은 쿠키에 그대로 들어갔다가 앱으로 되돌아간다. 길이와 문자를 묶어 두지 않으면 쿠키
 * 헤더를 깨뜨리거나 되돌아가는 주소에 이상한 것을 실을 수 있다 — 주소로 들어오는 값은 무엇이든
 * 올 수 있다고 보고 다룬다.
 */
const NONCE_SHAPE = /^[A-Za-z0-9_-]{8,64}$/;

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ provider: string }> },
): Promise<NextResponse> {
  const { provider } = await context.params;

  if (!PROVIDERS.has(provider)) {
    /* 열린 리다이렉트를 만들지 않는다 — provider 를 그대로 주소에 이어 붙이면 임의의 곳으로
       보내는 링크가 된다. 목록에 있는 것만 통과시킨다. */
    return NextResponse.json({ error: 'unknown provider' }, { status: 400 });
  }

  const backend = env.apiUrl.replace(/\/+$/, '');
  /* 빈 값만이 아니라 <b>모양</b>을 본다. 값이 있는데 URL 이 아니면 아래 redirect 가 던져서 이
     경로만 500 으로 죽는데, 빌드는 통과하므로 배포된 뒤에야 드러난다
     ({@code app/service-health/route.ts} 가 같은 방식으로 확인한다). */
  if (!/^https?:\/\//.test(backend)) {
    return NextResponse.json({ error: 'api url not configured' }, { status: 500 });
  }

  const requested = request.nextUrl.searchParams.get('n');
  const nonce = requested && NONCE_SHAPE.test(requested) ? requested : '1';

  const response = NextResponse.redirect(`${backend}/oauth2/authorization/${provider}`, 302);
  response.cookies.set(APP_FLOW_COOKIE, nonce, {
    path: APP_FLOW_COOKIE_PATH,
    maxAge: APP_FLOW_COOKIE_MAX_AGE_SECONDS,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    httpOnly: false,
  });
  /* 이 응답은 쿠키를 새로 심는 자리라 <b>절대 재사용되면 안 된다.</b> 302 는 규격상 명시적
     신선도 정보가 없으면 캐시되지 않지만, 의도를 헤더로 못 박아 두는 편이 싸다. */
  response.headers.set('Cache-Control', 'no-store');
  return response;
}
