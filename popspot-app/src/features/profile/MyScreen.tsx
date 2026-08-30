import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useMemo } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BottomDock, DOCK_INSET } from '@/components/layout/BottomDock';
import { Chip } from '@/components/ui/Chip';
import { Icon, type IconName } from '@/components/ui/Icon';
import { PillButton } from '@/components/ui/PillButton';
import { T } from '@/components/ui/Text';
import { useAuth } from '@/features/auth/useAuth';
import { PopupCard } from '@/components/main/PopupCard';
import { usePopups } from '@/features/popup/usePopups';
import { useWishlist } from '@/features/popup/useWishlist';
import { kstTodayStart } from '@/lib/popupSlices';
import { SEASON_COPY, SEASONS } from '@/lib/season';
import { unreadCount, useNotifyStore } from '@/store/useNotifyStore';
import { usePlanStore } from '@/store/usePlanStore';
import { useTheme } from '@/theme/ThemeProvider';
import type { ThemeSeason } from '@/theme/tokens';
import type { RootStackParamList } from '@/types/navigation';

/**
 * 마이페이지 — 시안 17.
 *
 * <p>프로필·통계·설정. <b>숫자는 전부 실제로 센다</b> — 시안이 "방문 인증 7 / 찜한 팝업 14 /
 * 저장한 코스 3" 으로 적어 둔 자리에, 실제 값을 넣는다. 찜은 서버에서(로그인해야 보인다), 담은
 * 코스와 안 읽은 알림은 이 기기에서.
 *
 * <p>시안 레일에만 있던 <b>계절 테마 고르기</b>를 이 화면으로 가져왔다. 시안에서는 프로토타입
 * 검토용 사이드바에 있었는데, 실제 앱에는 그 사이드바가 없고 마이 &gt; 테마가 그 자리다.
 */

/** 계절 고르기 — 브랜드(기본)를 포함한 다섯. */
const THEME_CHOICES: { key: ThemeSeason; label: string }[] = [
  { key: 'brand', label: '기본' },
  ...SEASONS.map((s) => ({ key: s as ThemeSeason, label: SEASON_COPY[s].word })),
];

