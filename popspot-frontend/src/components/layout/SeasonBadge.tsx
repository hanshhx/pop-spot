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
 * <p>다만 '작게' 는 절대 크기가 아니라 <b>옆에 선 로고와의 비율</b>이다. 한 벌로 두었더니
 * 로고가 24px 인 폰에서는 알맞고, 56px 인 데스크톱에서는 로고 높이의 1/5 도 안 되는 부스러기로
 * 보였다 — 사계절 내내 떠 있는 유일한 신호가 눈에 안 들어오면 없는 것과 같다. 그래서 넓은
 * 화면에서만 한 단 키운다. 그래도 화면에서 차지하는 면적은 1% 아래라 만채도 규칙은 그대로다.
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
      className={`items-center rounded-pill px-2 py-0.5 font-mono text-[10px] font-extrabold tracking-[0.1em] md:px-3 md:py-1 md:text-sm md:tracking-[0.14em] ${className}`}
      style={{ background: 'var(--s-hi)', color: 'var(--s-hi-fg)' }}
    >
      {copy.upper}
    </span>
  );
}
