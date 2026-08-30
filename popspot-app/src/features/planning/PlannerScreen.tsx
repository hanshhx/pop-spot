import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BottomDock, DOCK_INSET } from '@/components/layout/BottomDock';
import { Icon } from '@/components/ui/Icon';
import { PillButton } from '@/components/ui/PillButton';
import { T } from '@/components/ui/Text';
import { Toggle } from '@/components/ui/Toggle';
import { useMyLocation } from '@/features/map/useMyLocation';
import { optimizeRoute, totalWalkMinutes, type RouteStop } from '@/lib/optimizeRoute';
import { walkInfo } from '@/lib/walkGroups';
import { usePlanStore } from '@/store/usePlanStore';
import { useTheme } from '@/theme/ThemeProvider';
import type { RootStackParamList } from '@/types/navigation';

/**
 * 최단 동선 플래너 — 시안 11. 웹 작전지도의 최적화를 단독 화면으로.
 *
 * <p>상단에 <b>현재 / 최적화 후 / 절약</b>을 먼저 보여준다. 버튼을 누르기 전에는 "최적화 후" 가
 * 비어 있다 — 계산하지 않은 값을 미리 적어 두면 그건 예측이 아니라 거짓이다.
 *
 * <p><b>시안에 없는 하단 독을 그린다.</b> 시안은 이 화면에서 독을 숨겼는데, 그러면서 하단 여백을
 * 84px(독이 앉는 높이)로 남겨 두었다. 독이 없으면 이 화면에서 나갈 길이 상단 뒤로가기 하나뿐이고,
 * 그건 독의 "일정" 칸으로 들어온 사람에게 막다른 길이다.
 */

/**
 * 이동 수단.
 *
 * <p><b>도보만 실제로 계산한다.</b> 지하철·차량은 경로 API 가 따로 필요하고(환승 시간표, 도로
 * 통행량), 지금 앱에 있는 것은 직선거리에 도보 보정을 건 {@code walkInfo} 뿐이다. 고를 수는 있게
 * 두되 <b>고르면 그 사실을 말한다</b> — 조용히 도보 숫자를 보여주면 지하철로 20분이라고 믿는다.
 */
const MODES = [
  { key: 'walk', label: '도보' },
  { key: 'transit', label: '도보+지하철' },
  { key: 'car', label: '차량' },
] as const;

type Mode = (typeof MODES)[number]['key'];

