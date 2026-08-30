import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useMemo, useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BottomDock, DOCK_INSET } from '@/components/layout/BottomDock';
import { PopupCard } from '@/components/main/PopupCard';
import { Icon } from '@/components/ui/Icon';
import { T } from '@/components/ui/Text';
import { openPopups, usePopups } from '@/features/popup/usePopups';
import { MOODS, matchesMood, moodById } from '@/lib/moods';
import { kstTodayStart } from '@/lib/popupSlices';
import { useTheme } from '@/theme/ThemeProvider';
import type { RootStackParamList } from '@/types/navigation';

/**
 * 음악 — 시안 15. 웹 {@code MusicTab.tsx} 구조 그대로.
 *
 * <p><b>무드 여섯 칸이 주 인터랙션이고, 그 무드의 팝업 사진 카드가 주 화면이다.</b> 배경음악은
 * 아래 위젯으로 강등돼 있다 — 앨범 플레이어 화면이 아니다(시안 노트).
 *
 * <h3>Spotify 로그인 대신</h3>
 *
 * <p>웹은 Spotify OAuth 로 곡을 직접 재생한다. 앱에서 같은 것을 하려면 리다이렉트 URI 등록과 앱
 * 심사가 먼저라, 지금은 <b>검색어를 들고 각 서비스로 넘긴다.</b> 무드마다 정해진 검색어가 있고
 * ({@code lib/moods.ts} 의 {@code music}), 그건 웹이 이미 음악 API 로 보내는 것과 <b>같은 문자열</b>
 * 이다. 연결이 붙는 날 이 자리만 바뀌고 무드 정의는 그대로다.
 */

/** 무드 하나를 각 서비스에서 여는 주소. 앱이 깔려 있으면 앱으로, 아니면 웹으로 열린다. */
const SERVICES = [
  {
    key: 'spotify',
    label: 'Spotify',
    color: '#1DB954',
    url: (q: string) => `https://open.spotify.com/search/${encodeURIComponent(q)}`,
  },
  {
    key: 'youtube',
    label: 'YouTube',
    color: '#FF0000',
    url: (q: string) => `https://music.youtube.com/search?q=${encodeURIComponent(q)}`,
  },
];

