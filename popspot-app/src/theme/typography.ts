import { Platform, type TextStyle } from 'react-native';

/**
 * 글꼴 — 시안의 {@code font-weight} 를 실제 파일 이름으로 바꾼다.
 *
 * <p>웹에서는 Wanted Sans <b>가변 폰트</b> 한 벌이 300~900 을 전부 낸다. RN 에서는 그렇게 안 된다 —
 * 안드로이드는 {@code fontFamily} 와 {@code fontWeight} 를 함께 주면 굵기를 무시하고, 시스템 폰트로
 * 조용히 떨어진다. 굵기마다 <b>다른 이름의 파일</b>을 지정해야 한다.
 *
 * <p>그래서 화면 코드는 {@code fontWeight} 대신 {@link font} 를 부른다. 시안에서 옮겨 적을 때
 * 숫자를 그대로 쓸 수 있게 인자도 CSS 와 같은 숫자로 받는다.
 *
 * <p>네 벌만 넣었다. 한글 폰트는 한 벌이 2.3MB라 굵기 하나가 곧 2.3MB다 — 시안이 실제로 쓰는 것은
 * 400·600·700·800 이고, 스플래시의 300(시계 숫자)은 400 으로 받는다. 300 한 벌을 위해 2.3MB 를
 * 더 싣는 것은 그 화면이 2초 보이는 것에 비해 비싸다.
 */

/** {@code app.json} 의 expo-font 목록과 이름이 같아야 한다. */
export const FONTS = {
  400: 'WantedSans-Regular',
  600: 'WantedSans-SemiBold',
  700: 'WantedSans-Bold',
  800: 'WantedSans-ExtraBold',
} as const;

export type FontWeight = 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900;

/** 시안의 굵기 → 실제로 있는 네 벌 중 하나. */
function nearest(weight: FontWeight): keyof typeof FONTS {
  if (weight < 500) return 400;
  if (weight <= 600) return 600;
  if (weight <= 700) return 700;
  return 800;
}

/**
 * 굵기 하나를 스타일로.
 *
 * <p>{@code fontWeight} 를 <b>함께 주지 않는다.</b> 주면 안드로이드가 합성 굵기를 덧씌워 이미
 * 굵은 파일이 뭉개지고, iOS 는 무시한다. 굵기는 파일 이름이 전부 말한다.
 */
export function font(weight: FontWeight = 400): TextStyle {
  return { fontFamily: FONTS[nearest(weight)] };
}

/**
 * 숫자·라벨용 고정폭 — 시안의 {@code ui-monospace,'JetBrains Mono',monospace}.
 *
 * <p>남은 거리·대기 분·페이지 번호처럼 <b>바뀌는 숫자</b>에 쓴다. 비례폭이면 4가 1로 바뀔 때
 * 칸이 흔들려서, 1초마다 갱신되는 길찾기 화면이 계속 움찔거린다.
 */
export const MONO = {
  400: 'JetBrainsMono_400Regular',
  700: 'JetBrainsMono_700Bold',
} as const;

export function mono(weight: FontWeight = 400): TextStyle {
  return { fontFamily: weight >= 600 ? MONO[700] : MONO[400] };
}

/**
 * 자간. 시안이 {@code letter-spacing:-.02em} 처럼 em 으로 적은 것을 px 로 바꾼다 — RN 은 em 을
 * 모르고 {@code letterSpacing} 이 절대값이다.
 */
export function tracking(fontSize: number, em: number): number {
  return fontSize * em;
}

/**
 * 안드로이드 글자가 위아래로 잘리는 것을 막는다.
 *
 * <p>안드로이드는 글꼴에 적힌 여백까지 넣어 줄 높이를 잡는데, Wanted Sans 는 한글 폰트라 그 여백이
 * 크다. 시안처럼 {@code line-height:1.2} 를 좁게 준 제목에서 받침이 잘린다. iOS 에는 이 속성이
 * 없어서 플랫폼을 나눈다.
 */
export const NO_FONT_PADDING: TextStyle = Platform.select({
  android: { includeFontPadding: false },
  default: {},
}) as TextStyle;
