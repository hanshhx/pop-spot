import { Text as RNText, type TextProps as RNTextProps, type TextStyle } from 'react-native';

import { font, mono, NO_FONT_PADDING, tracking, type FontWeight } from '@/theme/typography';
import { useTokens } from '@/theme/ThemeProvider';

/**
 * 글자 하나 — 시안의 CSS 를 <b>그대로 옮겨 적을 수 있는</b> 모양으로.
 *
 * <p>시안은 {@code font-size:13.5px;font-weight:700;letter-spacing:-.01em} 처럼 적혀 있다. RN 의
 * {@code <Text>} 로 옮기려면 매번 굵기를 폰트 이름으로 바꾸고, em 을 px 로 환산하고, 안드로이드
 * 글자 잘림을 막는 속성을 붙여야 한다. 화면마다 그 세 가지를 손으로 하면 <b>반드시 어딘가 빠진다</b> —
 * 빠진 자리는 굵기가 시스템 폰트로 조용히 떨어져서, 스크린샷을 나란히 놓기 전엔 안 보인다.
 *
 * <p>그래서 시안의 숫자를 그대로 받는다. {@code <T size={13.5} weight={700} em={-0.01}>}.
 */

export interface TextProps extends RNTextProps {
  /** 시안의 {@code font-size}. */
  size?: number;
  /** 시안의 {@code font-weight}. 400·600·700·800 만 실제 파일이 있고 나머지는 가까운 쪽으로 간다. */
  weight?: FontWeight;
  /** 시안의 {@code letter-spacing} (em). px 환산은 여기서 한다. */
  em?: number;
  /** 시안의 {@code line-height} 배수. */
  leading?: number;
  color?: string;
  /** 숫자·라벨용 고정폭({@code JetBrains Mono}). */
  numeric?: boolean;
  /** 시안의 {@code opacity}. 색을 따로 만들지 않고 투명도로 낮추는 자리가 많다. */
  dim?: number;
}

export function T({
  size = 13,
  weight = 400,
  em,
  leading,
  color,
  numeric,
  dim,
  style,
  ...rest
}: TextProps) {
  const t = useTokens();
  const base: TextStyle = {
    ...(numeric ? mono(weight) : font(weight)),
    ...NO_FONT_PADDING,
    fontSize: size,
    color: color ?? t.ik,
  };
  if (em !== undefined) base.letterSpacing = tracking(size, em);
  if (leading !== undefined) base.lineHeight = size * leading;
  if (dim !== undefined) base.opacity = dim;

  return <RNText {...rest} style={[base, style]} />;
}