export default function PlannerScreen() {
  const { t } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const me = useMyLocation();

  const stops = usePlanStore((s) => s.stops);
  const move = usePlanStore((s) => s.move);
  const remove = usePlanStore((s) => s.remove);
  const replace = usePlanStore((s) => s.replace);

  const [mode, setMode] = useState<Mode>('walk');
  const [useCongestion, setUseCongestion] = useState(true);
  const [useHours, setUseHours] = useState(true);
  /** 최적화한 뒤의 도보 분. 아직 안 눌렀으면 null — 빈 값과 0 은 다르다. */
  const [optimized, setOptimized] = useState<number | null>(null);

  const origin = { lat: me.lat, lng: me.lng };

  const routeStops: RouteStop[] = useMemo(
    () => stops.map((s) => ({ id: s.id, name: s.name, lat: s.lat, lng: s.lng, stayMinutes: 35 })),
    [stops],
  );

  const currentMinutes = useMemo(
    () => totalWalkMinutes(origin, routeStops),
    [origin, routeStops],
  );

  /* 다리(leg)마다의 시간. 목록 사이에 끼워 넣는다. */
  const legs = useMemo(() => {
    let from = origin;
    return routeStops.map((stop) => {
      const leg = walkInfo(from.lat, from.lng, stop.lat, stop.lng);
      from = stop;
      return `도보 ${leg.time}분 · ${leg.dist}`;
    });
  }, [origin, routeStops]);

  const runOptimize = () => {
    const result = optimizeRoute(origin, routeStops, {
      useCongestion,
      useHours,
      departAtMinutes: new Date().getHours() * 60 + new Date().getMinutes(),
    });
    replace(
      result.stops.map((s) => {
        const original = stops.find((x) => x.id === s.id)!;
        return original;
      }),
    );
    setOptimized(result.afterMinutes);
  };

  const saved = optimized === null ? null : Math.max(0, currentMinutes - optimized);

  return (
    <View style={[styles.root, { backgroundColor: t.bg }]}>
      <View style={[styles.head, { backgroundColor: t.sf, borderBottomColor: t.ln, paddingTop: insets.top + 8 }]}>
        <View style={styles.headRow}>
          <Pressable onPress={navigation.goBack} accessibilityLabel="뒤로" style={styles.back}>
            <Icon name="arrowLeft" size={19} color={t.ik} strokeWidth={2.2} />
          </Pressable>
          <T size={16.5} weight={800} em={-0.01} style={styles.grow}>
            최단 동선 플래너
          </T>
          <Pressable
            onPress={() => navigation.navigate('Guide')}
            disabled={stops.length === 0}
            style={[styles.goBtn, { backgroundColor: t.ik, opacity: stops.length === 0 ? 0.4 : 1 }]}
          >
            <T size={12} weight={700} color={t.bg}>
              출발
            </T>
          </Pressable>
        </View>

        <View style={styles.modes}>
          {MODES.map((m) => (
            <Pressable
              key={m.key}
              onPress={() => setMode(m.key)}
              style={[
                styles.mode,
                { borderColor: mode === m.key ? t.l4 : t.ln, backgroundColor: mode === m.key ? t.sft : 'transparent' },
              ]}
            >
              <T size={11.5} weight={700} color={mode === m.key ? t.l7 : t.mu}>
                {m.label}
              </T>
            </Pressable>
          ))}
        </View>
      </View>

      <View style={[styles.stats, { backgroundColor: t.sf, borderBottomColor: t.ln }]}>
        <Stat label="현재 순서" value={`${currentMinutes}분`} bg={t.mp} />
        <Stat
          label="최적화 후"
          value={optimized === null ? '—' : `${optimized}분`}
          bg={optimized === null ? t.mp : t.sft}
          fg={optimized === null ? t.mu : t.l7}
        />
        <Stat
          label="절약"
          value={saved === null ? '계산 전' : saved === 0 ? '이미 최단' : `−${saved}분`}
          bg={t.mp}
          fg={saved ? t.ac : t.mu}
        />
      </View>

      <ScrollView contentContainerStyle={styles.body}>
        {mode !== 'walk' ? (
          <View style={[styles.warn, { backgroundColor: t.sft }]}>
            <Icon name="clock" size={14} color={t.l7} />
            <T size={11.5} color={t.l7} leading={1.5} style={styles.grow}>
              지금 계산은 도보 기준이에요. {MODES.find((m) => m.key === mode)?.label} 경로는 아직
              붙지 않았습니다.
            </T>
          </View>
        ) : null}

        <View style={[styles.origin, { backgroundColor: t.sft }]}>
          <View style={styles.originDot} />
          <T size={12.5} weight={700} style={styles.grow}>
            {me.label}
            {me.fallback ? ' (위치 권한 없음)' : ''}
          </T>
          <T size={10} weight={600} color={t.l7} numeric>
            출발점
          </T>
        </View>

        {stops.length === 0 ? (
          <View style={styles.empty}>
            <Icon name="course" size={28} color={t.mu} strokeWidth={1.8} opacity={0.5} />
            <T size={13.5} weight={700}>
              아직 담은 곳이 없어요
            </T>
            <T size={12} color={t.mu} leading={1.6} style={styles.emptyBody}>
              코스 탭에서 무드를 고르거나, 팝업 상세에서 "코스 추가" 를 누르면 여기에 담깁니다.
            </T>
            <PillButton
              label="코스 탭으로"
              variant="outline"
              height={42}
              fontSize={13}
              onPress={() => navigation.navigate('Course')}
              style={styles.emptyCta}
            />
          </View>
        ) : (
          <View style={styles.list}>
            {stops.map((stop, i) => (
              <View key={stop.id}>
                <View style={[styles.stop, { backgroundColor: t.sf, borderColor: t.ln }]}>
                  <View style={[styles.stopNum, { backgroundColor: t.ik }]}>
                    <T size={11.5} weight={700} color={t.bg} numeric>
                      {i + 1}
                    </T>
                  </View>
                  <View style={styles.grow}>
                    <T size={12.5} weight={700} numberOfLines={1}>
                      {stop.name}
                    </T>
                    <T size={10.5} color={t.mu} dim={0.85} numberOfLines={1}>
                      {stop.location}
                    </T>
                  </View>

                  <View style={styles.arrows}>
                    <Pressable
                      onPress={() => {
                        move(i, -1);
                        setOptimized(null);
                      }}
                      style={[styles.arrow, { backgroundColor: t.mp }]}
                      accessibilityLabel="위로"
                    >
                      <Icon name="chevronUp" size={11} color={t.ik} strokeWidth={3} />
                    </Pressable>
                    <Pressable
                      onPress={() => {
                        move(i, 1);
                        setOptimized(null);
                      }}
                      style={[styles.arrow, { backgroundColor: t.mp }]}
                      accessibilityLabel="아래로"
                    >
                      <Icon name="chevronDown" size={11} color={t.ik} strokeWidth={3} />
                    </Pressable>
                  </View>

                  <Pressable onPress={() => remove(stop.id)} accessibilityLabel="빼기" hitSlop={8}>
                    <Icon name="close" size={14} color={t.mu} opacity={0.6} strokeWidth={2.2} />
                  </Pressable>
                </View>

                {i < stops.length - 1 ? (
                  <View style={styles.legRow}>
                    <View style={[styles.legLine, { backgroundColor: t.ln }]} />
                    <View style={[styles.legTag, { backgroundColor: t.mp }]}>
                      <Icon name="walk" size={11} color={t.mu} strokeWidth={2.4} />
                      <T size={10.5} weight={700} color={t.mu}>
                        {legs[i + 1]}
                      </T>
                    </View>
                  </View>
                ) : null}
              </View>
            ))}
          </View>
        )}

        {stops.length > 0 ? (
          <View style={[styles.flags, { backgroundColor: t.sf, borderColor: t.ln }]}>
            <T size={12.5} weight={800} style={styles.flagsTitle}>
              계산에 반영할 것
            </T>
            <FlagRow
              label="혼잡도 반영"
              desc="대기가 긴 곳을 한가한 시간대로 뒤로 밉니다"
              on={useCongestion}
              onChange={() => {
                setUseCongestion((v) => !v);
                setOptimized(null);
              }}
            />
            <FlagRow
              label="운영시간 반영"
              desc="먼저 닫는 곳을 앞으로 당깁니다. 마감 시각을 모르는 곳은 당기지 않습니다"
              on={useHours}
              onChange={() => {
                setUseHours((v) => !v);
                setOptimized(null);
              }}
              last
            />
          </View>
        ) : null}
      </ScrollView>

      {stops.length > 1 ? (
        <View style={[styles.foot, { backgroundColor: t.sf, borderTopColor: t.ln }]}>
          <PillButton
            label={optimized === null ? '최단 동선으로 재배치' : '다시 최적화'}
            variant="dark"
            icon="zap"
            iconColor={t.l3}
            onPress={runOptimize}
          />
        </View>
      ) : null}

      <BottomDock active="plan" />
    </View>
  );
}

