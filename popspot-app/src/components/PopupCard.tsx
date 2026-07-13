import { Image } from "expo-image";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { categoryLabel, coverUrl, ddayLabel, regionShort } from "../lib";
import { colors } from "../theme";
import { Popup } from "../types";

/** 프로토타입 룩의 사진 카드 — 이미지 + D-day 배지 + 위시 하트 + 이름/카테고리·지역. */
export default function PopupCard({
  popup,
  onPress,
  width,
}: {
  popup: Popup;
  onPress: () => void;
  width: number;
}) {
  const dday = ddayLabel(popup.endDate);
  const uri = coverUrl(popup);

  return (
    <Pressable style={({ pressed }) => [{ width }, pressed && styles.pressed]} onPress={onPress}>
      <View style={styles.imgWrap}>
        {uri ? (
          <Image source={{ uri }} style={styles.img} contentFit="cover" transition={200} />
        ) : (
          <View style={[styles.img, styles.placeholder]}>
            <Text style={styles.placeholderText}>{categoryLabel(popup.category)}</Text>
          </View>
        )}

        {dday && (
          <View style={[styles.dday, dday.urgent && styles.ddayUrgent]}>
            <Text style={[styles.ddayText, dday.urgent && styles.ddayTextUrgent]}>{dday.text}</Text>
          </View>
        )}

        <View style={styles.heart}>
          <Text style={styles.heartIcon}>♡</Text>
        </View>
      </View>

      <Text style={styles.name} numberOfLines={1}>
        {popup.name}
      </Text>
      <Text style={styles.meta} numberOfLines={1}>
        {categoryLabel(popup.category)} · {regionShort(popup.location)}
      </Text>
    </Pressable>
  );
}

const RADIUS = 18;

const styles = StyleSheet.create({
  pressed: { opacity: 0.85 },
  imgWrap: {
    width: "100%",
    aspectRatio: 1,
    borderRadius: RADIUS,
    overflow: "hidden",
    backgroundColor: "rgba(255,255,255,0.4)",
  },
  img: { width: "100%", height: "100%" },
  placeholder: { alignItems: "center", justifyContent: "center", backgroundColor: colors.limeSoft },
  placeholderText: { color: colors.limeText, fontWeight: "800", fontSize: 15 },
  dday: {
    position: "absolute",
    top: 8,
    left: 8,
    backgroundColor: "rgba(255,255,255,0.9)",
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 3,
  },
  ddayUrgent: { backgroundColor: colors.warn },
  ddayText: { color: colors.ink, fontSize: 11, fontWeight: "800" },
  ddayTextUrgent: { color: "#fff" },
  heart: {
    position: "absolute",
    top: 6,
    right: 8,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "rgba(255,255,255,0.85)",
    alignItems: "center",
    justifyContent: "center",
  },
  heartIcon: { fontSize: 17, color: colors.ink, marginTop: -1 },
  name: { color: colors.ink, fontSize: 14, fontWeight: "800", marginTop: 8 },
  meta: { color: colors.muted, fontSize: 12, marginTop: 2 },
});
