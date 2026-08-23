'use client';

import { useEffect } from 'react';

import { SEASON_COOKIE, isSeason } from '@/lib/season';

/**
 * 주소의 {@code ?season=autumn} 으로 계절을 갈아 끼운다. <b>개발 환경 전용</b>이다.
 *
 * <p>4계절 × 라이트/다크 = 8조합을 한자리에서 봐야 하는데, 그게 없으면 겨울 화면을 보려고
 * 12월까지 기다려야 한다.
 *
 * <h3>운영에서는 동작하지 않는다</h3>
 *
 * <p>운영에서 살려두면 주소만 아는 사람 누구나 계절을 바꿀 수 있고, 그 값이 쿠키에 1년 남는다.
 * 링크가 공유되면 받은 사람도 의도치 않은 계절로 들어간다 — 운영이 보여줄 계절은 관리자가
 * 정한 것과 월 자동, 둘뿐이어야 한다. {@code NODE_ENV} 비교는 빌드 시점에 접히므로 운영
 * 번들에는 이 코드가 아예 들어가지 않는다.
 *
 * <p>배포된 사이트에서 계절을 바꿔 봐야 한다면 관리자 화면의 계절 테마 패널을 쓴다. 그쪽은
 * 로그인 뒤에 있으므로 아무나 못 건드린다.
 *
 * <p>{@code useSearchParams()} 대신 {@code location.search} 를 읽는다 — 이 컴포넌트는 루트
 * 레이아웃에 있어서, 훅을 쓰면 앱 전체가 동적 렌더로 끌려 내려간다(Suspense 경계 요구 포함).
 * 어차피 마운트 후 한 번만 필요한 값이라 훅을 쓸 이유가 없다.
 */
export default function SeasonQueryOverride() {
  useEffect(() => {
    if (process.env.NODE_ENV === 'production') return;

    const requested = new URLSearchParams(window.location.search).get('season');
    if (!isSeason(requested)) return;
    if (document.documentElement.dataset.season === requested) return;

    document.documentElement.dataset.season = requested;
    // 값은 쿠키에도 적어 둔다. 그래야 다음 요청부터는 서버가 계절을 실어 보내고 색이 튀지
    // 않는다 — 이 컴포넌트의 즉시 반영은 그 한 번의 왕복을 메우는 용도다.
    document.cookie = `${SEASON_COOKIE}=${requested}; path=/; max-age=31536000; samesite=lax`;
  }, []);

  return null;
}