export default function MyScreen() {
  const { t, season, dark, setSeason, setDark } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const auth = useAuth();

  const planStops = usePlanStore((s) => s.stops);
  const inbox = useNotifyStore((s) => s.inbox);
  const settings = useNotifyStore((s) => s.settings);
  const { popups } = usePopups();
  const wishlist = useWishlist(auth.userId);

  const today = useMemo(() => kstTodayStart(), []);
  const wished = useMemo(
    () => popups.filter((p) => wishlist.ids.has(p.id)).slice(0, 6),
    [popups, wishlist.ids],
  );

  const onCount = Object.values(settings).filter(Boolean).length;

  const rows: { icon: IconName; label: string; hint: string; go: () => void }[] = [
    { icon: 'ticket', label: '팝업 여권', hint: auth.signedIn ? '' : '로그인 필요', go: () => navigation.navigate('Passport') },
    { icon: 'zap', label: '담은 코스', hint: `${planStops.length}곳`, go: () => navigation.navigate('Planner') },
    { icon: 'bell', label: '알림 설정', hint: `${onCount}종 켜짐`, go: () => navigation.navigate('Notifications') },
    { icon: 'music', label: '음악', hint: '', go: () => navigation.navigate('Music') },
  ];

  /* 이용약관과 개인정보 처리방침으로 가는 길은 <b>앱 안에 반드시 있어야 한다</b> — 플레이스토어
     심사 요건이고, 위치·알림 권한을 묻는 앱이 그 설명을 숨겨 두면 권한을 거절당한다.
     문서는 웹과 같은 것을 본다: 두 벌을 두면 한쪽만 고쳐진다. */
  const legal: { label: string; url: string }[] = [
    { label: '이용약관', url: 'https://popspot.co.kr/terms' },
    { label: '개인정보 처리방침', url: 'https://popspot.co.kr/privacy' },
  ];

  return (
    <View style={[styles.root, { backgroundColor: t.bg }]}>
      <ScrollView contentContainerStyle={[styles.body, { paddingTop: insets.top + 16 }]}>
        <T size={21} weight={800} em={-0.02} style={styles.title}>
          내 기록
        </T>

        <View style={[styles.profile, { backgroundColor: t.sf, borderColor: t.ln }]}>
          <View style={[styles.avatar, { backgroundColor: t.mp, borderColor: t.ln }]}>
            <Icon name="user" size={24} color={t.mu} />
          </View>
          <View style={styles.grow}>
            {auth.loading ? (
              <T size={13} color={t.mu}>
                불러오는 중…
              </T>
            ) : auth.signedIn ? (
              <>
                <T size={15.5} weight={800}>
                  로그인됨
                </T>
                <T size={11.5} color={t.mu} dim={0.8} style={styles.profileSub}>
                  찜과 스탬프가 계정에 저장됩니다.
                </T>
              </>
            ) : (
              <>
                <T size={15.5} weight={800}>
                  로그인하지 않음
                </T>
                <T size={11.5} color={t.mu} dim={0.8} leading={1.45} style={styles.profileSub}>
                  지도·검색·코스는 그대로 쓸 수 있어요. 찜과 스탬프만 계정이 필요합니다.
                </T>
              </>
            )}
          </View>
        </View>

        {auth.signedIn ? (
          <PillButton
            label="로그아웃"
            variant="outline"
            height={44}
            fontSize={13}
            onPress={auth.signOut}
            style={styles.authCta}
          />
        ) : (
          <PillButton
            label="로그인"
            height={46}
            fontSize={14}
            onPress={() => navigation.navigate('Login')}
            style={styles.authCta}
          />
        )}

        <View style={styles.stats}>
          <Stat n={planStops.length} label="담은 코스" highlight />
          <Stat n={wishlist.ids.size} label="찜한 팝업" />
          <Stat n={unreadCount(inbox)} label="안 읽은 알림" />
        </View>

        <View style={[styles.rows, { backgroundColor: t.sf, borderColor: t.ln }]}>
          {rows.map((r, i) => (
            <Pressable
              key={r.label}
              onPress={r.go}
              style={[styles.row, { borderBottomColor: i === rows.length - 1 ? 'transparent' : t.ln }]}
            >
              <View style={styles.rowIcon}>
                <Icon name={r.icon} size={17} color={t.mu} />
              </View>
              <T size={13} weight={700} style={styles.grow}>
                {r.label}
              </T>
              {r.hint ? (
                <T size={11.5} color={t.mu} dim={0.7}>
                  {r.hint}
                </T>
              ) : null}
              <Icon name="chevronRight" size={15} color={t.mu} opacity={0.4} />
            </Pressable>
          ))}
        </View>

        {wished.length > 0 ? (
          <>
            <View style={styles.wishHead}>
              <T size={13} weight={800}>
                찜한 팝업
              </T>
              <T size={11.5} weight={700} color={t.mu} dim={0.7}>
                {settings.wishClosing ? 'D-3 알림 켜짐' : 'D-3 알림 꺼짐'}
              </T>
            </View>
            <View style={styles.wishGrid}>
              {wished.map((p) => (
                <View key={p.id} style={styles.wishCell}>
                  <PopupCard
                    popup={p}
                    today={today}
                    onPress={() => navigation.navigate('Detail', { id: p.id })}
                  />
                </View>
              ))}
            </View>
          </>
        ) : null}

        <T size={11} weight={700} color={t.mu} dim={0.7} style={styles.sectionTitle}>
          약관 · 정책
        </T>
        <View style={[styles.rows, { backgroundColor: t.sf, borderColor: t.ln }]}>
          {legal.map((l, i) => (
            <Pressable
              key={l.label}
              onPress={() => Linking.openURL(l.url).catch(() => {})}
              style={[styles.row, { borderBottomColor: i === legal.length - 1 ? 'transparent' : t.ln }]}
            >
              <View style={styles.rowIcon}>
                <Icon name="message" size={17} color={t.mu} />
              </View>
              <T size={13} weight={700} style={styles.grow}>
                {l.label}
              </T>
              <Icon name="chevronRight" size={15} color={t.mu} opacity={0.4} />
            </Pressable>
          ))}
        </View>

        <T size={11} weight={700} color={t.mu} dim={0.7} style={styles.sectionTitle}>
          테마
        </T>
        <View style={[styles.theme, { backgroundColor: t.sf, borderColor: t.ln }]}>
          <View style={styles.themeChips}>
            {THEME_CHOICES.map((c) => (
              <Chip
                key={c.key}
                label={c.label}
                height={32}
                fontSize={12}
                on={season === c.key}
                activeBg={t.l3}
                activeFg={t.hif}
                onPress={() => setSeason(c.key)}
              />
            ))}
          </View>
          <T size={11} color={t.mu} dim={0.75} leading={1.55} style={styles.themeNote}>
            계절을 고르면 라임 자리에 그 계절 색이 들어갑니다. 브랜드 심볼은 바뀌지 않아요.
          </T>

          <Pressable
            onPress={() => setDark(!dark)}
            style={[styles.darkRow, { borderTopColor: t.ln }]}
          >
            <Icon name="sun" size={16} color={t.mu} />
            <T size={12.5} weight={700} style={styles.grow}>
              어두운 화면
            </T>
            <T size={11.5} color={t.mu} dim={0.7}>
              {dark ? '켜짐' : '꺼짐'}
            </T>
          </Pressable>
        </View>
      </ScrollView>

      <BottomDock active="my" />
    </View>
  );
}

