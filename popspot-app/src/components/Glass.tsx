import { BlurView } from "expo-blur";
import { ReactNode } from "react";
import { StyleSheet, View, ViewStyle } from "react-native";

import { colors } from "../theme";

/**
 * 글라스(반투명 블러) 컨테이너 — 웹의 backdrop-blur 대응. 배경 영상이 은은히 비쳐 보인다.
 * {@code strong} 은 헤더/탭바처럼 가독성이 더 필요한 곳에.
 */
export default function Glass({
  children,
  style,
  intensity = 28,
  strong = false,
  bordered = true,
}: {
  children?: ReactNode;
  style?: ViewStyle | ViewStyle[];
  intensity?: number;
  strong?: boolean;
  bordered?: boolean;
}) {
  return (
    <BlurView intensity={intensity} tint="light" style={[styles.base, style]}>
      <View
        style={[
          StyleSheet.absoluteFill,
          { backgroundColor: strong ? colors.glassStrong : colors.glass },
          bordered && styles.border,
        ]}
      />
      {children}
    </BlurView>
  );
}

const styles = StyleSheet.create({
  base: { overflow: "hidden" },
  border: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.glassBorder,
    borderRadius: 22,
  },
});
