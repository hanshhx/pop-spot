'use client';

import { useEffect, useState } from 'react';

import { seasonOf, type Season } from '@/lib/season';
import { parseSeasonSetting } from '@/lib/seasonOverride';

/**
 * 지금 화면에 적용된 계절.
 *
 * <p>날짜로 다시 계산하지 않고 <b>서버가 정해 둔 값</b>({@code <html data-season>})을 읽는다.
 * 관리자가 계절을 고정해 두었을 수 있는데, 그것은 쿠키에 있고 쿠키는 서버만 본다. 여기서
 * 날짜로 다시 계산하면 관리자가 겨울로 고정해 둬도 배경 영상만 여름이 된다.
 *
 * <p>첫 값은 날짜 기준이다 — 서버 HTML 과 맞춰 두기 위해서다. 실제 값은 마운트 직후 DOM 에서
 * 읽어 바로잡는다. 이 훅을 쓰는 곳(배경 영상)은 어차피 마운트 뒤에야 그려지므로 깜빡이지 않는다.
 */
export function useSeason(): Season {
  const [season, setSeason] = useState<Season>(() => seasonOf());

  useEffect(() => {
    const fromDom = document.documentElement.dataset.season;
    const parsed = parseSeasonSetting(fromDom);
    // 'auto' 는 계절이 아니다 — 속성이 비었거나 모르는 값일 때다. 그때는 날짜를 그대로 쓴다.
    if (parsed !== 'auto') setSeason(parsed);
  }, []);

  return season;
}
