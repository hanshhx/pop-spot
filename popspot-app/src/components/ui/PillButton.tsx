import { Pressable, StyleSheet, View, type ViewStyle } from 'react-native';

import { useTokens } from '@/theme/ThemeProvider';
import { Icon, type IconName } from './Icon';
import { T } from './Text';

/**
 * 알약 버튼 — 시안의 주 동작이 전부 이 모양이다(로그인·길찾기·최적화·스탬프 받기).
 *
 * <p>세 가지로 갈린다. {@code primary} 는 라임 면, {@code dark} 는 잉크 면, {@code outline} 은
 * 테두리만. 시안이 한 화면에 primary 하나만 두는 규칙을 지키고 있어서(길찾기 옆의 코스 추가는
 * outline), 그 규칙이 코드에서도 보이도록 이름을 나눴다.
 */

export type PillVariant = 'primary' | 'dark' | 'outline';

export interface PillButtonProps {
  label: string;
  onPress?: () => void;
  variant?: PillVariant;
  /** 시안이 44·46·48·50·52 를 골라 쓴다. */
  height?: number;
  fontSize?: number;
  icon?: IconName;
  iconSize?: number;
  /** 아이콘 색을 글자와 다르게 줄 때 — 잉크 버튼 위의 라임 번개가 그 경우다. */
  iconColor?: string;
  /** 시안이 라임 버튼에만 다는 그림자. */
  glow?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
  children?: React.ReactNode;
}

export function PillButton({
  label,
  onPress,
  variant = 'primary',
  height = 50,
  fontSize = 14.5,
  icon,
  iconSize = 18,
  iconColor,
  glow = false,
  disabled = false,
  style,
  children,
}: PillButtonProps) {
  const t = useTokens();

  const bg = variant === 'primary' ? t.l3 : variant === 'dark' ? t.ik : 'transparent';
  const fg = variant === 'primary' ? t.hif : variant === 'dark' ? t.bg : t.ik;

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.pill,
        { minHeight: height, backgroundColor: bg, opacity: disabled ? 0.5 : pressed ? 0.85 : 1 },
        variant === 'outline' && { borderWidth: 1.5, borderColor: t.ln, backgroundColor: t.sf },
        /* 시안: box-shadow:0 4px 14px rgba(168,230,69,.35) — 상세의 길찾기 버튼만 이 빛을 갖는다. */
        glow && {
          shadowColor: t.l4,
          shadowOpacity: 0.35,
          shadowRadius: 14,
          shadowOffset: { width: 0, height: 4 },
          elevation: 6,
        },
        style,
      ]}
    >
      {children}
      {icon ? <Icon name={icon} size={iconSize} color={iconColor ?? fg} strokeWidth={2.3} /> : null}
      <T size={fontSize} weight={800} color={fg}>
        {label}
      </T>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    paddingHorizontal: 18,
    borderRadius: 999,
  },
});

/** 시안이 카드 면을 그릴 때 늘 쓰는 조합 — 흰 면 + 1px 선 + 큰 라운드. */
export function Card({ children, radius = 16, padding = 14, style }: {
  children: React.ReactNode;
  radius?: number;
  padding?: number;
  style?: ViewStyle;
}) {
  const t = useTokens();
  return (
    <View
      style={[
        { backgroundColor: t.sf, borderColor: t.ln, borderWidth: 1, borderRadius: radius, padding },
        style,
      ]}
    >
      {children}
    </View>
  );
}
