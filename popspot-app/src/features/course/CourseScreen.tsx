import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BottomDock, DOCK_INSET } from '@/components/layout/BottomDock';
import { CourseMap } from '@/components/Map/CourseMap';
import { Icon, type IconName } from '@/components/ui/Icon';
import { PillButton } from '@/components/ui/PillButton';
import { T } from '@/components/ui/Text';
import { useAuth } from '@/features/auth/useAuth';
import { usePlanStore } from '@/store/usePlanStore';
import { useTheme } from '@/theme/ThemeProvider';
import { font } from '@/theme/typography';
import type { CourseItem } from '@/types/popup';
import type { RootStackParamList } from '@/types/navigation';
import { recommendCourse, saveCourse, VIBES } from './courseApi';

/**
 * POP-COURSE — 웹 홈의 COURSE 탭을 그대로 옮긴 것.
 *
 * <p>구조도 같다: 분위기 넷(핫플·데이트·사진·힐링) 중 하나를 누르거나 직접 입력하면
 * {@code /api/courses/recommend} 가 코스를 돌려주고, 그걸 번호 타임라인으로 그린 뒤 마이페이지에
 * 저장한다.
 *
 * <h3>여기서는 "AI" 라고 말해도 된다</h3>
 *
 * <p>앞서 앱의 코스 탭에서 "AI가 동선을 계산하는 중" 을 지웠던 것은, <b>그때는 실제로 AI 를 부르지
 * 않았기 때문</b>이다(앱 안에서 최근접이웃을 돌렸다). 이 화면은 서버의 LLM 을 부르고 실측 3.2초가
 * 걸린다 — 기다림이 실재하므로 로딩도, 그 이름도 사실이다.
 *
 * <h3>웹에서 하나 뺐다</h3>
 *
 * <p>웹은 코스 항목을 누르면 {@code /popup/{item.id}} 로 보낸다. 그런데 그 {@code id} 는 팝업 id 가
 * 아니라 <b>1부터 세는 순번</b>이고 우리 팝업 id 는 185 부터 시작한다 — 즉 <b>없는 페이지로 가는
 * 링크</b>다({@code courseApi.ts} 주석에 실측 근거). 앱에서는 그 이동을 넣지 않았다.
 */