function Stat({ n, label, highlight = false }: { n: number; label: string; highlight?: boolean }) {
  const { t } = useTheme();
  return (
    <View style={[styles.stat, { backgroundColor: t.sf, borderColor: t.ln }]}>
      <T size={24} weight={800} em={-0.03} color={highlight ? t.l7 : t.ik} numeric>
        {n}
      </T>
      <T size={11} weight={700} color={t.mu} dim={0.8} style={styles.statLabel}>
        {label}
      </T>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  grow: { flex: 1 },
  body: { paddingHorizontal: 16, paddingBottom: DOCK_INSET },
  title: { marginBottom: 16 },

  profile: { flexDirection: 'row', alignItems: 'center', gap: 13, borderRadius: 18, borderWidth: 1, padding: 16 },
  avatar: { width: 56, height: 56, borderRadius: 28, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  profileSub: { marginTop: 3 },
  authCta: { marginTop: 12 },

  stats: { flexDirection: 'row', gap: 8, marginTop: 12 },
  stat: { flex: 1, borderRadius: 16, borderWidth: 1, paddingVertical: 14, paddingHorizontal: 12, alignItems: 'center' },
  statLabel: { marginTop: 3 },

  rows: { borderRadius: 16, borderWidth: 1, paddingHorizontal: 14, marginTop: 18 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 11, paddingVertical: 13, borderBottomWidth: 1 },
  rowIcon: { width: 26, alignItems: 'center' },

  wishHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 22, marginBottom: 10 },
  wishGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  wishCell: { width: '48%', flexGrow: 1 },
  sectionTitle: { marginTop: 22, marginBottom: 10 },
  theme: { borderRadius: 16, borderWidth: 1, padding: 14 },
  themeChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  themeNote: { marginTop: 11 },
  darkRow: { flexDirection: 'row', alignItems: 'center', gap: 11, paddingTop: 13, marginTop: 13, borderTopWidth: 1 },
});
