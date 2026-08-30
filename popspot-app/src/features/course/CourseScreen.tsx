import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Path, Text as SvgText } from 'react-native-svg';

import { BottomDock, DOCK_INSET } from '@/components/layout/BottomDock';
import { Chip } from '@/components/ui/Chip';
import { Icon } from '@/components/ui/Icon';
import { PillButton } from '@/components/ui/PillButton';
import { T } from '@/components/ui/Text';
import { openPopups, usePopups } from '@/features/popup/usePopups';
import { useMyLocation } from '@/features/map/useMyLocation';
import { MOODS } from '@/lib/moods';
import { kstTodayStart } from '@/lib/popupSlices';
import { usePlanStore } from '@/store/usePlanStore';
import { useTheme } from '@/theme/ThemeProvider';
import type { RootStackParamList } from '@/types/navigation';
import { buildCourse, durationText, type Course } from './buildCourse';

/**
 * 코스 — 시안 10.
 *
 * <p><b>시안의 "AI가 동선을 계산하는 중…" 로딩은 없앴다.</b> 두 가지 이유다. 첫째, 여기서 AI 를
 * 부르지 않는다({@code buildCourse} 주석). 둘째, 계산이 <b>즉시 끝난다</b> — 목록이 이미 메모리에
 * 있어서 서버를 부르지 않는다. 있지도 않은 기다림을 1.1초 동안 연출하면, 나중에 진짜로 느려졌을 때
 * 사용자는 그것을 알아채지 못한다.
 */
export default function CourseScreen() {
  const { t } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { popups } = usePopups();
  const me = useMyLocation();
  const replacePlan = usePlanStore((s) => s.replace);

  const [moodId, setMoodId] = useState<string | null>(null);

  const today = useMemo(() => kstTodayStart(), []);
  const open = useMemo(() => openPopups(popups, today), [popups, today]);

  const course = useMemo(() => {
    const mood = MOODS.find((m) => m.id === moodId);
    if (!mood) return null;
    return buildCourse(open, mood, { lat: me.lat, lng: me.lng });
  }, [open, moodId, me.lat, me.lng]);

  return (
    <View style={[styles.root, { backgroundColor: t.bg }]}>
      <ScrollView contentContainerStyle={[styles.body, { paddingTop: insets.top + 16 }]}>
        <T size={21} weight={800} em={-0.02}>
          오늘 무드로 코스 짜기
        </T>
        <T size={12.5} color={t.mu} leading={1.5} style={styles.lead}>
          무드를 고르면 지금 열려 있는 {open.length.toLocaleString()}곳에서 가까운 순으로 묶어
          동선을 짭니다.
        </T>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.moods}>
          {MOODS.map((m) => (
            <Chip
              key={m.id}
              label={m.label}
              height={38}
              fontSize={13}
              on={moodId === m.id}
              activeBg={t.l3}
              activeFg={t.hif}
              onPress={() => setMoodId(m.id)}
            />
          ))}
        </ScrollView>

        {moodId === null ? (
          <View style={[styles.idle, { borderColor: t.ln }]}>
            <View style={[styles.idleIcon, { backgroundColor: t.sft }]}>
              <Icon name="course" size={26} color={t.l7} strokeWidth={1.9} />
            </View>
            <T size={13.5} weight={700}>
              무드를 하나 골라 주세요
            </T>
            <T size={12} color={t.mu} leading={1.6} style={styles.idleBody}>
              무드에 맞는 분야를 고르고, 내 위치에서 가장 짧은 순서로 묶습니다.
            </T>
          </View>
        ) : course === null ? (
          <View style={[styles.idle, { borderColor: t.ln }]}>
            <Icon name="searchOff" size={26} color={t.mu} strokeWidth={1.8} opacity={0.5} />
            <T size={13.5} weight={700}>
              이 무드로 묶을 곳이 부족해요
            </T>
            <T size={12} color={t.mu} leading={1.6} style={styles.idleBody}>
              좌표가 있는 팝업이 두 곳은 있어야 동선을 그릴 수 있어요. 다른 무드를 골라 보세요.
            </T>
          </View>
        ) : (
          <CourseCard
            course={course}
            fallbackOrigin={me.fallback}
            originLabel={me.label}
            onOpen={(id) => navigation.navigate('Detail', { id })}
            onSave={() => {
              replacePlan(
                course.stops.map((s) => ({
                  id: s.id,
                  name: s.name,
                  lat: s.lat,
                  lng: s.lng,
                  location: s.popup.location,
                })),
              );
            }}
            onPlan={() => {
              /* 플래너는 이 목록을 이어받아 손으로 순서를 바꾸고 다시 최적화한다. */
              replacePlan(
                course.stops.map((s) => ({
                  id: s.id,
                  name: s.name,
                  lat: s.lat,
                  lng: s.lng,
                  location: s.popup.location,
                })),
              );
              navigation.navigate('Planner');
            }}
          />
        )}
      </ScrollView>

      <BottomDock active="course" />
    </View>
  );
}

