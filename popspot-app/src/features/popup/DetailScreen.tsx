import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, Share, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { categoryLabelColor } from '@/components/main/categoryVisual';
import { popupBadgeVisual } from '@/components/main/popupBadgeStyle';
import { Card, PillButton } from '@/components/ui/PillButton';
import { Icon } from '@/components/ui/Icon';
import { T } from '@/components/ui/Text';
import { daysUntilEnd } from '@/lib/dday';
import { periodText } from '@/lib/periodText';
import { popupCoverUrl } from '@/lib/popupCover';
import { classifyCategory, categoryLabel, kstTodayStart } from '@/lib/popupSlices';
import { classifyRegion, regionLabel } from '@/lib/regions';
import { useAuth } from '@/features/auth/useAuth';
import { useStamps } from '@/features/passport/useStamps';
import { toPlanStop, usePlanStore } from '@/store/usePlanStore';
import { useTheme } from '@/theme/ThemeProvider';
import type { RootStackParamList } from '@/types/navigation';
import { congestionBars, quietestHour, useCongestion } from './useCongestion';
import { usePopups } from './usePopups';
import { ReportSheet, type ReportMode } from './ReportSheet';
import { WAIT_LEVELS, useWaitReport } from './useWaitReport';
import { useWishlist } from './useWishlist';

/**
 * 팝업 상세 — 시안 09.
 *
 * <h3>시안에는 있지만 여기 없는 칸</h3>
 *
 * <p>시안의 정보 카드는 네 줄이다 — 기간·운영·주소·입장. 그중 <b>운영시간과 입장 방식은 백엔드에
 * 없다</b>(실 응답에 그런 칸 자체가 없다). 빈 줄로 두거나 "정보 없음" 으로 채우는 대신 <b>줄을
 * 없앤다</b> — 이식한 {@code periodText} 주석이 같은 원칙을 적어 두었다: 빈 칸을 만드느니 칸을
 * 없애고 남은 자리는 진짜 값에 쓴다.
 *
 * <p>"예상 대기 12분" 도 마찬가지다. 예측 모델이 없고, 있는 것은 방문자 제보 3단계다
 * ({@code useWaitReport}). 없는 숫자를 적어 두면 그 팝업 앞에 선 사람이 그 숫자로 판단한다.
 *
 * <p>혼잡도 막대는 <b>실제 데이터가 맞다</b>. 다만 지역 단위라 서버가 준 지역 이름을 함께 적는다.
 *
 * <p>목록을 다시 부르지 않고 {@code usePopups} 가 들고 있는 것에서 찾는다 — 웹도 같은 이유로
 * 상세에서 목록 API 를 다시 부르지 않는다.
 */