export default function CourseScreen() {
  const { t } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const auth = useAuth();
  const replacePlan = usePlanStore((s) => s.replace);

  const [vibe, setVibe] = useState('');
  const [course, setCourse] = useState<CourseItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [custom, setCustom] = useState(false);
  const [customText, setCustomText] = useState('');
  const [saved, setSaved] = useState(false);

  const ask = async (next: string) => {
    if (loading) return;
    setLoading(true);
    setError(null);
    setCourse([]);
    setSaved(false);
    setVibe(next);
    setCustom(false);

    const result = await recommendCourse(next);
    if (result.kind === 'ok') setCourse(result.course);
    else setError(result.message);
    setLoading(false);
  };

  const reset = () => {
    setCourse([]);
    setVibe('');
    setError(null);
    setSaved(false);
  };

  const save = async () => {
    if (!auth.signedIn || !auth.userId) {
      navigation.navigate('Login');
      return;
    }
    const failure = await saveCourse(auth.userId, course);
    if (failure) setError(failure);
    else setSaved(true);
  };

  return (
    <View style={[styles.root, { backgroundColor: t.bg }]}>
      <ScrollView contentContainerStyle={[styles.body, { paddingTop: insets.top + 16 }]}>
        <View style={styles.header}>
          <View style={[styles.betaChip, { borderColor: t.l3, backgroundColor: t.sft }]}>
            <Icon name="dice" size={10} color={t.l5} strokeWidth={2.2} />
            <T size={10} weight={600} em={0.06} color={t.l5} numeric>
              AI CURATION · BETA
            </T>
          </View>

          <View style={styles.title}>
            <T size={34} weight={800} em={-0.04} numeric>
              POP
            </T>
            <T size={34} weight={800} em={-0.04} color={t.l3} numeric>
              -
            </T>
            <T size={34} weight={800} em={-0.04} numeric>
              COURSE
            </T>
          </View>
          <T size={13} color={t.mu} leading={1.5} style={styles.lead}>
            원하는 분위기를 선택하면 AI가 최적의 동선을 추천합니다.
          </T>
        </View>

        <View style={styles.vibeGrid}>
          {VIBES.map((v) => {
            const active = vibe === v.value;
            return (
              <Pressable
                key={v.value}
                onPress={() => ask(v.value)}
                disabled={loading}
                accessibilityState={{ selected: active }}
                style={[
                  styles.vibeCard,
                  {
                    backgroundColor: active ? t.l3 : t.mp,
                    borderColor: active ? t.l4 : t.ln,
                    opacity: loading && !active ? 0.6 : 1,
                  },
                ]}
              >
                <View style={styles.vibeTop}>
                  <T size={11} em={0.2} color={active ? t.hif : t.mu} dim={active ? 0.6 : 1} numeric>
                    No. {v.no}
                  </T>
                  <Icon
                    name={VIBE_ICON[v.value]}
                    size={20}
                    color={active ? t.hif : t.mu}
                    opacity={active ? 1 : 0.45}
                    strokeWidth={1.6}
                  />
                </View>
                <View>
                  <T size={16} weight={700} leading={1.15} color={active ? t.hif : t.ik}>
                    {v.label}
                  </T>
                  <T
                    size={12}
                    color={active ? t.hif : t.mu}
                    dim={active ? 0.7 : 1}
                    style={styles.vibeDesc}
                  >
                    {v.desc}
                  </T>
                </View>

                {loading && active ? (
                  <View style={styles.vibeLoading}>
                    <ActivityIndicator color="#0a0a0a" />
                  </View>
                ) : null}
              </Pressable>
            );
          })}
        </View>

        {custom ? (
          <View style={styles.customRow}>
            <View style={[styles.customBox, { backgroundColor: t.sf, borderColor: t.ln }]}>
              <TextInput
                value={customText}
                onChangeText={setCustomText}
                placeholder="예: 비 오는 날 가기 좋은 곳"
                placeholderTextColor={t.mu}
                onSubmitEditing={() => ask(customText)}
                returnKeyType="search"
                autoFocus
                style={[styles.customInput, font(400), { color: t.ik }]}
              />
            </View>
            <Pressable onPress={() => ask(customText)} style={[styles.customGo, { backgroundColor: t.l3 }]}>
              <T size={13} weight={700} color={t.hif}>
                추천
              </T>
            </Pressable>
            <Pressable onPress={() => setCustom(false)} style={[styles.customClose, { backgroundColor: t.mp }]}>
              <Icon name="close" size={16} color={t.mu} strokeWidth={2.2} />
            </Pressable>
          </View>
        ) : (
          <Pressable onPress={() => setCustom(true)} style={styles.customAsk}>
            <Icon name="dice" size={12} color={t.mu} strokeWidth={2.2} />
            <T size={13} color={t.mu}>
              찾는 분위기가 없나요? 직접 입력하기
            </T>
          </Pressable>
        )}

        <View style={styles.resultHead}>
          <View style={styles.resultTitle}>
            {loading ? (
              <ActivityIndicator size="small" color={t.l5} />
            ) : (
              <Icon name="course" size={17} color={t.l5} strokeWidth={2} />
            )}
            <T size={15} weight={700} numberOfLines={1} style={styles.grow}>
              {loading
                ? 'AI가 코스를 짜고 있어요…'
                : course.length > 0
                  ? 'AI RECOMMENDED COURSE'
                  : '원하는 분위기를 선택해보세요.'}
            </T>
          </View>
          {course.length > 0 && !loading ? (
            <Pressable onPress={reset} style={styles.resetBtn}>
              <Icon name="refresh" size={11} color={t.mu} strokeWidth={2.4} />
              <T size={12} color={t.mu}>
                초기화
              </T>
            </Pressable>
          ) : null}
        </View>

        {error ? (
          <T size={12.5} color={t.ac} leading={1.5} style={styles.error}>
            {error}
          </T>
        ) : null}

        {course.length > 0 && !loading ? (
          <View style={[styles.card, { backgroundColor: t.sf, borderColor: t.ln }]}>
            <View style={[styles.forYou, { backgroundColor: t.l3 }]}>
              <T size={10} weight={700} em={0.08} color={t.hif} numeric>
                FOR YOU
              </T>
            </View>
            <T size={21} weight={700}>
              서울{' '}
              <T size={21} weight={700} color={t.ac}>
                {vibe}
              </T>{' '}
              맞춤 코스
            </T>
            <T size={13} color={t.mu} style={styles.cardSub}>
              AI가 제안하는 최적의 동선입니다.
            </T>

            {/* 진짜 지도 위에 동선을 그린다. 예전에는 여기에 좌표를 상자에 편 SVG 도식이
                있었다 — 점과 점선뿐이라 어디인지 알 수 없었다. */}
            <View style={styles.map}>
              <CourseMap stops={course} />
            </View>

            <View>
              {course.map((item, i) => (
                <View key={`${item.id}-${i}`} style={styles.stopRow}>
                  <View style={styles.stopRail}>
                    <View style={[styles.stopNum, { backgroundColor: t.ik }]}>
                      <T size={13} weight={700} color={t.bg} numeric>
                        {i + 1}
                      </T>
                    </View>
                    {i < course.length - 1 ? (
                      <View style={[styles.stopLine, { backgroundColor: t.ln }]} />
                    ) : null}
                  </View>

                  {/* 누르는 자리가 아니다 — 이 장소는 우리 DB 의 팝업이 아니라서 열 상세가 없다.
                      웹은 여기서 /popup/{id} 로 보내는데 그 id 로는 아무것도 없다. */}
                  <View style={styles.stopBody}>
                    <View style={[styles.stopCard, { backgroundColor: t.mp, borderColor: t.ln }]}>
                      <T size={14} weight={700}>
                        {item.name}
                      </T>
                      {item.reason ? (
                        <T size={13} color={t.mu} leading={1.5} style={styles.stopReason}>
                          “{item.reason}”
                        </T>
                      ) : null}
                      <View style={[styles.stopTag, { backgroundColor: t.sf, borderColor: t.ln }]}>
                        <T size={10} weight={600} em={0.06} color={t.mu} numeric>
                          {(item.category || 'PLACE').toUpperCase()}
                        </T>
                      </View>
                    </View>
                  </View>
                </View>
              ))}
            </View>

            <PillButton
              label={saved ? '저장했어요' : '마이페이지에 저장'}
              icon={saved ? 'check' : 'ticket'}
              iconSize={16}
              height={48}
              fontSize={14}
              onPress={save}
              style={styles.saveCta}
            />
            <PillButton
              label="최단 동선으로 다듬기"
              icon="zap"
              iconSize={16}
              variant="outline"
              height={44}
              fontSize={13}
              onPress={() => {
                /* 좌표는 진짜라 동선 계산은 그대로 된다 — 이름과 상세만 우리 것이 아니다.
                   id 는 음수로 둔다: 팝업 id 와 절대 겹치지 않아야 상세로 잘못 이어지지 않는다. */
                replacePlan(
                  course.map((c, i) => ({
                    id: -(i + 1),
                    name: c.name,
                    lat: c.lat,
                    lng: c.lng,
                    location: c.category || '추천 장소',
                  })),
                );
                navigation.navigate('Planner');
              }}
            />

            <T size={11} color={t.mu} dim={0.7} leading={1.5} style={styles.disclaimer}>
              추천 장소는 AI가 제안한 것이라 실제 운영 여부가 다를 수 있어요. 팝업 정보는 지도 탭에서
              확인해 주세요.
            </T>
          </View>
        ) : null}
      </ScrollView>

      <BottomDock active="course" />
    </View>
  );
}

