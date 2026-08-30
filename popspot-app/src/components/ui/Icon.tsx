import Svg, { Circle, Path, Rect } from 'react-native-svg';

/**
 * 시안이 쓰는 선 아이콘 — path 데이터를 <b>시안에서 그대로</b> 옮긴 것.
 *
 * <p>아이콘 라이브러리(@expo/vector-icons 등)를 쓰지 않는다. 이름이 비슷한 아이콘을 골라 오면
 * 획 굵기와 끝 모양이 미묘하게 달라지고, 그 차이는 20px 짜리 아이콘 열 개가 한 줄에 늘어섰을 때
 * 비로소 보인다 — 그때는 이미 화면 전체에 퍼진 뒤다. 시안에 적힌 좌표를 그대로 쓰면 그럴 일이 없다.
 *
 * <p>웹은 {@code lucide-react} 를 쓴다. 시안의 path 도 lucide 계열이라 모양은 같은 집안이고,
 * 앱에서만 좌표를 직접 드는 것은 <b>RN 에 lucide 가 없어서</b>다(웹 컴포넌트라 DOM 을 그린다).
 */

/** 하나의 도형. 시안이 {@code <path>}·{@code <circle>}·{@code <rect>} 를 섞어 쓰므로 그대로 받는다. */
type Shape =
  | { d: string }
  | { cx: number; cy: number; r: number }
  | { x: number; y: number; w: number; h: number; rx?: number };

/** 아이콘 하나. {@code filled} 인 것은 획이 아니라 면으로 그린다(재생·일시정지·하트). */
interface IconDef {
  shapes: Shape[];
  filled?: boolean;
}

const line = (...ds: string[]): IconDef => ({ shapes: ds.map((d) => ({ d })) });

export const ICONS = {
  /* ── 이동 ── */
  arrowLeft: line('M19 12H5M11 18l-6-6 6-6'),
  arrowRight: line('M5 12h14M13 6l6 6-6 6'),
  chevronRight: line('m9 18 6-6-6-6'),
  chevronDown: line('m6 9 6 6 6-6'),
  chevronUp: line('m6 15 6-6 6 6'),
  close: line('M18 6 6 18M6 6l12 12'),

  /* ── 탭·주요 동작 ── */
  pin: { shapes: [{ d: 'M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z' }, { cx: 12, cy: 10, r: 2.5 }] },
  course: {
    shapes: [
      { cx: 6, cy: 19, r: 3 },
      { cx: 18, cy: 5, r: 3 },
      { d: 'M9 19h4a5 5 0 0 0 0-10H8a5 5 0 0 1 0-10' },
    ],
  },
  calendar: { shapes: [{ d: 'M8 2v4M16 2v4M3 9h18' }, { x: 3, y: 4, w: 18, h: 17, rx: 2 }] },
  user: { shapes: [{ d: 'M20 21a8 8 0 0 0-16 0' }, { cx: 12, cy: 7, r: 4 }] },
  more: line('M5 12h.01M12 12h.01M19 12h.01'),

  /* ── 검색 ── */
  search: { shapes: [{ cx: 11, cy: 11, r: 7 }, { d: 'm21 21-4.3-4.3' }] },
  searchOff: { shapes: [{ cx: 11, cy: 11, r: 7 }, { d: 'm21 21-4.3-4.3M8.5 8.5l5 5M13.5 8.5l-5 5' }] },

  /* ── 지도 ── */
  map: line('m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3zM9 3v15M15 6v15'),
  locate: { shapes: [{ cx: 12, cy: 12, r: 3 }, { d: 'M12 2v3M12 19v3M2 12h3M19 12h3' }] },
  refresh: line('M21 12a9 9 0 1 1-6.2-8.6', 'M21 3v6h-6'),
  navigate: line('M3 11 22 2l-9 19-2-8-8-2Z'),
  compass: line('M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20M16.2 7.8l-2.2 6.4-6.4 2.2z'),
  walk: line('M13 4a1 1 0 1 0 0-.1M11 20l1-6-3-3 1-5 3 3 3 1M9 14l-2 6'),
  /* 길찾기 회전 안내. 시안은 ↰ ↑ ↱ 글자를 썼는데, 글꼴마다 모양이 크게 달라 44px 칸에서 어떤
     기기는 화살표가 아니라 네모로 보인다. 좌표로 그린다. */
  turnLeft: line('M10 6 5 11l5 5', 'M20 18v-3a4 4 0 0 0-4-4H5'),
  turnRight: line('m14 6 5 5-5 5', 'M4 18v-3a4 4 0 0 1 4-4h12'),
  straight: line('M12 20V5', 'M6 11l6-6 6 6'),
  zap: line('m13 2-9 12h7l-1 8 9-12h-7z'),

  /* ── 상태 ── */
  check: line('M4 12.5 9.5 18 20 6.5'),
  checkAll: line('m2 13 4 4 8-9M12 17l2 2 8-9'),
  bell: line('M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9', 'M13.7 21a2 2 0 0 1-3.4 0'),
  clock: { shapes: [{ cx: 12, cy: 12, r: 9 }, { d: 'M12 7v5l3.5 2' }] },
  message: line('M21 11.5a8.4 8.4 0 0 1-9 8.4 9 9 0 0 1-3.9-.9L3 21l1.9-5.1A8.4 8.4 0 0 1 12 3a8.4 8.4 0 0 1 9 8.5z'),

  /* ── 입력 ── */
  mail: { shapes: [{ x: 2, y: 4, w: 20, h: 16, rx: 2 }, { d: 'm2 7 10 6 10-6' }] },
  lock: { shapes: [{ x: 4, y: 11, w: 16, h: 10, rx: 2 }, { d: 'M8 11V7a4 4 0 0 1 8 0v4' }] },
  eye: { shapes: [{ d: 'M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7Z' }, { cx: 12, cy: 12, r: 3 }] },
  eyeOff: line(
    'M3 3l18 18M10.6 10.6a3 3 0 0 0 4.2 4.2M6.5 6.7C4 8.3 2 12 2 12s3.6 7 10 7c2 0 3.7-.6 5.2-1.5M21.5 15.3C22.6 13.8 22 12 22 12s-3.6-7-10-7',
  ),
  edit: line('M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z'),

  /* ── 상세 ── */
  share: line('M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7M12 3v12M8 7l4-4 4 4'),
  heart: line('M12 20s-7-4.6-7-9.4A4 4 0 0 1 12 7a4 4 0 0 1 7 3.6C19 15.4 12 20 12 20Z'),
  bookmark: line('M4 4h16v13l-8 4-8-4Z', 'M9 10h6'),
  grid: {
    shapes: [
      { x: 3, y: 3, w: 7, h: 7, rx: 1.5 },
      { x: 14, y: 3, w: 7, h: 7, rx: 1.5 },
      { x: 3, y: 14, w: 7, h: 7, rx: 1.5 },
      { x: 14, y: 14, w: 7, h: 7, rx: 1.5 },
    ],
  },

  /* ── 음악 · 여권 ── */
  music: line('M10 18V5l11-2v13', 'M7 21a3 3 0 1 0 0-6 3 3 0 0 0 0 6M18 19a3 3 0 1 0 0-6 3 3 0 0 0 0 6'),
  ticket: line('M4 5h16v5a2 2 0 0 0 0 4v5H4v-5a2 2 0 0 0 0-4Z', 'M12 8v8'),
  dice: { shapes: [{ x: 3, y: 3, w: 18, h: 18, rx: 3 }, { d: 'M8 8h.01M16 8h.01M8 16h.01M16 16h.01M12 12h.01' }] },
  sun: line('M12 4V2M12 22v-2M4 12H2M22 12h-2M6 6 4.5 4.5M19.5 19.5 18 18M6 18l-1.5 1.5M19.5 4.5 18 6M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10'),

  /* ── 면으로 그리는 것 ── */
  play: { shapes: [{ d: 'M8 5v14l11-7Z' }], filled: true },
  pause: { shapes: [{ x: 6, y: 5, w: 4, h: 14, rx: 1 }, { x: 14, y: 5, w: 4, h: 14, rx: 1 }], filled: true },
} satisfies Record<string, IconDef>;

