import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Image } from 'expo-image';
import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BottomDock, DOCK_INSET } from '@/components/layout/BottomDock';
import { Icon } from '@/components/ui/Icon';
import { PillButton } from '@/components/ui/PillButton';
import { T } from '@/components/ui/Text';
import { useAuth } from '@/features/auth/useAuth';
import { usePopups } from '@/features/popup/usePopups';
import { popupCoverUrl } from '@/lib/popupCover';
import { useTheme } from '@/theme/ThemeProvider';
import type { RootStackParamList } from '@/types/navigation';
import { useStamps } from './useStamps';

/**
 * 팝업 여권 — 시안 16. 웹 {@code PassportView.tsx} 그대로.
 *
 * <p>사진 카드 2열 + 라임 체크 배지, 잠긴 칸은 점선 + 자물쇠(첫 칸만 "다음 스탬프"). 등급·진행바는
 * 웹 소스에서 MY 대시보드와 중복이라 빠져 있어 여기서도 넣지 않았다.
 *
 * <p><b>시안 아래의 "앱에서 추가된 것 — 웹은 버튼만 있고…" 한 줄은 뺐다.</b> 그건 설계 노트가
 * 화면으로 새어 나온 것이다. 사용자에게 웹과 앱의 차이를 설명하는 자리가 아니다.
 *
 * <p>방문 인증은 <b>로그인이 필요하다</b>({@code /api/stamps/my} 가 403 을 준다). 로그인하지 않은
 * 사람에게 빈 칸 열두 개를 보여주면 스탬프를 하나도 못 모은 것처럼 보이므로, 그 상태를 따로 그린다.
 */

/** 시안의 칸 수. 한 화면에 2열 6줄. */
const SLOTS = 12;

export default function PassportScreen() {
  const { t } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const auth = useAuth();
  const { catalog: popups } = usePopups();

  const stamps = useStamps(auth.userId);

  /** 스탬프 → 그 팝업. 목록에 없는 것(이미 끝난 팝업)은 이름만이라도 남긴다. */
  const filled = useMemo(() => {
    return stamps.rows.map((s) => ({
      stampDate: s.stampDate,
      popup: popups.find((p) => p.id === s.popupStore?.id) ?? null,
      id: s.popupStore?.id,
    }));
  }, [stamps.rows, popups]);

  return (
    <View style={[styles.root, { backgroundColor: t.bg }]}>
      <ScrollView contentContainerStyle={[styles.body, { paddingTop: insets.top + 16 }]}>
        <View style={styles.head}>
          <Pressable onPress={navigation.goBack} accessibilityLabel="뒤로" style={styles.back}>
            <Icon name="arrowLeft" size={19} color={t.ik} strokeWidth={2.2} />
          </Pressable>
          <T size={16.5} weight={800} style={styles.grow}>
            팝업 여권
          </T>
        </View>

        {!auth.signedIn ? (
          <View style={[styles.gate, { borderColor: t.ln }]}>
            <View style={[styles.gateIcon, { backgroundColor: t.sft }]}>
              <Icon name="ticket" size={24} color={t.l7} strokeWidth={1.9} />
            </View>
            <T size={15} weight={800}>
              방문 기록은 계정에 남아요
            </T>
            <T size={12.5} color={t.mu} leading={1.6} style={styles.gateBody}>
              로그인하면 지금까지 인증한 팝업이 여기 모입니다. 기기를 바꿔도 남아요.
            </T>
            <PillButton
              label="로그인"
              height={46}
              fontSize={14}
              onPress={() => navigation.navigate('Login')}
              style={styles.gateCta}
            />
          </View>
        ) : (
          <>
            <T size={27} weight={800} em={-0.03} leading={1.1}>
              스탬프{' '}
              <T size={27} weight={800} color={t.l5}>
                {filled.length}
              </T>
              <T size={27} weight={700} color={t.mu}>
                {' '}
                / {SLOTS}
              </T>
            </T>
            <T size={12.5} color={t.mu} leading={1.6} style={styles.lead}>
              방문한 팝업을 도장으로 기록해요. 길찾기로 도착하면 그 자리에서 인증할 수 있습니다.
            </T>

            {stamps.error ? (
              <T size={12} color={t.ac} leading={1.5} style={styles.lead}>
                {stamps.error}
              </T>
            ) : null}

            <View style={styles.grid}>
              {Array.from({ length: SLOTS }, (_, i) => {
                const stamp = filled[i];
                if (!stamp) {
                  return (
                    <View key={`empty-${i}`} style={[styles.cell, styles.locked, { borderColor: t.ln }]}>
                      <Icon name="lock" size={21} color={t.mu} strokeWidth={2} opacity={0.4} />
                      <T size={11} weight={700} color={t.mu} dim={0.75} style={styles.lockedLabel}>
                        {i === filled.length ? '다음 스탬프' : '잠김'}
                      </T>
                    </View>
                  );
                }
                const cover = stamp.popup ? popupCoverUrl(stamp.popup, 300) : null;
                return (
                  <Pressable
                    key={`filled-${stamp.id}`}
                    onPress={() => stamp.id !== undefined && navigation.navigate('Detail', { id: stamp.id })}
                    style={[styles.cell, { backgroundColor: t.sf, borderColor: t.ln, borderWidth: 1 }]}
                  >
                    <View style={[styles.stampImage, { backgroundColor: t.mp }]}>
                      {cover ? (
                        <Image source={{ uri: cover }} style={StyleSheet.absoluteFill} contentFit="cover" />
                      ) : null}
                      <View style={[styles.stampCheck, { backgroundColor: t.l4 }]}>
                        <Icon name="check" size={13} color="#0a0a0a" strokeWidth={3.2} />
                      </View>
                    </View>
                    <View style={styles.stampBody}>
                      <T size={12} weight={700} numberOfLines={1}>
                        {stamp.popup?.name ?? '기록된 팝업'}
                      </T>
                      {stamp.stampDate ? (
                        <T size={10} color={t.mu} dim={0.8} numeric style={styles.stampDate}>
                          {stamp.stampDate.slice(0, 10)}
                        </T>
                      ) : null}
                    </View>
                  </Pressable>
                );
              })}
            </View>

            <PillButton
              label="현장에서 방문 인증하기"
              icon="pin"
              height={50}
              onPress={() => navigation.navigate('Guide')}
              style={styles.verifyCta}
            />
          </>
        )}
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
  lead: { marginTop: 6, marginBottom: 12 },

  gate: { borderRadius: 20, borderWidth: 1.5, borderStyle: 'dashed', alignItems: 'center', gap: 8, paddingVertical: 40, paddingHorizontal: 24, marginTop: 20 },
  gateIcon: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  gateBody: { textAlign: 'center' },
  gateCta: { marginTop: 12, alignSelf: 'stretch' },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 6 },
  cell: { width: '48%', flexGrow: 1, borderRadius: 16, overflow: 'hidden' },
  locked: { borderWidth: 2, borderStyle: 'dashed', aspectRatio: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
  lockedLabel: { textAlign: 'center' },

  stampImage: { aspectRatio: 1 },
  stampCheck: {
    position: 'absolute',
    right: 8,
    top: 8,
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stampBody: { paddingHorizontal: 10, paddingTop: 9, paddingBottom: 11 },
  stampDate: { marginTop: 3 },

  verifyCta: { marginTop: 18 },
});