function CourseCard({
  course,
  fallbackOrigin,
  originLabel,
  onOpen,
  onPlan,
  onSave,
}: {
  course: Course;
  fallbackOrigin: boolean;
  originLabel: string;
  onOpen: (id: number) => void;
  onPlan: () => void;
  onSave: () => void;
}) {
  const { t } = useTheme();
  const [saved, setSaved] = useState(false);

  return (
    <View style={[styles.card, { backgroundColor: t.sf, borderColor: t.ln }]}>
      <View style={[styles.forYou, { backgroundColor: t.l3 }]}>
        <T size={9.5} weight={700} em={0.1} color={t.hif} numeric>
          FOR YOU
        </T>
      </View>

      <T size={19} weight={800} em={-0.02}>
        <T size={19} weight={800} color={t.ac}>
          {course.mood.label}
        </T>{' '}
        코스
      </T>
      <T size={12} color={t.mu} style={styles.cardMeta}>
        {course.stops.length}곳 · 도보 {course.walkMinutes}분 · 총 {durationText(course.totalMinutes)}
      </T>

      <RouteMap course={course} />

      <View>
        {course.stops.map((stop, i) => (
          <View key={stop.id} style={styles.stopRow}>
            <View style={styles.stopRail}>
              <View style={[styles.stopNum, { backgroundColor: t.ik }]}>
                <T size={12} weight={700} color={t.bg} numeric>
                  {i + 1}
                </T>
              </View>
              {i < course.stops.length - 1 ? (
                <View style={[styles.stopLine, { backgroundColor: t.ln }]} />
              ) : null}
            </View>

            <Pressable onPress={() => onOpen(stop.id)} style={styles.stopBody}>
              <View style={[styles.stopCard, { backgroundColor: t.mp }]}>
                <View style={styles.stopHead}>
                  <T size={13.5} weight={800} numberOfLines={1} style={styles.grow}>
                    {stop.name}
                  </T>
                  <Icon name="arrowRight" size={14} color={t.mu} opacity={0.6} strokeWidth={2.2} />
                </View>
                <T size={12} color={t.mu} numberOfLines={1}>
                  {stop.popup.location}
                </T>
                <View style={styles.stopTags}>
                  <View style={[styles.tag, { backgroundColor: t.sf, borderColor: t.ln }]}>
                    <T size={9.5} weight={700} color={t.mu}>
                      체류 {stop.stayMinutes}분
                    </T>
                  </View>
                  <View style={[styles.tag, { backgroundColor: t.sft, borderColor: 'transparent' }]}>
                    <T size={9.5} weight={700} color={t.l7}>
                      {i === 0 ? `${originLabel}에서 ` : ''}
                      {stop.legText}
                    </T>
                  </View>
                </View>
              </View>
            </Pressable>
          </View>
        ))}
      </View>

      {fallbackOrigin ? (
        <T size={11} color={t.mu} dim={0.8} leading={1.5} style={styles.originNote}>
          위치 권한이 없어 {originLabel}에서 출발하는 것으로 계산했어요.
        </T>
      ) : null}

      <PillButton label="최단 동선으로 다듬기" icon="zap" iconSize={17} height={48} fontSize={14} onPress={onPlan} style={styles.cta} />
      <PillButton
        label={saved ? '일정에 담김' : '내 코스로 저장'}
        icon={saved ? 'check' : 'bookmark'}
        iconSize={15}
        variant="outline"
        height={44}
        fontSize={13}
        onPress={() => {
          onSave();
          setSaved(true);
        }}
      />
    </View>
  );
}