export default function DetailScreen() {
  const { t } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { id } = useRoute<RouteProp<RootStackParamList, 'Detail'>>().params;

  const { popups } = usePopups();
  const popup = popups.find((p) => p.id === id);

  const today = useMemo(() => kstTodayStart(), []);
  const wait = useWaitReport(id);
  const { data: congestion } = useCongestion();
  const auth = useAuth();
  const wishlist = useWishlist(auth.userId);
  const stamps = useStamps(auth.userId);
  const addStop = usePlanStore((s) => s.add);
  const [planned, setPlanned] = useState(false);
  const [reportMode, setReportMode] = useState<ReportMode | null>(null);

  if (!popup) {
    return (
      <View style={[styles.root, styles.center, { backgroundColor: t.bg }]}>
        <T size={13} color={t.mu}>
          팝업을 찾지 못했어요.
        </T>
      </View>
    );
  }

  const cover = popupCoverUrl(popup, 900);
  const badge = popupBadgeVisual(popup.startDate, popup.endDate, today, t);
  const code = classifyCategory(popup.category);
  const catColor = categoryLabelColor(code).color ?? t.ik;
  const left = daysUntilEnd(popup.endDate, today);
  const bars = congestionBars(congestion);
  const quiet = quietestHour(congestion);
  const region = classifyRegion(popup.location);

  /* 기간 — 종료일을 모르는 팝업이 절반이라 한쪽만 알아도 그대로 쓴다(periodText 주석). */
  const facts: { k: string; v: string }[] = [
    {
      k: '기간',
      v: left !== null && left >= 0
        ? `${periodText(popup.startDate, popup.endDate)} · 남은 ${left}일`
        : periodText(popup.startDate, popup.endDate),
    },
    { k: '주소', v: popup.address?.trim() || popup.location },
    { k: '분야', v: `${categoryLabel(code)} · ${regionLabel(region)}` },
  ];

  return (
    <View style={[styles.root, { backgroundColor: t.bg }]}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={[styles.hero, { backgroundColor: t.mp }]}>
          {cover ? (
            <Image source={{ uri: cover }} style={StyleSheet.absoluteFill} contentFit="cover" />
          ) : null}
          {/* 위아래로 어둡게 — 흰 아이콘과 제목이 어떤 사진 위에서도 읽히게 한다. */}
          <LinearGradient
            colors={['rgba(10,10,10,.42)', 'rgba(10,10,10,0)', 'rgba(10,10,10,.55)']}
            locations={[0.22, 0.45, 1]}
            style={StyleSheet.absoluteFill}
          />

          <View style={[styles.heroBar, { top: insets.top + 8 }]}>
            <Pressable onPress={navigation.goBack} accessibilityLabel="뒤로" style={styles.glassBtn}>
              <Icon name="arrowLeft" size={19} color="#fff" strokeWidth={2.2} />
            </Pressable>
            <View style={styles.grow} />
            <Pressable
              onPress={() => {
                /* 웹 상세 주소를 공유한다 — 받는 사람이 앱을 안 깔았어도 열린다. */
                Share.share({
                  message: `${popup.name}
https://popspot.co.kr/popup/${popup.id}`,
                }).catch(() => {});
              }}
              accessibilityLabel="공유"
              style={styles.glassBtn}
            >
              <Icon name="share" size={17} color="#fff" />
            </Pressable>
            <Pressable
              onPress={() => {
                /* 찜은 계정에 남는다. 로그인하지 않았으면 눌러도 아무 데도 저장되지 않으므로
                   조용히 켜 두지 않고 로그인으로 보낸다. */
                if (!auth.signedIn) {
                  navigation.navigate('Login');
                  return;
                }
                wishlist.toggle(popup.id);
              }}
              accessibilityLabel={wishlist.has(popup.id) ? '찜 해제' : '찜하기'}
              style={styles.glassBtn}
            >
              <Icon
                name="heart"
                size={17}
                color="#ff3d7f"
                fill={wishlist.has(popup.id) ? '#ff3d7f' : undefined}
              />
            </Pressable>
          </View>

          <View style={styles.heroFoot}>
            {badge ? (
              <View style={[styles.heroBadge, { backgroundColor: badge.bg }]}>
                <T size={11} weight={700} color={badge.fg}>
                  {badge.label}
                </T>
              </View>
            ) : null}
            <T size={23} weight={800} em={-0.02} leading={1.25} color="#fff">
              {popup.name}
            </T>
            {popup.nameEn ? (
              <T size={11} weight={600} em={0.04} color="rgba(255,255,255,.62)" numeric>
                {popup.nameEn}
              </T>
            ) : null}
          </View>
        </View>

        <View style={styles.body}>
          <View style={styles.ctaRow}>
            <PillButton
              label="길찾기"
              icon="navigate"
              glow
              style={styles.grow}
              onPress={() => navigation.navigate('Guide')}
            />
            <PillButton
              label={planned ? '담김' : '코스 추가'}
              icon={planned ? 'check' : 'course'}
              iconSize={16}
              variant="outline"
              fontSize={13}
              onPress={() => {
                /* 좌표가 없으면 담을 수 없다 — 동선을 그릴 수 없다(usePlanStore.toPlanStop). */
                const stop = toPlanStop(popup);
                if (!stop) return;
                addStop(stop);
                setPlanned(true);
              }}
            />

            {/* 시안의 세 번째 자물쇠 버튼 — 방문 인증이다. 이미 찍었으면 잠긴 채로 둔다
                (팝업당 평생 1회, lib/stamps.ts). */}
            <Pressable
              onPress={() => {
                if (!auth.signedIn) {
                  navigation.navigate('Login');
                  return;
                }
                stamps.add(popup.id);
              }}
              accessibilityLabel={stamps.has(popup.id) ? '방문 인증 완료' : '방문 인증'}
              style={[
                styles.stampBtn,
                {
                  borderColor: stamps.has(popup.id) ? t.l4 : t.ln,
                  backgroundColor: stamps.has(popup.id) ? t.sft : t.sf,
                },
              ]}
            >
              <Icon
                name={stamps.has(popup.id) ? 'check' : 'lock'}
                size={18}
                color={stamps.has(popup.id) ? t.l7 : t.ik}
                strokeWidth={2.2}
              />
            </Pressable>
          </View>

          {/* 찜·인증이 실패했을 때는 조용히 넘기지 않는다 — 찜한 줄 알았는데 안 되어 있으면
              마감 알림이 오지 않고, 그건 사용자가 알아챌 방법이 없다. */}
          {wishlist.error || stamps.error ? (
            <T size={11.5} color={t.ac} leading={1.5}>
              {wishlist.error ?? stamps.error}
            </T>
          ) : null}

          <Card>
            {facts.map((f) => (
              <View key={f.k} style={styles.factRow}>
                <T size={11.5} weight={700} color={t.mu} dim={0.72} style={styles.factKey}>
                  {f.k}
                </T>
                <T size={13} weight={600} leading={1.5} style={styles.grow}>
                  {f.v}
                </T>
              </View>
            ))}
          </Card>

          {/* 지금 어때요 — 예측이 아니라 방문자 제보다. */}
          <Card>
            <View style={styles.cardHead}>
              <T size={13.5} weight={800}>
                지금 어때요?
              </T>
              <T size={10} color={t.mu} dim={0.6} numeric>
                {wait.status?.count ? `${wait.status.count}명 제보` : '아직 제보 없음'}
              </T>
            </View>
            <View style={styles.waitRow}>
              {WAIT_LEVELS.map((lv) => {
                const on = wait.status?.level === lv.value;
                return (
                  <Pressable
                    key={lv.value}
                    onPress={() => wait.report(lv.value)}
                    disabled={wait.sent}
                    style={[
                      styles.waitBtn,
                      { borderColor: on ? t.l4 : t.ln, backgroundColor: on ? t.sft : 'transparent' },
                      wait.sent && !on && styles.waitDim,
                    ]}
                  >
                    <T size={12} weight={700} color={on ? t.l7 : t.ik}>
                      {lv.label}
                    </T>
                  </Pressable>
                );
              })}
            </View>
            <T size={11} color={t.mu} dim={0.8} leading={1.5} style={styles.waitNote}>
              {wait.sent
                ? '고마워요. 다음 방문자에게 바로 보여요.'
                : '버튼만 누르면 끝 · 로그인 없이도 참여할 수 있어요'}
            </T>
          </Card>

          {bars.length > 0 ? (
            <Card>
              <View style={styles.cardHead}>
                <View style={styles.liveRow}>
                  <T size={13.5} weight={800}>
                    {congestion?.areaName ?? '이 지역'} 혼잡도
                  </T>
                  <View style={[styles.liveTag, { backgroundColor: t.hi }]}>
                    <T size={9.5} weight={700} color={t.hif}>
                      LIVE
                    </T>
                  </View>
                </View>
                <T size={10} color={t.mu} dim={0.6} numeric>
                  {congestion?.level}
                </T>
              </View>

              <View style={styles.bars}>
                {bars.map((b, i) => (
                  <View
                    key={`${b.time}-${i}`}
                    style={[
                      styles.bar,
                      {
                        height: `${b.height * 100}%`,
                        backgroundColor: b.time === quiet ? t.l5 : t.mp,
                      },
                    ]}
                  />
                ))}
              </View>
              <View style={styles.barAxis}>
                <T size={9.5} weight={600} color={t.mu} dim={0.55} numeric>
                  {bars[0]?.time}
                </T>
                <T size={9.5} weight={600} color={t.mu} dim={0.55} numeric>
                  {bars[bars.length - 1]?.time}
                </T>
              </View>

              {quiet ? (
                <T size={11.5} color={t.mu} leading={1.55} style={[styles.congestionNote, { borderTopColor: t.ln }]}>
                  오늘은 <T size={11.5} weight={700}>{quiet}</T>가 가장 한산해요.
                </T>
              ) : null}
            </Card>
          ) : null}

          <Pressable
            onPress={() => navigation.navigate('Music')}
            style={[styles.moodCard, { backgroundColor: t.ik }]}
          >
            <View style={styles.grow}>
              <T size={9} weight={700} em={0.1} color={t.l3} numeric>
                MOOD MATCH
              </T>
              <T size={13} weight={700} color="#f5f3ee" numberOfLines={1} style={styles.moodTitle}>
                {categoryLabel(code)} 무드에 어울리는 음악
              </T>
              <T size={11} color="rgba(245,243,238,.55)">
                Spotify · Apple Music · YouTube
              </T>
            </View>
            <View style={[styles.moodPlay, { backgroundColor: t.l3 }]}>
              <Icon name="play" size={14} color="#0a0a0a" />
            </View>
          </Pressable>

          <View style={styles.footRow}>
            <Pressable onPress={() => setReportMode('fix')} style={[styles.footBtn, { borderColor: t.ln }]}>
              <T size={12} weight={700} color={t.mu}>
                정보 수정 요청
              </T>
            </Pressable>
            <Pressable onPress={() => setReportMode('takedown')} style={[styles.footBtn, { borderColor: t.ln }]}>
              <T size={12} weight={700} color={t.mu}>
                신고하기
              </T>
            </Pressable>
          </View>

          <View style={[styles.catLine, { borderTopColor: t.ln }]}>
            <View style={[styles.catDot, { backgroundColor: catColor }]} />
            <T size={10.5} color={t.mu} dim={0.7}>
              {popup.sourceType === 'CRAWLED' ? '자동 수집된 정보입니다' : '등록된 정보입니다'}
            </T>
          </View>
        </View>
      </ScrollView>

      <ReportSheet
        mode={reportMode}
        popupId={popup.id}
        popupName={popup.name}
        onClose={() => setReportMode(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  center: { alignItems: 'center', justifyContent: 'center' },
  grow: { flex: 1 },
  scroll: { paddingBottom: 40 },

  hero: { height: 300 },
  heroBar: { position: 'absolute', left: 12, right: 12, flexDirection: 'row', alignItems: 'center', gap: 8 },
  glassBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(10,10,10,.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroFoot: { position: 'absolute', left: 16, right: 16, bottom: 16, gap: 5 },
  heroBadge: { alignSelf: 'flex-start', paddingHorizontal: 9, paddingVertical: 4, borderRadius: 999, marginBottom: 3 },

  body: { padding: 16, gap: 12 },
  ctaRow: { flexDirection: 'row', gap: 8 },
  stampBtn: { width: 50, minHeight: 50, borderRadius: 25, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },

  factRow: { flexDirection: 'row', gap: 11, alignItems: 'flex-start', paddingVertical: 5 },
  factKey: { width: 52 },

  cardHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  liveRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  liveTag: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 999 },

  waitRow: { flexDirection: 'row', gap: 7 },
  waitBtn: { flex: 1, minHeight: 40, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  waitDim: { opacity: 0.45 },
  waitNote: { marginTop: 10 },

  bars: { flexDirection: 'row', alignItems: 'flex-end', gap: 3, height: 46 },
  bar: { flex: 1, borderTopLeftRadius: 2, borderTopRightRadius: 2 },
  barAxis: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  congestionNote: { marginTop: 11, paddingTop: 11, borderTopWidth: 1 },

  moodCard: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 16, padding: 14 },
  moodTitle: { marginVertical: 3 },
  moodPlay: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },

  footRow: { flexDirection: 'row', gap: 8 },
  footBtn: { flex: 1, minHeight: 40, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },

  catLine: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingTop: 12, borderTopWidth: 1 },
  catDot: { width: 6, height: 6, borderRadius: 3 },
});
