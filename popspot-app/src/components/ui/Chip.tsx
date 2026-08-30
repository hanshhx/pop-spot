import { Pressable, StyleSheet, View, type ViewStyle } from 'react-native';

import { useTokens } from '@/theme/ThemeProvider';
import { T } from './Text';

/**
 * 칩 하나 — 카테고리·정렬·무드 줄이 전부 이 모양이다.
 *
 * <p>시안은 켜진 칩을 <b>테두리를 덮는 배경</b>으로 그린다({@code position:absolute;inset:-1px}).
 * 웹에서 그렇게 한 이유는 테두리 색을 바꾸면 1px 만큼 글자가 밀리기 때문인데, RN 에서도 같다 —
 * {@code borderWidth} 를 0 과 1 사이에서 바꾸면 안쪽 내용이 흔들린다. 테두리는 늘 두고 배경만
 * 덮는다.
 */

export interface ChipProps {
  label: string;
  /** 라벨 뒤에 붙는 곳수. 시안 홈의 카테고리 칩이 쓴다. */
  count?: number | string;
  on?: boolean;
  onPress?: () => void;
  /** 시안이 칩마다 32·30·38 을 골라 쓴다. */
  height?: number;
  fontSize?: number;
  /** 켜졌을 때의 배경. 기본은 잉크(홈·전체보기), 코스 탭은 라임이다. */
  activeBg?: string;
  activeFg?: string;
  style?: ViewStyle;
}

export function Chip({
  label,
  count,
  on = false,
  onPress,
  height = 32,
  fontSize = 12,
  activeBg,
  activeFg,
  style,
}: ChipProps) {
  const t = useTokens();
  const bg = activeBg ?? t.ik;
  const fg = on ? (activeFg ?? t.bg) : t.mu;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: on }}
      style={[
        styles.chip,
        { height, borderColor: t.ln, backgroundColor: t.sf },
        style,
      ]}
    >
      {on ? <View style={[StyleSheet.absoluteFillObject, styles.fill, { backgroundColor: bg }]} /> : null}
      <T size={fontSize} weight={700} color={fg}>
        {label}
      </T>
      {count !== undefined ? (
        <T size={fontSize - 2} weight={700} color={fg} dim={0.55} numeric>
          {String(count)}
        </T>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 13,
    borderRadius: 999,
    borderWidth: 1,
    overflow: 'hidden',
  },
  /* 시안의 inset:-1px — 테두리까지 덮는다. RN 은 음수 inset 이 잘리므로 overflow:hidden + 꽉 채움. */
  fill: { borderRadius: 999 },
});
