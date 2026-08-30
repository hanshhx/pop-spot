import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Wordmark } from '@/components/layout/Wordmark';
import { Field } from '@/components/ui/Field';
import { Icon } from '@/components/ui/Icon';
import { PillButton } from '@/components/ui/PillButton';
import { T } from '@/components/ui/Text';
import { useTheme } from '@/theme/ThemeProvider';
import type { RootStackParamList } from '@/types/navigation';
import { login } from './authApi';
import type { SocialProvider } from './socialAuth';
import { RESULT_FRESH_MS, useSocialLoginStore } from './useSocialLogin';

/**
 * 로그인 — 시안 03. 웹 {@code app/login/page.tsx} 와 같은 엔드포인트를 부른다.
 *
 * <p>시안은 웹 로그인 화면을 그대로 옮겼다 — 로고 록업 · 이메일/비밀번호 · 아이디 저장 ·
 * 아이디·비밀번호 찾기 · 소셜 3종 · 게스트 둘러보기. 웹의 계절 배경 영상은 배터리 때문에 앱에서
 * 단색 + 라임 글로우로 대신한다(시안 노트).
 *
 * <h3>소셜 로그인 버튼</h3>
 *
 * <p>브라우저를 열어 웹을 한 번 거쳐 돌아온다({@code socialAuth.ts} 주석에 흐름이 있다).
 * 네이티브 SDK 를 붙이지 않은 이유는 그것이 <b>새 빌드</b>를 요구하고, 세 제공자마다 앱 등록·키
 * 해시·심사가 따로 필요하기 때문이다. 지금 방식은 백엔드도 앱 빌드도 건드리지 않는다.
 *
 * <p>진행 상태를 이 화면이 들고 있지 않는 것에 주의. 브라우저에 다녀오는 동안 안드로이드가 앱을
 * 죽일 수 있어서, 듣는 곳은 앱 뿌리이고 이 화면은 결과를 <b>구경만</b> 한다
 * ({@link useSocialLoginStore}).
 */

/** 웹과 같은 키를 쓴다 — 아이디 저장은 계정이 아니라 편의 기능이라 평문 저장소로 충분하다. */
const SAVED_EMAIL_KEY = 'savedEmail';

