import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";

import { categoryLabel, ddayLabel } from "../lib";
import { colors } from "../theme";
import { RootStackParamList } from "../types";

type Props = NativeStackScreenProps<RootStackParamList, "Detail">;

export default function DetailScreen({ route }: Props) {
  const { popup } = route.params;
  const dday = ddayLabel(popup.endDate);

  const openInMaps = () => {
    const { latitude: lat, longitude: lng, name, location } = popup;
    const url =
      lat && lng
        ? `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`
        : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
            `${name} ${location ?? ""}`,
          )}`;
    Linking.openURL(url);
  };

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <View style={styles.badgeRow}>
        <View style={styles.catBadge}>
          <Text style={styles.catText}>{categoryLabel(popup.category)}</Text>
        </View>
        {dday && (
          <View style={[styles.dday, dday.urgent && styles.ddayUrgent]}>
            <Text style={[styles.ddayText, dday.urgent && styles.ddayTextUrgent]}>{dday.text}</Text>
          </View>
        )}
      </View>

      <Text style={styles.name}>{popup.name}</Text>

      <View style={styles.infoCard}>
        <InfoRow label="위치" value={popup.location ?? "위치 정보 없음"} />
        <InfoRow
          label="기간"
          value={`${popup.startDate ?? "?"}  ~  ${popup.endDate ?? "?"}`}
        />
        <InfoRow label="카테고리" value={categoryLabel(popup.category)} />
      </View>

      <Pressable style={({ pressed }) => [styles.mapBtn, pressed && styles.mapBtnPressed]} onPress={openInMaps}>
        <Text style={styles.mapBtnText}>지도 앱에서 위치 보기 →</Text>
      </Pressable>

      <Text style={styles.hint}>실시간 정보·사진은 popspot.co.kr 에서 더 볼 수 있어요.</Text>
    </ScrollView>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: 20, paddingBottom: 40 },
  badgeRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 },
  catBadge: {
    backgroundColor: colors.limeSoft,
    borderRadius: 999,
    paddingHorizontal: 11,
    paddingVertical: 4,
  },
  catText: { color: "#4d7c0f", fontSize: 13, fontWeight: "800" },
  dday: { backgroundColor: "#f5f5f4", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  ddayUrgent: { backgroundColor: "#fff1e6" },
  ddayText: { color: colors.muted, fontSize: 13, fontWeight: "800" },
  ddayTextUrgent: { color: colors.warn },
  name: { color: colors.ink, fontSize: 24, fontWeight: "900", lineHeight: 32 },
  infoCard: {
    backgroundColor: colors.card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 4,
    marginTop: 20,
  },
  infoRow: {
    flexDirection: "row",
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  infoLabel: { width: 72, color: colors.muted, fontSize: 14 },
  infoValue: { flex: 1, color: colors.ink, fontSize: 14, fontWeight: "600" },
  mapBtn: {
    backgroundColor: colors.lime,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 20,
  },
  mapBtnPressed: { opacity: 0.85 },
  mapBtnText: { color: colors.ink, fontSize: 16, fontWeight: "800" },
  hint: { color: colors.muted, fontSize: 12, textAlign: "center", marginTop: 16 },
});
