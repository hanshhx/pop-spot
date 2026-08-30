import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Path } from 'react-native-svg';

import { Icon } from '@/components/ui/Icon';
import { PillButton } from '@/components/ui/PillButton';
import { T } from '@/components/ui/Text';
import { useAuth } from '@/features/auth/useAuth';
import { useMyLocation } from '@/features/map/useMyLocation';
import { useStamps } from '@/features/passport/useStamps';
import { fetchWalkRoute, type RouteStep, type WalkRoute } from '@/lib/routing';
import { walkInfo } from '@/lib/walkGroups';
import { usePlanStore } from '@/store/usePlanStore';
import { useTheme } from '@/theme/ThemeProvider';
import type { RootStackParamList } from '@/types/navigation';

/**
 * 길찾기 주행 — 시안 12.
 *
 * <p>상단은 <b>다음 회전 하나</b>, 하단 시트는 <b>다음 목적지</b>. 도보 이동 중에는 화면을 오래 보지
 * 않으므로 큰 숫자(거리)와 큰 아이콘(방향)만 남겼다 — 시안 노트 그대로다.
 *
 * <p>경로는 OSRM 에서 실제로 받아 온다. 도로 이름도 한국어로 온다({@code 연무장9길}). <b>시간만
 * 우리가 다시 센다</b> — 그 서버는 프로필을 무시하고 자동차 속도를 돌려주기 때문이다
 * ({@code lib/routing.ts} 주석).
 *
 * <h3>시안과 다른 칸 하나</h3>
 *
 * <p>시안 하단 시트는 <b>남은 거리 · 도착 예정 · 도착시 대기</b> 셋을 보여준다. 마지막 칸은 예측
 * 모델이 있어야 하는데 없다({@code useWaitReport} 주석). 그 자리에 <b>남은 곳</b>을 넣었다 —
 * 코스를 도는 중이라는 맥락에서 실제로 궁금한 값이고, 우리가 아는 값이다.
 */