export default function LoginScreen() {
  const { t } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [saveId, setSaveId] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    AsyncStorage.getItem(SAVED_EMAIL_KEY)
      .then((saved) => {
        if (saved) {
          setEmail(saved);
          setSaveId(true);
        }
      })
      .catch(() => {});
  }, []);

  const socialPending = useSocialLoginStore((s) => s.pending);
  const socialResult = useSocialLoginStore((s) => s.result);
  const socialResultAt = useSocialLoginStore((s) => s.resultAt);
  const startSocial = useSocialLoginStore((s) => s.start);
  const consumeSocial = useSocialLoginStore((s) => s.consume);

  /**
   * 소셜 로그인의 결과를 화면에 옮긴다.
   *
   * <p>토큰 저장은 이미 뿌리에서 끝났다. 여기서 하는 일은 <b>이동과 안내</b>뿐이다 — 성공했으면
   * 이메일 로그인과 <b>같은 자리</b>로 보낸다. 두 경로가 다른 곳으로 가면 나중에 한쪽만 고치게 된다.
   */
  useEffect(() => {
    if (!socialResult) return;
    consumeSocial();
    /* 콜드 스타트로 로그인이 끝났다면 이 화면은 그때 없었다. 한참 뒤에 로그인 화면을 연 사람에게
       그때의 결과로 화면을 움직이면 이유 없이 튕긴 것으로 보인다. */
    if (Date.now() - socialResultAt > RESULT_FRESH_MS) return;
    if (socialResult.kind === 'ok') {
      navigation.reset({ index: 0, routes: [{ name: 'Home' }] });
      return;
    }
    if (socialResult.kind === 'totp') {
      /* 2단계 인증 화면이 아직 없다. 토큰 없이 홈으로 보내면 로그인된 줄 알고 도는 것이 더 나쁘다. */
      setError('이 계정은 2단계 인증이 켜져 있어요. 지금은 웹에서 로그인해 주세요.');
      return;
    }
    setError(socialResult.message);
  }, [socialResult, socialResultAt, consumeSocial, navigation]);

  const submit = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);

    const result = await login(email.trim(), password);

    if (result.kind === 'ok') {
      await AsyncStorage.setItem(SAVED_EMAIL_KEY, saveId ? email.trim() : '').catch(() => {});
      navigation.reset({ index: 0, routes: [{ name: 'Home' }] });
      return;
    }
    if (result.kind === 'totp') {
      /* 2단계 인증 화면은 아직 없다. 토큰 없이 홈으로 보내면 로그인된 줄 알고 도는 것이 더 나쁘다. */
      setError('이 계정은 2단계 인증이 켜져 있어요. 지금은 웹에서 로그인해 주세요.');
    } else {
      setError(result.message);
    }
    setBusy(false);
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={[styles.root, { backgroundColor: t.bg }]}
    >
      {/* 웹의 계절 배경 영상 대신 — 배터리를 쓰지 않는 라임 글로우 두 겹. */}
      <View style={[styles.glowA, { backgroundColor: t.l3 }]} />
      <View style={[styles.glowB, { backgroundColor: t.hi }]} />

      <ScrollView
        contentContainerStyle={[styles.body, { paddingTop: insets.top + 20 }]}
        keyboardShouldPersistTaps="handled"
      >
        <Pressable onPress={navigation.goBack} accessibilityLabel="뒤로" style={styles.back}>
          <Icon name="arrowLeft" size={19} color={t.mu} strokeWidth={2.2} />
        </Pressable>

        <View style={styles.logo}>
          <Wordmark height={28} />
        </View>
        <T size={13} color={t.mu} style={styles.lead}>
          다시 오셨네요
        </T>

        <Field
          label="이메일"
          icon="mail"
          value={email}
          onChangeText={setEmail}
          placeholder="you@example.com"
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
        />
        <Field
          label="비밀번호"
          icon="lock"
          value={password}
          onChangeText={setPassword}
          placeholder="비밀번호"
          secure
          autoCapitalize="none"
          onSubmitEditing={submit}
          returnKeyType="go"
        />

        <View style={styles.optionRow}>
          <Pressable onPress={() => setSaveId((s) => !s)} style={styles.check}>
            <View
              style={[
                styles.checkBox,
                { borderColor: saveId ? t.l4 : t.ln, backgroundColor: saveId ? t.l4 : 'transparent' },
              ]}
            >
              {saveId ? <Icon name="check" size={11} color="#0a0a0a" strokeWidth={3.4} /> : null}
            </View>
            <T size={12} color={t.mu}>
              아이디 저장
            </T>
          </Pressable>

          <Pressable onPress={() => navigation.navigate('FindAccount')}>
            <T size={12} color={t.mu} style={styles.underline}>
              아이디 · 비밀번호 찾기
            </T>
          </Pressable>
        </View>

        {error ? (
          <T size={12} color="#ee1a64" leading={1.5} style={styles.message}>
            {error}
          </T>
        ) : null}

        <PillButton
          label={busy ? '확인하는 중…' : '로그인'}
          fontSize={15}
          disabled={busy}
          onPress={submit}
          style={styles.submit}
        />

        <View style={styles.divider}>
          <View style={[styles.line, { backgroundColor: t.ln }]} />
          <T size={11} color={t.mu} dim={0.7}>
            소셜 로그인
          </T>
          <View style={[styles.line, { backgroundColor: t.ln }]} />
        </View>

        <View style={styles.socials}>
          {SOCIALS.map((s) => (
            <Pressable
              key={s.key}
              disabled={busy || socialPending !== null}
              onPress={() => {
                setError(null);
                setNotice(null);
                void startSocial(s.key);
              }}
              style={[
                styles.social,
                { backgroundColor: s.bg },
                s.border ? { borderWidth: 1, borderColor: 'rgba(10,10,10,.12)' } : null,
                socialPending !== null && socialPending !== s.key ? styles.dim : null,
              ]}
            >
              <T size={13.5} weight={700} color={s.fg}>
                {socialPending === s.key ? `${s.label} 로그인 중…` : `${s.label}로 시작하기`}
              </T>
            </Pressable>
          ))}
        </View>

        {notice ? (
          <T size={11.5} color={t.mu} leading={1.5} style={styles.message}>
            {notice}
          </T>
        ) : null}

        <Pressable
          onPress={() => navigation.reset({ index: 0, routes: [{ name: 'Home' }] })}
          style={[styles.guest, { borderColor: t.ln }]}
        >
          <Icon name="clock" size={15} color={t.ik} />
          <T size={13.5} weight={700}>
            로그인 없이 둘러보기
          </T>
        </Pressable>
        <T size={11} color={t.mu} dim={0.7} leading={1.55} style={styles.guestNote}>
          지도·검색·상세는 가입 없이 볼 수 있어요. 찜과 스탬프는 로그인이 필요합니다.
        </T>

        <View style={styles.signupRow}>
          <T size={13} color={t.mu}>
            아직 회원이 아니신가요?
          </T>
          <Pressable onPress={() => navigation.navigate('Signup')}>
            <T size={13} weight={800} color={t.l7}>
              회원가입
            </T>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

/** 브랜드 색은 각 사의 가이드 값이라 토큰을 쓰지 않는다. */
const SOCIALS: { key: SocialProvider; label: string; bg: string; fg: string; border: boolean }[] = [
  { key: 'kakao', label: '카카오', bg: '#FEE500', fg: '#0a0a0a', border: false },
  { key: 'naver', label: '네이버', bg: '#03C75A', fg: '#ffffff', border: false },
  { key: 'google', label: 'Google', bg: '#ffffff', fg: '#0a0a0a', border: true },
];

const styles = StyleSheet.create({
  root: { flex: 1 },
  glowA: { position: 'absolute', left: -60, bottom: -40, width: 300, height: 300, borderRadius: 150, opacity: 0.16 },
  glowB: { position: 'absolute', right: -70, top: 60, width: 220, height: 220, borderRadius: 110, opacity: 0.1 },

  body: { paddingHorizontal: 20, paddingBottom: 40 },
  back: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center', marginBottom: 22 },
  logo: { alignItems: 'center', marginBottom: 8 },
  lead: { textAlign: 'center', marginBottom: 28 },

  optionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 },
  check: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  checkBox: { width: 18, height: 18, borderRadius: 5, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  underline: { textDecorationLine: 'underline' },

  message: { marginBottom: 12 },
  submit: { marginBottom: 20 },

  divider: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 18 },
  line: { flex: 1, height: 1 },

  socials: { gap: 9, marginBottom: 22 },
  dim: { opacity: 0.45 },
  social: { minHeight: 46, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },

  guest: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    minHeight: 46,
    borderRadius: 999,
    borderWidth: 1,
  },
  guestNote: { textAlign: 'center', marginTop: 9 },

  signupRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, marginTop: 24 },
});
