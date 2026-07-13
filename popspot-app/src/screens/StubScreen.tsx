import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import Glass from "../components/Glass";
import { colors } from "../theme";

/** 아직 이식 전인 탭의 자리표시. 웹 기능을 다음 턴에 하나씩 옮긴다. */
export default function StubScreen({
  title,
  subtitle,
  icon,
}: {
  title: string;
  subtitle: string;
  icon: keyof typeof Ionicons.glyphMap;
}) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <Glass strong style={styles.card}>
        <View style={styles.iconWrap}>
          <Ionicons name={icon} size={34} color={colors.limeText} />
        </View>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.sub}>{subtitle}</Text>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>곧 나와요</Text>
        </View>
      </Glass>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: "center", justifyContent: "center", padding: 28 },
  card: { width: "100%", maxWidth: 340, alignItems: "center", padding: 32, borderRadius: 26 },
  iconWrap: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: colors.limeSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  title: { color: colors.ink, fontSize: 22, fontWeight: "900", marginTop: 16 },
  sub: { color: colors.ink700, fontSize: 14, textAlign: "center", marginTop: 8 },
  badge: {
    marginTop: 18,
    backgroundColor: colors.lime,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  badgeText: { color: colors.ink, fontSize: 13, fontWeight: "800" },
});