/**
 * 코스 미니 지도.
 *
 * <p>{@code MapCanvas} 를 쓰지 않는다 — 저건 화면을 채우는 배경이고, 여기 필요한 것은 <b>네 점의
 * 상대 위치</b>다. 좌표를 카드 안 상자에 그대로 펴서 순서만 보이게 한다.
 */
function RouteMap({ course }: { course: Course }) {
  const { t } = useTheme();
  const W = 340;
  const H = 190;
  const PAD = 30;

  const lats = course.stops.map((s) => s.lat);
  const lngs = course.stops.map((s) => s.lng);
  const spanLat = Math.max(Math.max(...lats) - Math.min(...lats), 0.001);
  const spanLng = Math.max(Math.max(...lngs) - Math.min(...lngs), 0.001);

  const points = course.stops.map((s) => ({
    x: PAD + ((s.lng - Math.min(...lngs)) / spanLng) * (W - PAD * 2),
    y: PAD + ((Math.max(...lats) - s.lat) / spanLat) * (H - PAD * 2),
  }));

  const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');

  return (
    <View style={[styles.map, { backgroundColor: t.mp, borderColor: t.ln }]}>
      <Svg width="100%" height="100%" viewBox={`0 0 ${W} ${H}`}>
        <Path d={path} fill="none" stroke={t.l5} strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" strokeDasharray="14 8" />
        {points.map((p, i) => (
          <Circle key={`c${i}`} cx={p.x} cy={p.y} r={13} fill={i === points.length - 1 ? t.ac : t.ik} />
        ))}
        {points.map((p, i) => (
          <SvgText key={`n${i}`} x={p.x} y={p.y + 4} textAnchor="middle" fontSize={11} fontWeight="700" fill={i === points.length - 1 ? '#fff' : t.l3}>
            {String(i + 1)}
          </SvgText>
        ))}
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  grow: { flex: 1 },
  body: { paddingHorizontal: 16, paddingBottom: DOCK_INSET },
  lead: { marginTop: 5 },
  moods: { gap: 7, paddingVertical: 14, paddingRight: 16 },

  idle: { borderRadius: 20, borderWidth: 1.5, borderStyle: 'dashed', paddingVertical: 34, paddingHorizontal: 20, alignItems: 'center', gap: 6 },
  idleIcon: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  idleBody: { textAlign: 'center' },

  card: { borderRadius: 20, borderWidth: 1, paddingHorizontal: 16, paddingVertical: 18 },
  forYou: { alignSelf: 'flex-start', paddingHorizontal: 9, paddingVertical: 5, borderRadius: 999, marginBottom: 10 },
  cardMeta: { marginTop: 4 },
  map: { height: 190, borderRadius: 16, borderWidth: 1, overflow: 'hidden', marginTop: 14, marginBottom: 16 },

  stopRow: { flexDirection: 'row', gap: 11 },
  stopRail: { alignItems: 'center' },
  stopNum: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  stopLine: { width: 1, flex: 1, marginVertical: 6 },
  stopBody: { flex: 1, paddingBottom: 14 },
  stopCard: { borderRadius: 12, paddingHorizontal: 13, paddingVertical: 12, gap: 4 },
  stopHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  stopTags: { flexDirection: 'row', gap: 5, flexWrap: 'wrap', marginTop: 4 },
  tag: { paddingHorizontal: 7, paddingVertical: 4, borderRadius: 999, borderWidth: 1 },

  originNote: { marginBottom: 10 },
  cta: { marginTop: 6, marginBottom: 8 },
});