export type IconName = keyof typeof ICONS;

export interface IconProps {
  name: IconName;
  size?: number;
  color?: string;
  /** 획 굵기. 시안이 아이콘마다 1.8~3.6 을 골라 쓰므로 부르는 쪽이 정한다. */
  strokeWidth?: number;
  /**
   * 면을 채운다. 하트처럼 <b>같은 아이콘이 상태에 따라</b> 비었다 찼다 하는 경우에 쓴다
   * (찜 버튼). 기본은 각 아이콘의 정의를 따른다.
   */
  fill?: string;
  opacity?: number;
}

export function Icon({ name, size = 20, color = 'currentColor', strokeWidth = 2, fill, opacity }: IconProps) {
  const def: IconDef = ICONS[name];
  const solid = def.filled === true;

  /* 면 아이콘은 획을 그리지 않고, 선 아이콘은 면을 칠하지 않는다. fill 을 넘기면 선 아이콘도
     안쪽이 찬다 — 찜한 하트가 그 경우다. */
  const common = solid
    ? { fill: fill ?? color, stroke: 'none' as const }
    : {
        fill: fill ?? 'none',
        stroke: color,
        strokeWidth,
        strokeLinecap: 'round' as const,
        strokeLinejoin: 'round' as const,
      };

  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" opacity={opacity}>
      {def.shapes.map((shape, i) => {
        if ('d' in shape) return <Path key={i} d={shape.d} {...common} />;
        if ('r' in shape) return <Circle key={i} cx={shape.cx} cy={shape.cy} r={shape.r} {...common} />;
        return (
          <Rect key={i} x={shape.x} y={shape.y} width={shape.w} height={shape.h} rx={shape.rx} {...common} />
        );
      })}
    </Svg>
  );
}
