'use client';

import { SEASON_COPY } from '@/lib/season';
import { useSeason } from '@/lib/seasonContext';

/**
 * 로고 옆에 상주하는 작은 계절 태그.
 *
 * <p>다섯 신호 중 유일하게 사계절 내내 떠 있는 것이다. 전환 배너가 2주 뒤 접히고 나면 "지금이
 * 무슨 계절인지" 를 말해 주는 게 이것만 남는다.
 *
 * <p>작게 두는 것이 요점이다. {@code --s-hi} 는 만채도라 넓게 쓰면 배경이 되고, 배경이 되면
 * 다시 안 보인다. 이 배지가 만채도로 <b>채워져도</b> 되는 이유는 면적이 이만큼 작기 때문이다.
 *
 * <p>글자를 {@code --s-hi} 로, 면을 투명하게 두는 쪽을 먼저 시도했다가 되돌렸다 — 밝은 배경 위
 * 만채도 글자는 여덟 팔레트 중 대부분이 AA 에 못 미친다. 채우고 {@code --s-hi-fg} 를 얹으면
 * 사계절 모두 통과한다.
 */
export function SeasonBadge({ className = '' }: { className?: string }) {
  const season = useSeason();
  const copy = SEASON_COPY[season];

  return (
    <span
      className={`items-center rounded-pill px-2 py-0.5 font-mono text-[10px] font-extrabold tracking-[0.1em] ${className}`}
      style={{ background: 'var(--s-hi)', color: 'var(--s-hi-fg)' }}
    >
      {copy.upper}
    </span>
  );
}