function Stat({ label, value, bg, fg }: { label: string; value: string; bg: string; fg?: string }) {
  const { t } = useTheme();
  return (
    <View style={[styles.stat, { backgroundColor: bg }]}>
      <T size={10} weight={700} color={t.mu} dim={0.7}>
        {label}
      </T>
      <T size={17} weight={800} em={-0.02} color={fg} numeric style={styles.statValue}>
        {value}
      </T>
    </View>
  );
}

function FlagRow({
  label,
  desc,
  on,
  onChange,
  last = false,
}: {
  label: string;
  desc: string;
  on: boolean;
  onChange: () => void;
  last?: boolean;
}) {
  const { t } = useTheme();
  return (
    <View style={[styles.flagRow, { borderBottomColor: last ? 'transparent' : t.ln }]}>
      <View style={styles.grow}>
        <T size={12.5} weight={700}>
          {label}
        </T>
        <T size={11} color={t.mu} dim={0.8} leading={1.45} style={styles.flagDesc}>
          {desc}
        </T>
      </View>
      <Toggle on={on} onChange={onChange} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  grow: { flex: 1 },

  head: { paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1 },
  headRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  back: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  goBtn: { minHeight: 34, paddingHorizontal: 14, borderRadius: 999, justifyContent: 'center' },
  modes: { flexDirection: 'row', gap: 6 },
  mode: { flex: 1, minHeight: 34, borderRadius: 10, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },

  stats: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1 },
  stat: { flex: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10 },
  statValue: { marginTop: 2 },

  body: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: DOCK_INSET + 60 },
  warn: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 12, padding: 11, marginBottom: 12 },

  origin: { flexDirection: 'row', alignItems: 'center', gap: 9, borderRadius: 12, paddingHorizontal: 13, paddingVertical: 11, marginBottom: 12 },
  originDot: { width: 26, height: 26, borderRadius: 13, backgroundColor: '#00a6c4', borderWidth: 3, borderColor: '#fff' },

  empty: { alignItems: 'center', gap: 8, paddingVertical: 48 },
  emptyBody: { textAlign: 'center', paddingHorizontal: 24 },
  emptyCta: { marginTop: 8 },

  list: { gap: 8 },
  stop: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 14, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 11 },
  stopNum: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  arrows: { gap: 4 },
  arrow: { width: 24, height: 20, borderRadius: 6, alignItems: 'center', justifyContent: 'center' },

  legRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingLeft: 14, paddingVertical: 6 },
  legLine: { width: 1, height: 22 },
  legTag: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },

  flags: { borderRadius: 16, borderWidth: 1, paddingHorizontal: 14, marginTop: 14 },
  flagsTitle: { marginTop: 14, marginBottom: 4 },
  flagRow: { flexDirection: 'row', alignItems: 'center', gap: 11, paddingVertical: 12, borderBottomWidth: 1 },
  flagDesc: { marginTop: 2 },

  foot: { position: 'absolute', left: 0, right: 0, bottom: DOCK_INSET - 12, paddingHorizontal: 16, paddingVertical: 10, borderTopWidth: 1 },
});
