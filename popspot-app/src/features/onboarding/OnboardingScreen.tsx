import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as Notifications from 'expo-notifications';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Icon, type IconName } from '@/components/ui/Icon';
import { T } from '@/components/ui/Text';
import { useTheme } from '@/theme/ThemeProvider';
import type { RootStackParamList } from '@/types/navigation';

/**
 * 온보딩 — 시안 02. 웹 온보딩 모달(3스텝)을 그대로.
 *
 * <p>앱에서는 <b>세 번째 스텝이 알림 권한 요청을 대신한다.</b> 권한 창을 먼저 띄우지 않고
 * "무엇을 알려줄지" 를 먼저 보여주는 순서가 수락률을 올린다(시안 노트).
 *
 * <p>권한을 거절해도 넘어간다. 알림은 이 앱의 곁가지고, 거절한 사람을 붙잡아 두면 앱 자체를
 * 지운다. 나중에 마이 &gt; 알림 설정에서 다시 켤 수 있다.
 */

const STEPS: { title: string; body: string; icon: IconName }[] = [
  {
    title: '서울 팝업을 한 화면에서',
    body: '지도 탭에서 오늘 열린 팝업을 카테고리별로 찾아볼 수 있습니다.',
    icon: 'map',
  },
  {
    title: '여러 곳을 최단 동선으로',
    body: '가고 싶은 팝업을 담으면 내 위치에서 가장 짧은 순서로 다시 짜 드립니다.',
    icon: 'zap',
  },
  {
    title: '마감 전에 알려드려요',
    body: '찜한 팝업이 3일 뒤 끝나면 알림 하나. 그 외에는 조용히 있습니다.',
    icon: 'bell',
  },
];

export default function OnboardingScreen() {
  const { t } = useTheme();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [step, setStep] = useState(0);

  const done = () => navigation.reset({ index: 0, routes: [{ name: 'Home' }] });

  const next = async () => {
    if (step < STEPS.length - 1) {
      setStep(step + 1);
      return;
    }
    /* 마지막 스텝의 버튼이 곧 권한 요청이다. 거절해도 결과를 보지 않고 넘어간다 — 여기서
       막으면 알림 하나 때문에 앱을 못 쓰게 된다. */
    await Notifications.requestPermissionsAsync().catch(() => null);
    done();
  };

  const current = STEPS[step];
  const last = step === STEPS.length - 1;

  return (
    <View style={[styles.root, { backgroundColor: t.mp }]}>
      <View style={styles.scrim} />

      <View style={[styles.card, { backgroundColor: t.sf }]}>
        <Pressable onPress={done} accessibilityLabel="건너뛰기" style={styles.close}>
          <Icon name="close" size={17} color={t.mu} strokeWidth={2.2} />
        </Pressable>

        <View style={[styles.iconWrap, { backgroundColor: t.l0 }]}>
          <Icon name={current.icon} size={28} color={t.l7} strokeWidth={1.8} />
        </View>

        <T size={19} weight={800} em={-0.01} style={styles.title}>
          {current.title}
        </T>
        <T size={13.5} color={t.mu} leading={1.65} style={styles.body}>
          {current.body}
        </T>

        <View style={styles.dots}>
          {STEPS.map((_, i) => (
            <View key={i} style={[styles.dot, { backgroundColor: i === step ? t.l5 : t.ln }]} />
          ))}
        </View>

        <View style={styles.actions}>
          <Pressable onPress={done} style={[styles.skip, { borderColor: t.l3 }]}>
            <T size={13} weight={700} color={t.l7}>
              건너뛰기
            </T>
          </Pressable>
          <Pressable onPress={next} style={[styles.next, { backgroundColor: t.l3 }]}>
            <T size={13} weight={700} color={t.hif}>
              {last ? '알림 받고 시작하기' : '다음'}
            </T>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'center', paddingHorizontal: 24 },
  scrim: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(10,10,10,.55)' },
  card: {
    borderRadius: 24,
    paddingHorizontal: 24,
    paddingTop: 32,
    paddingBottom: 22,
    shadowColor: '#0a0a0a',
    shadowOpacity: 0.24,
    shadowRadius: 40,
    shadowOffset: { width: 0, height: 16 },
    elevation: 12,
  },
  close: { position: 'absolute', top: 14, right: 16, width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  iconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: 20,
  },
  title: { textAlign: 'center', marginBottom: 10 },
  body: { textAlign: 'center' },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: 22, marginBottom: 20 },
  dot: { width: 7, height: 7, borderRadius: 3.5 },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8 },
  skip: { minHeight: 40, paddingHorizontal: 18, borderRadius: 999, borderWidth: 1, justifyContent: 'center' },
  next: { minHeight: 40, paddingHorizontal: 22, borderRadius: 999, justifyContent: 'center' },
});
