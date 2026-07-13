import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import Glass from "../components/Glass";
import PopupCard from "../components/PopupCard";
import { fetchPopups } from "../api";
import { ddayCount } from "../lib";
import { colors } from "../theme";
import { Popup, RootStackParamList } from "../types";

/** 마감 임박 순(종료된 것은 뒤로). */
function sortKey(p: Popup): number {
  const d = ddayCount(p.endDate);
  if (d === null) return 99999;
  return d < 0 ? 88888 - d : d;
}

const PAD = 16;
const GAP = 14;
const HEADER_H = 52;

export default function HomeScreen() {
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();

  const [popups, setPopups] = useState<Popup[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      const data = await fetchPopups();
      data.sort((a, b) => sortKey(a) - sortKey(b));
      setPopups(data);
    } catch {
      setError("팝업을 불러오지 못했어요.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const cardW = (width - PAD * 2 - GAP) / 2;
  const topPad = insets.top + HEADER_H + 6;

  return (
    <View style={styles.root}>
      <FlatList
        data={loading ? [] : popups}
        keyExtractor={(p) => String(p.id)}
        numColumns={2}
        columnWrapperStyle={styles.column}
        contentContainerStyle={{ paddingTop: topPad, paddingBottom: insets.bottom + 96 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              load();
            }}
            tintColor={colors.lime}
            progressViewOffset={topPad}
          />
        }
        ListHeaderComponent={<Hero count={popups.length} />}
        renderItem={({ item }) => (
          <PopupCard
            popup={item}
            width={cardW}
            onPress={() => nav.navigate("Detail", { popup: item })}
          />
        )}
        ListEmptyComponent={
          loading ? (
            <View style={styles.center}>
              <ActivityIndicator color={colors.lime} size="large" />
            </View>
          ) : error ? (
            <View style={styles.center}>
              <Text style={styles.err}>{error}</Text>
              <Pressable style={styles.retry} onPress={load}>
                <Text style={styles.retryText}>다시 시도</Text>
              </Pressable>
            </View>
          ) : null
        }
      />

      {/* 글라스 헤더 (오버레이) */}
      <Glass
        strong
        bordered={false}
        intensity={45}
        style={[styles.header, { paddingTop: insets.top, height: insets.top + HEADER_H }]}
      >
        <View style={styles.headerRow}>
          <Text style={styles.logo}>
            POP<Text style={{ color: colors.lime }}>SPOT</Text>
          </Text>
          <View style={styles.headerIcons}>
            <Ionicons name="search" size={22} color={colors.ink} />
            <Ionicons name="notifications-outline" size={22} color={colors.ink} />
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>G</Text>
            </View>
          </View>
        </View>
      </Glass>
    </View>
  );
}

function Hero({ count }: { count: number }) {
  return (
    <View style={styles.hero}>
      <View style={styles.heroBadge}>
        <Text style={styles.heroBadgeText}>오늘의 서울 팝업</Text>
      </View>
      <Text style={styles.heroTitle}>
        지금 서울에 <Text style={{ color: colors.lime }}>{count}개</Text>의{"\n"}팝업이 열렸어요
      </Text>
      <Text style={styles.heroSub}>사진으로 훑어보고, 마음에 드는 팝업을 저장하세요.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  column: { gap: GAP, paddingHorizontal: PAD, marginBottom: 18 },
  center: { alignItems: "center", justifyContent: "center", paddingVertical: 60, gap: 14 },
  err: { color: colors.ink700, fontSize: 14 },
  retry: {
    backgroundColor: colors.lime,
    borderRadius: 999,
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  retryText: { color: colors.ink, fontWeight: "800" },

  header: { position: "absolute", top: 0, left: 0, right: 0, justifyContent: "flex-end" },
  headerRow: {
    height: HEADER_H,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: PAD,
  },
  logo: { fontSize: 20, fontWeight: "900", color: colors.ink, letterSpacing: -0.5 },
  headerIcons: { flexDirection: "row", alignItems: "center", gap: 14 },
  avatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.lime,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { color: colors.ink, fontWeight: "900", fontSize: 13 },

  hero: { paddingHorizontal: PAD, paddingBottom: 18 },
  heroBadge: {
    alignSelf: "flex-start",
    backgroundColor: colors.lime,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  heroBadgeText: { color: colors.ink, fontSize: 12, fontWeight: "800" },
  heroTitle: {
    color: colors.ink,
    fontSize: 27,
    fontWeight: "900",
    lineHeight: 35,
    marginTop: 12,
    letterSpacing: -0.5,
  },
  heroSub: { color: colors.ink700, fontSize: 14, marginTop: 8 },
});
