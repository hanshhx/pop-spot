'use client';

import { useEffect } from 'react';

import { SEASON_COOKIE, isSeason } from '@/lib/season';

/**
 * 주소의 {@code ?season=autumn} 으로 계절을 갈아 끼운다. QA·디자인 리뷰 전용이다.
 *
 * <p>4계절 × 라이트/다크 = 8조합을 한자리에서 봐야 하는데, 그게 없으면 겨울 화면을 보려고
 * 12월까지 기다려야 한다.
 *
 * <p>{@code useSearchParams()} 대신 {@code location.search} 를 읽는다 — 이 컴포넌트는 루트
 * 레이아웃에 있어서, 훅을 쓰면 앱 전체가 동적 렌더로 끌려 내려간다(Suspense 경계 요구 포함).
 * 어차피 마운트 후 한 번만 필요한 값이라 훅을 쓸 이유가 없다.
 *
 * <p>값은 쿠키에도 적어 둔다. 그래야 다음 요청부터는 <b>서버가</b> 계절을 실어 보내고 색이
 * 튀지 않는다 — 이 컴포넌트가 하는 즉시 반영은 그 한 번의 왕복을 메우는 용도다.
 */
export default function SeasonQueryOverride() {
  useEffect(() => {
    const requested = new URLSearchParams(window.location.search).get('season');
    if (!isSeason(requested)) return;
    if (document.documentElement.dataset.season === requested) return;

    document.documentElement.dataset.season = requested;
    // 1년. 리뷰용이라 만료를 짧게 둘 이유가 없고, 관리자 화면에서 언제든 자동으로 되돌린다.
    document.cookie = `${SEASON_COOKIE}=${requested}; path=/; max-age=31536000; samesite=lax`;
  }, []);

  return null;
}