/** 스텝을 자동으로 넘기지 않는다 — 실시간 위치 추적은 배터리를 크게 쓰고, 시안도 "다음 안내" 버튼이다. */
export default function GuideScreen() {
  const { t } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const me = useMyLocation();
  const auth = useAuth();
  const stamps = useStamps(auth.userId);

  const stops = usePlanStore((s) => s.stops);
  const remove = usePlanStore((s) => s.remove);

  const target = stops[0];
  const [route, setRoute] = useState<WalkRoute | null>(null);
  const [loading, setLoading] = useState(true);
  const [stepIndex, setStepIndex] = useState(0);

  useEffect(() => {
    if (!target) {
      setLoading(false);
      return;
    }
    let alive = true;
    setLoading(true);
    setStepIndex(0);

    fetchWalkRoute({ lat: me.lat, lng: me.lng }, { lat: target.lat, lng: target.lng })
      .then((next) => {
        if (alive) setRoute(next);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [target?.id, me.lat, me.lng]);

  /* 경로를 못 받으면 직선으로 대신 잰다. 남의 공개 서버라 언제든 막힐 수 있고, 그때 화면이
     통째로 죽으면 안 된다. 거리는 덜 정확해도 방향과 목적지는 그대로 맞다. */
  const fallbackMinutes = target
    ? walkInfo(me.lat, me.lng, target.lat, target.lng).time
    : 0;
  const totalMinutes = route?.minutes ?? fallbackMinutes;
  const totalDistance = route?.distanceM ?? null;

  const steps = route?.steps ?? [];
  const step: RouteStep | null = steps[stepIndex] ?? null;
  const arrived = steps.length > 0 && stepIndex >= steps.length - 1;

  const eta = useMemo(() => {
    const at = new Date(Date.now() + totalMinutes * 60_000);
    const h = at.getHours();
    const m = `${at.getMinutes()}`.padStart(2, '0');
    return `${h < 12 ? '오전' : '오후'} ${h % 12 === 0 ? 12 : h % 12}:${m}`;
  }, [totalMinutes]);

  if (!target) {
    return (
      <View style={[styles.root, styles.center, { backgroundColor: t.bg }]}>
        <Icon name="course" size={28} color={t.mu} strokeWidth={1.8} opacity={0.5} />
        <T size={13.5} weight={700}>
          안내할 목적지가 없어요
        </T>
        <T size={12} color={t.mu} leading={1.6} style={styles.centerBody}>
          코스에 한 곳이라도 담으면 여기서 길을 안내합니다.
        </T>
        <PillButton
          label="코스 담으러 가기"
          variant="outline"
          height={42}
          fontSize={13}
          onPress={() => navigation.navigate('Course')}
          style={styles.centerCta}
        />
      </View>
    );
  }

  return (
    <View style={[styles.root, { backgroundColor: t.mp }]}>
      <RouteMap route={route} />

      <View style={[styles.top, { paddingTop: insets.top + 8 }]}>
        <View style={[styles.turnCard, { backgroundColor: t.ik }]}>
          <View style={[styles.turnIcon, { backgroundColor: t.l3 }]}>
            <Icon name={turnIcon(step?.turn)} size={22} color="#0a0a0a" strokeWidth={2.6} />
          </View>
          <View style={styles.grow}>
            <View style={styles.turnLine}>
              <T size={22} weight={800} em={-0.02} color={t.l3} numeric>
                {loading ? '…' : step ? `${step.distanceM}m` : `${totalDistance ?? ''}m`}
              </T>
              <T size={12} weight={600} color="rgba(245,243,238,.6)">
                {step ? `${step.minutes}분` : `${totalMinutes}분`}
              </T>
            </View>
            <T size={13} weight={600} color="#f5f3ee" numberOfLines={1}>
              {loading
                ? '경로를 받는 중…'
                : step
                  ? step.road || turnText(step.turn)
                  : '경로를 받지 못했어요 · 직선 거리로 안내합니다'}
            </T>
          </View>
          <Pressable onPress={navigation.goBack} accessibilityLabel="안내 종료" style={styles.closeBtn}>
            <Icon name="close" size={15} color="#f5f3ee" strokeWidth={2.2} />
          </Pressable>
        </View>

        {steps.length > 0 ? (
          <View style={styles.dots}>
            {steps.map((_, i) => (
              <View
                key={i}
                style={[styles.dot, { backgroundColor: i <= stepIndex ? t.l3 : 'rgba(245,243,238,.22)' }]}
              />
            ))}
          </View>
        ) : null}
      </View>

      <View style={styles.spacer} />

      <View style={[styles.sheet, { backgroundColor: t.sf, paddingBottom: insets.bottom + 24 }]}>
        <View style={[styles.handle, { backgroundColor: t.ln }]} />

        {arrived ? (
          <View style={styles.arrived}>
            <View style={[styles.arrivedIcon, { backgroundColor: t.l3 }]}>
              <Icon name="check" size={28} color="#0a0a0a" strokeWidth={3} />
            </View>
            <T size={19} weight={800} em={-0.02}>
              도착했어요
            </T>
            <T size={12.5} color={t.mu} style={styles.arrivedSub}>
              {target.name} · 도보 {totalMinutes}분
            </T>
            {stamps.error ? (
              <T size={11.5} color={t.ac} leading={1.5} style={styles.arrivedSub}>
                {stamps.error}
              </T>
            ) : null}
            <View style={styles.arrivedRow}>
              <PillButton
                label={stamps.has(target.id) ? '인증 완료' : '스탬프 받기'}
                icon={stamps.has(target.id) ? 'check' : undefined}
                iconSize={16}
                height={48}
                fontSize={14}
                style={styles.grow}
                onPress={async () => {
                  if (!auth.signedIn) {
                    navigation.navigate('Login');
                    return;
                  }
                  /* 여기서 바로 찍는다 — 도착한 자리에서 인증하는 것이 이 화면의 쓸모다.
                     성공하면 여권으로, 실패하면 사유를 그 자리에 보여준다. */
                  if (await stamps.add(target.id)) navigation.navigate('Passport');
                }}
              />
              <PillButton
                label={stops.length > 1 ? '다음 장소로' : '동선 보기'}
                variant="outline"
                height={48}
                fontSize={13.5}
                style={styles.grow}
                onPress={() => {
                  /* 도착한 곳은 목록에서 뺀다 — 남겨 두면 다음 안내가 같은 자리를 다시 가리킨다. */
                  remove(target.id);
                  if (stops.length <= 1) navigation.navigate('Planner');
                }}
              />
            </View>
          </View>
        ) : (
          <>
            <View style={styles.targetRow}>
              <View style={[styles.targetBadge, { backgroundColor: t.sft }]}>
                <T size={9} weight={700} em={0.08} color={t.l7} numeric>
                  다음 목적지
                </T>
              </View>
            </View>
            <T size={14.5} weight={800} numberOfLines={1}>
              {target.name}
            </T>
            <T size={11.5} color={t.mu} dim={0.85} numberOfLines={1} style={styles.targetSub}>
              {target.location}
            </T>

            <View style={[styles.totals, { borderTopColor: t.ln, borderBottomColor: t.ln }]}>
              <Total label="남은 거리" value={totalDistance === null ? '—' : formatDistance(totalDistance)} />
              <View style={[styles.divider, { backgroundColor: t.ln }]} />
              <Total label="도착 예정" value={eta} highlight />
              <View style={[styles.divider, { backgroundColor: t.ln }]} />
              <Total label="남은 곳" value={`${stops.length}곳`} />
            </View>

            <View style={styles.actions}>
              <PillButton
                label="다음 안내"
                variant="dark"
                icon="arrowRight"
                iconSize={16}
                iconColor={t.l3}
                height={48}
                fontSize={14}
                style={styles.grow}
                disabled={steps.length === 0}
                onPress={() => setStepIndex((i) => Math.min(i + 1, steps.length - 1))}
              />
              <PillButton
                label="동선 보기"
                variant="outline"
                height={48}
                fontSize={13}
                onPress={() => navigation.navigate('Planner')}
              />
            </View>
          </>
        )}
      </View>
    </View>
  );
}

function Total({ label, value, highlight = false }: { label: string; value: string; highlight?: boolean }) {
  const { t } = useTheme();
  return (
    <View style={styles.total}>
      <T size={17} weight={800} em={-0.02} color={highlight ? t.l7 : t.ik} numeric>
        {value}
      </T>
      <T size={10} color={t.mu} dim={0.7} style={styles.totalLabel}>
        {label}
      </T>
    </View>
  );
}

/** 받은 경로를 화면 상자에 펴서 그린다. 없으면 바탕만. */
function RouteMap({ route }: { route: WalkRoute | null }) {
  const { t } = useTheme();
  const W = 392;
  const H = 620;
  const PAD = 60;

  if (!route || route.points.length < 2) {
    return <View style={[StyleSheet.absoluteFillObject, { backgroundColor: t.mp }]} />;
  }

  const lats = route.points.map((p) => p.lat);
  const lngs = route.points.map((p) => p.lng);
  const spanLat = Math.max(Math.max(...lats) - Math.min(...lats), 0.0005);
  const spanLng = Math.max(Math.max(...lngs) - Math.min(...lngs), 0.0005);

  const xy = route.points.map((p) => ({
    x: PAD + ((p.lng - Math.min(...lngs)) / spanLng) * (W - PAD * 2),
    y: PAD + ((Math.max(...lats) - p.lat) / spanLat) * (H - PAD * 2),
  }));
  const path = xy.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  const start = xy[0];
  const end = xy[xy.length - 1];

  return (
    <View style={[StyleSheet.absoluteFillObject, { backgroundColor: t.mp }]}>
      <Svg width="100%" height="100%" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid slice">
        {/* 굵은 밑선 위에 밝은 선 — 어느 바탕에서도 경로가 보이게. */}
        <Path d={path} fill="none" stroke="rgba(10,10,10,.14)" strokeWidth={16} strokeLinecap="round" strokeLinejoin="round" />
        <Path d={path} fill="none" stroke="#00a6c4" strokeWidth={9} strokeLinecap="round" strokeLinejoin="round" />
        <Circle cx={end.x} cy={end.y} r={16} fill={t.ac} />
        <Circle cx={start.x} cy={start.y} r={11} fill="#00a6c4" stroke="#fff" strokeWidth={4} />
      </Svg>
    </View>
  );
}

function turnIcon(turn: RouteStep['turn'] | undefined) {
  if (turn === 'left') return 'turnLeft' as const;
  if (turn === 'right') return 'turnRight' as const;
  if (turn === 'arrive') return 'pin' as const;
  return 'straight' as const;
}

function turnText(turn: RouteStep['turn']): string {
  return {
    left: '좌회전',
    right: '우회전',
    straight: '직진',
    arrive: '목적지 도착',
    depart: '출발',
  }[turn];
}

/** 1km 넘으면 km 로. 시안의 "380m" · "1.2km". */
function formatDistance(metres: number): string {
  return metres < 1000 ? `${metres}m` : `${(metres / 1000).toFixed(1)}km`;
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  grow: { flex: 1 },
  center: { alignItems: 'center', justifyContent: 'center', gap: 8, padding: 24 },
  centerBody: { textAlign: 'center' },
  centerCta: { marginTop: 8 },

  top: { paddingHorizontal: 12 },
  turnCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 18,
    paddingHorizontal: 15,
    paddingVertical: 13,
    shadowColor: '#0a0a0a',
    shadowOpacity: 0.28,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 8 },
    elevation: 10,
  },
  turnIcon: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  turnLine: { flexDirection: 'row', alignItems: 'baseline', gap: 6, marginBottom: 3 },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(245,243,238,.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dots: { flexDirection: 'row', gap: 4, marginTop: 9, marginHorizontal: 4 },
  dot: { flex: 1, height: 3.5, borderRadius: 2 },

  spacer: { flex: 1 },

  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 16,
    paddingTop: 10,
    shadowColor: '#0a0a0a',
    shadowOpacity: 0.14,
    shadowRadius: 30,
    shadowOffset: { width: 0, height: -8 },
    elevation: 12,
  },
  handle: { width: 38, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 12 },

  targetRow: { flexDirection: 'row', marginBottom: 4 },
  targetBadge: { paddingHorizontal: 6, paddingVertical: 3, borderRadius: 5 },
  targetSub: { marginTop: 2 },

  totals: { flexDirection: 'row', gap: 8, paddingVertical: 11, borderTopWidth: 1, borderBottomWidth: 1, marginTop: 12, marginBottom: 12 },
  total: { flex: 1, alignItems: 'center' },
  totalLabel: { marginTop: 1 },
  divider: { width: 1 },

  actions: { flexDirection: 'row', gap: 8 },

  arrived: { alignItems: 'center', paddingTop: 4, paddingBottom: 8 },
  arrivedIcon: { width: 60, height: 60, borderRadius: 30, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  arrivedSub: { marginTop: 5 },
  arrivedRow: { flexDirection: 'row', gap: 8, marginTop: 16, alignSelf: 'stretch' },
});
