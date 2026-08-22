'use server';

import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';

import { SEASON_AUTO, SEASON_COOKIE, parseSeasonSetting } from '@/lib/seasonOverride';

/**
 * 계절을 손으로 고정하거나 자동으로 되돌린다.
 *
 * <p>서버 액션인 이유는 계절이 <b>서버가 그리는 첫 HTML</b> 에 들어가기 때문이다. 브라우저에서
 * {@code document.cookie} 로 세우면 그 다음 이동부터 반영돼, 누른 직후에는 아무 일도 안 일어난
 * 것처럼 보인다.
 *
 * <p>값은 {@link parseSeasonSetting} 으로 걸러 받는다 — 폼에서 온 값을 그대로 쿠키에 넣으면
 * 아무 문자열이나 들어가고, 나중에 읽는 쪽이 모르는 계절을 만난다.
 */
export async function setSeasonOverride(formData: FormData): Promise<void> {
  const requested = String(formData.get('season') ?? '');
  const setting = requested === SEASON_AUTO ? SEASON_AUTO : parseSeasonSetting(requested);

  const store = await cookies();
  if (setting === SEASON_AUTO) {
    store.delete(SEASON_COOKIE);
  } else {
    store.set(SEASON_COOKIE, setting, {
      path: '/',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 365,
    });
  }

  // 배경은 루트 레이아웃이 그린다. 그 위 모든 화면이 다시 그려져야 바뀐 계절이 보인다.
  revalidatePath('/', 'layout');
}