/** 분위기마다의 아이콘. 웹은 lucide 의 Flame·Heart·Camera·Coffee 를 쓴다. */
const VIBE_ICON: Record<string, IconName> = {
  핫플: 'zap',
  데이트: 'heart',
  사진: 'grid',
  힐링: 'sun',
};

const styles = StyleSheet.create({
  root: { flex: 1 },
  grow: { flex: 1 },
  body: { paddingHorizontal: 16, paddingBottom: DOCK_INSET },

  header: { alignItems: 'center', marginTop: 12, marginBottom: 28 },
  betaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
    marginBottom: 14,
  },
  title: { flexDirection: 'row' },
  lead: { textAlign: 'center', marginTop: 6 },

  vibeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 14 },
  vibeCard: {
    width: '47%',
    flexGrow: 1,
    minHeight: 136,
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
    justifyContent: 'space-between',
    overflow: 'hidden',
  },
  vibeTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  vibeDesc: { marginTop: 2 },
  vibeLoading: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(10,10,10,.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  customAsk: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 8,
  },
  customRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  customBox: {
    flex: 1,
    minHeight: 44,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 14,
    justifyContent: 'center',
  },
  customInput: { fontSize: 13.5, padding: 0 },
  customGo: {
    minHeight: 44,
    paddingHorizontal: 18,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  customClose: { width: 44, height: 44, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },

  resultHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 28,
    marginBottom: 16,
  },
  resultTitle: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  resetBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  error: { marginBottom: 12 },

  card: { borderRadius: 14, borderWidth: 1, padding: 20 },
  forYou: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    marginBottom: 10,
  },
  cardSub: { marginTop: 4 },
  map: { marginTop: 20, marginBottom: 24 },

  stopRow: { flexDirection: 'row', gap: 14 },
  stopRail: { alignItems: 'center' },
  stopNum: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  stopLine: { width: 1, flex: 1, marginVertical: 6 },
  stopBody: { flex: 1, paddingBottom: 18 },
  stopCard: { borderRadius: 10, borderWidth: 1, padding: 16, gap: 6 },
  stopReason: { fontStyle: 'italic' },
  stopTag: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: 1,
    marginTop: 2,
  },

  saveCta: { marginTop: 4, marginBottom: 8 },
  disclaimer: { marginTop: 14 },
});
