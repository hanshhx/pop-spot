import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";

import { fetchMarkers } from "../api";
import { categoryLabel, ddayCount, ddayLabel, regionShort } from "../lib";
import { colors } from "../theme";
import { Marker, RootStackParamList } from "../types";

type Props = NativeStackScreenProps<RootStackParamList, "List">;

/** 마감 임박 순 정렬 키. 종료된 것(음수)은 큰 값으로 밀어 맨 뒤로. */
function sortKey(m: Marker): number {
  const d = ddayCount(m.endDate);
  if (d === null) return 99999;
  return d < 0 ? 88888 + -d : d;
}

export default function ListScreen({ navigation }: Props) {
  const [popups, setPopups] = useState<Marker[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      const data = await fetchMarkers();
      data.sort((a, b) => sortKey(a) - sortKey(b));
      setPopups(data);
    } catch {
      setError("팝업을 불러오지 못했어요. 잠시 후 다시 시도해주세요.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    load();
  }, [load]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.lime} size="large" />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.errText}>{error}</Text>
        <Pressable style={styles.retry} onPress={load}>
          <Text style={styles.retryText}>다시 시도</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <FlatList
      data={popups}
      keyExtractor={(p) => String(p.id)}
      contentContainerStyle={styles.listContent}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.lime} />
      }
      ListHeaderComponent={
        <Text style={styles.count}>
          진행 중 <Text style={styles.countNum}>{popups.length}</Text>곳 · 마감 임박 순
        </Text>
      }
      renderItem={({ item }) => (
        <PopupCard popup={item} onPress={() => navigation.navigate("Detail", { popup: item })} />
      )}
    />
  );
}

function PopupCard({ popup, onPress }: { popup: Marker; onPress: () => void }) {
  const dday = ddayLabel(popup.endDate);
  return (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
      onPress={onPress}
    >
      <View style={styles.cardTop}>
        <View style={styles.badgeRow}>
          <View style={styles.catBadge}>
            <Text style={styles.catText}>{categoryLabel(popup.category)}</Text>
          </View>
          <Text style={styles.region}>{regionShort(popup.location)}</Text>
        </View>
        {dday && (
          <View style={[styles.dday, dday.urgent && styles.ddayUrgent]}>
            <Text style={[styles.ddayText, dday.urgent && styles.ddayTextUrgent]}>{dday.text}</Text>
          </View>
        )}
      </View>
      <Text style={styles.name} numberOfLines={2}>
        {popup.name}
      </Text>
      {(popup.startDate || popup.endDate) && (
        <Text style={styles.period}>
          {popup.startDate ?? "?"} ~ {popup.endDate ?? "?"}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  errText: { color: colors.muted, fontSize: 14, textAlign: "center", marginBottom: 14 },
  retry: {
    backgroundColor: colors.lime,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 999,
  },
  retryText: { color: colors.ink, fontWeight: "800" },
  listContent: { padding: 16, paddingBottom: 32 },
  count: { color: colors.muted, fontSize: 13, marginBottom: 12 },
  countNum: { color: colors.ink, fontWeight: "800" },
  card: {
    backgroundColor: colors.card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    marginBottom: 12,
  },
  cardPressed: { opacity: 0.7 },
  cardTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  badgeRow: { flexDirection: "row", alignItems: "center", gap: 8, flexShrink: 1 },
  catBadge: {
    backgroundColor: colors.limeSoft,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  catText: { color: "#4d7c0f", fontSize: 12, fontWeight: "800" },
  region: { color: colors.muted, fontSize: 12 },
  dday: {
    backgroundColor: "#f5f5f4",
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 3,
  },
  ddayUrgent: { backgroundColor: "#fff1e6" },
  ddayText: { color: colors.muted, fontSize: 12, fontWeight: "800" },
  ddayTextUrgent: { color: colors.warn },
  name: { color: colors.ink, fontSize: 17, fontWeight: "800", marginTop: 10, lineHeight: 23 },
  period: { color: colors.muted, fontSize: 12, marginTop: 6 },
});
