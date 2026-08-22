import type { Season } from '@/lib/season';

/**
 * 로고 옆에 붙는 <b>작은</b> 계절 장식.
 *
 * <p>규칙 세 가지를 지킨다.
 *
 * <ol>
 *   <li><b>로고 자체를 고치지 않는다.</b> 바스켓과 워드마크 경로는 그대로 두고, 이 조각만
 *       위에 얹는다. 계절을 끄면 원래 로고가 남는다.
 *   <li><b>라임을 밀어내지 않는다.</b> 장식은 계절색으로 칠하되 크기가 로고의 1/5 이하다.
 *       라임은 여전히 화면에서 가장 강한 색이다.
 *   <li><b>움직이지 않는다.</b> 눈이 내리거나 꽃잎이 떨어지는 것은 값싸 보이는 가장 빠른 길이고,
 *       "움직임 줄이기" 설정과도 싸운다.
 * </ol>
 *
 * <p>모양은 전부 <b>선</b>으로 그렸다. 채워진 도형은 작게 줄이면 뭉개져서 무엇인지 알 수 없다.
 */

/** 계절색 — globals.css 의 --season-tint 와 같은 값이다. SVG 는 rgb() 목록을 못 받는다. */
const TINT: Record<Season, string> = {
  spring: '#e73274', // 브랜드 핑크 — 새 색이 아니라 심볼에 이미 있던 색
  summer: '#22a8a8',
  autumn: '#d67622',
  winter: '#608ac4',
};

interface SeasonMarkProps {
  season: Season;
  className?: string;
}

export function SeasonMark({ season, className }: SeasonMarkProps) {
  const color = TINT[season];
  const stroke = { stroke: color, strokeWidth: 1.6, strokeLinecap: 'round' as const, fill: 'none' };

  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden focusable="false">
      {season === 'spring' && (
        // 벚꽃 — 다섯 장. 꽃잎 하나를 그리고 72도씩 돌린다.
        <g>
          {[0, 72, 144, 216, 288].map((deg) => (
            <path
              key={deg}
              d="M12 12 C 9.6 8.6, 9.6 4.4, 12 3 C 14.4 4.4, 14.4 8.6, 12 12 Z"
              fill={color}
              opacity="0.85"
              transform={`rotate(${deg} 12 12)`}
            />
          ))}
          <circle cx="12" cy="12" r="1.5" fill="#c2f970" />
        </g>
      )}

      {season === 'summer' && (
        // 해 — 가운데 원과 짧은 살. 물방울보다 계절이 분명하게 읽힌다.
        <g>
          <circle cx="12" cy="12" r="4.4" fill={color} opacity="0.9" />
          {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => (
            <line key={deg} x1="12" y1="4.6" x2="12" y2="2" {...stroke} transform={`rotate(${deg} 12 12)`} />
          ))}
        </g>
      )}

      {season === 'autumn' && (
        // 잎 하나. 단풍잎은 이 크기로 줄이면 톱니가 뭉개져 얼룩처럼 보인다.
        <g>
          <path
            d="M12 3 C 5.5 6.5, 4 14, 8.5 19 C 14 17.5, 19 12.5, 18.5 5.5 C 16.5 4, 14 3, 12 3 Z"
            fill={color}
            opacity="0.9"
          />
          <path d="M16.5 6.5 L 8 18.5" stroke="#c2f970" strokeWidth="1.3" strokeLinecap="round" fill="none" />
        </g>
      )}

      {season === 'winter' && (
        // 눈 결정 — 여섯 갈래. 가지 끝의 짧은 갈래가 있어야 별이 아니라 눈으로 읽힌다.
        <g>
          {[0, 60, 120].map((deg) => (
            <g key={deg} transform={`rotate(${deg} 12 12)`}>
              <line x1="12" y1="3" x2="12" y2="21" {...stroke} />
              <line x1="12" y1="6.5" x2="9.4" y2="4.6" {...stroke} strokeWidth="1.2" />
              <line x1="12" y1="6.5" x2="14.6" y2="4.6" {...stroke} strokeWidth="1.2" />
              <line x1="12" y1="17.5" x2="9.4" y2="19.4" {...stroke} strokeWidth="1.2" />
              <line x1="12" y1="17.5" x2="14.6" y2="19.4" {...stroke} strokeWidth="1.2" />
            </g>
          ))}
          <circle cx="12" cy="12" r="1.6" fill="#c2f970" />
        </g>
      )}
    </svg>
  );
}

export { TINT as SEASON_MARK_COLOR };