export default function MusicScreen() {
  const { t } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { popups } = usePopups();

  const [moodId, setMoodId] = useState(MOODS[0].id);
  const mood = moodById(moodId);

  const today = useMemo(() => kstTodayStart(), []);
  const open = useMemo(() => openPopups(popups, today), [popups, today]);

  /* 무드에 드는 것을 앞에, 나머지를 뒤에. 웹 MusicTab 과 같은 순서다 — 무드에 드는 것이 적어도
     화면이 비지 않는다. */
  const matched = useMemo(() => open.filter((p) => matchesMood(p.category, mood)), [open, mood]);
  const shown = useMemo(() => matched.slice(0, 8), [matched]);

  return (
    <View style={[styles.root, { backgroundColor: t.bg }]}>
      <ScrollView contentContainerStyle={[styles.body, { paddingTop: insets.top + 16 }]}>
        <View style={styles.head}>
          <Pressable onPress={navigation.goBack} accessibilityLabel="뒤로" style={styles.back}>
            <Icon name="arrowLeft" size={19} color={t.ik} strokeWidth={2.2} />
          </Pressable>
          <T size={16.5} weight={800} style={styles.grow}>
            음악
          </T>
        </View>

        <T size={21} weight={800} em={-0.02} leading={1.3}>
          무드로 고르는, <T size={21} weight={800} color={t.l5}>오늘의 팝업</T>
        </T>
        <T size={12.5} color={t.mu} leading={1.6} style={styles.lead}>
          지금 기분에 맞는 무드를 고르면, 어울리는 팝업과 배경음악을 함께 골라드려요.
        </T>

        <View style={styles.moodGrid}>
          {MOODS.map((m) => {
            const on = m.id === moodId;
            return (
              <Pressable
                key={m.id}
                onPress={() => setMoodId(m.id)}
                style={[
                  styles.moodCard,
                  { backgroundColor: on ? t.l3 : t.mp, borderColor: on ? t.l4 : t.ln },
                ]}
              >
                <T size={13.5} weight={800} leading={1.2} color={on ? t.hif : t.ik}>
                  {m.label}
                </T>
                <T size={11} leading={1.25} color={on ? t.hif : t.mu} dim={on ? 0.68 : 1} style={styles.moodDesc}>
                  {m.desc}
                </T>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.sectionHead}>
          <View>
            <T size={15} weight={800}>
              <T size={15} weight={800} color={t.l5}>
                {mood.label}
              </T>{' '}
              무드의 팝업
            </T>
            <T size={11} color={t.mu} dim={0.8} style={styles.sectionSub}>
              {matched.length.toLocaleString()}곳 · 사진으로 훑어보세요
            </T>
          </View>
        </View>

        {shown.length === 0 ? (
          <View style={[styles.empty, { borderColor: t.ln }]}>
            <Icon name="searchOff" size={26} color={t.mu} strokeWidth={1.8} opacity={0.5} />
            <T size={12.5} color={t.mu} leading={1.6} style={styles.emptyBody}>
              이 무드에 드는 팝업이 지금은 없어요. 다른 무드를 골라 보세요.
            </T>
          </View>
        ) : (
          <View style={styles.grid}>
            {shown.map((p) => (
              <View key={p.id} style={styles.cell}>
                <PopupCard
                  popup={p}
                  today={today}
                  onPress={() => navigation.navigate('Detail', { id: p.id })}
                />
              </View>
            ))}
          </View>
        )}

        <View style={[styles.bgm, { backgroundColor: t.mp, borderColor: t.ln }]}>
          <View style={styles.bgmHead}>
            <View style={[styles.bgmIcon, { backgroundColor: t.l1 }]}>
              <Icon name="music" size={15} color={t.l7} strokeWidth={2.2} />
            </View>
            <View style={styles.grow}>
              <T size={13} weight={800}>
                이 무드의 배경음악
              </T>
              <T size={10.5} color={t.mu} dim={0.8}>
                {mood.label} 무드의 곡
              </T>
            </View>
          </View>

          <View style={[styles.query, { backgroundColor: t.sf, borderColor: t.ln }]}>
            <Icon name="search" size={15} color={t.mu} strokeWidth={2.2} />
            <T size={12.5} color={t.mu} numberOfLines={1} style={styles.grow}>
              {mood.music}
            </T>
          </View>

          <View style={styles.services}>
            {SERVICES.map((s) => (
              <Pressable
                key={s.key}
                onPress={() => Linking.openURL(s.url(mood.music)).catch(() => {})}
                style={[styles.service, { backgroundColor: s.color }]}
              >
                <T size={12.5} weight={800} color="#fff">
                  {s.label}에서 듣기
                </T>
              </Pressable>
            ))}
          </View>

          <Pressable
            onPress={() => navigation.navigate('Passport')}
            style={[styles.passportBtn, { backgroundColor: t.sf, borderColor: t.ln }]}
          >
            <Icon name="ticket" size={14} color={t.ik} strokeWidth={2.2} />
            <T size={12} weight={700}>
              팝업 여권
            </T>
          </Pressable>

          <T size={10} color={t.mu} dim={0.7} style={styles.credit}>
            음원 제공 · Spotify · YouTube Music
          </T>
        </View>
      </ScrollView>

      <BottomDock active="more" />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  grow: { flex: 1 },
  body: { paddingHorizontal: 16, paddingBottom: DOCK_INSET },

  head: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16 },
  back: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  lead: { marginTop: 6 },

  moodGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 9, marginTop: 16, marginBottom: 22 },
  moodCard: { width: '48%', flexGrow: 1, borderRadius: 16, borderWidth: 1, paddingHorizontal: 13, paddingVertical: 11 },
  moodDesc: { marginTop: 2 },

  sectionHead: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 11 },
  sectionSub: { marginTop: 3 },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 22 },
  cell: { width: '48%', flexGrow: 1 },

  empty: { borderRadius: 16, borderWidth: 1, borderStyle: 'dashed', alignItems: 'center', gap: 8, paddingVertical: 32, marginBottom: 22 },
  emptyBody: { textAlign: 'center', paddingHorizontal: 24 },

  bgm: { borderRadius: 18, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 15 },
  bgmHead: { flexDirection: 'row', alignItems: 'center', gap: 9, marginBottom: 13 },
  bgmIcon: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  query: { flexDirection: 'row', alignItems: 'center', gap: 9, minHeight: 40, paddingHorizontal: 14, borderRadius: 999, borderWidth: 1, marginBottom: 12 },
  services: { flexDirection: 'row', gap: 7, marginBottom: 12 },
  service: { flex: 1, minHeight: 38, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  passportBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, minHeight: 38, borderRadius: 999, borderWidth: 1 },
  credit: { textAlign: 'center', marginTop: 13 },
});
