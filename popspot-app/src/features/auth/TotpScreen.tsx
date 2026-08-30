import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Field } from '@/components/ui/Field';
import { Icon } from '@/components/ui/Icon';
import { PillButton } from '@/components/ui/PillButton';
import { T } from '@/components/ui/Text';
import { useTheme } from '@/theme/ThemeProvider';
import type { RootStackParamList } from '@/types/navigation';
import { verifyTotp } from './authApi';

/**
 * 로그인 2단계 — 인증 앱의 6자리 또는 복구 코드. 웹 {@code features/auth/TotpChallenge.tsx} 의 앱 판.
 *
 * <p><b>이메일 로그인과 소셜 로그인이 이 화면을 함께 쓴다.</b> 따로 만들면 한쪽만 고치는 사고가
 * 난다 — 실제로 백엔드에서 이메일 경로만 막았다가 소셜이 통째로 우회하는 것을 뒤늦게 발견한 적이
 * 있다({@code OAuth2SuccessHandler} 주석: "방어는 가장 약한 경로만큼만 강하다").
 *
 * <p><b>표는 한 번 쓰면 사라진다.</b> 코드를 틀리면 서버에서 이미 없어졌으므로 재입력을 시켜 봐야
 * 무조건 실패한다 — 같은 표로 6자리를 계속 대입하지 못하게 하려는 설계다. 그래서 틀린 뒤에는
 * 입력칸을 잠그고 "처음부터 다시" 로 보낸다.
 *
 * <p>이 화면이 없던 동안 앱은 2단계 인증 계정에 "웹에서 로그인해 주세요" 만 말했다. 그런데 이
 * 서비스의 주 관리자 계정이 <b>카카오 + 관리자</b>라, 사실상 앱에서 관리자 로그인이 불가능했다.
 */
export default function TotpScreen() {
  const { t } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { challengeToken } = useRoute<RouteProp<RootStackParamList, 'Totp'>>().params;

  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [useRecovery, setUseRecovery] = useState(false);
  /** 표를 이미 써 버렸다 — 다시 시도하려면 로그인부터. */
  const [spent, setSpent] = useState(false);

  const submit = async () => {
    const value = code.trim();
    if (busy || spent || !value) return;

    setBusy(true);
    setError(null);
    const result = await verifyTotp(challengeToken, value);
    setBusy(false);

    if (result.kind === 'ok') {
      /* 이메일·소셜 로그인이 성공했을 때와 <b>같은 자리</b>로 보낸다. 경로가 갈리면 나중에
         한쪽만 고치게 된다. */
      navigation.reset({ index: 0, routes: [{ name: 'Home' }] });
      return;
    }
    if (result.kind === 'totp') {
      /* 표를 냈는데 또 표가 오는 경우는 없다. 와도 무한 왕복을 만들지 않는다. */
      setSpent(true);
      setError('인증을 마치지 못했어요. 처음부터 다시 로그인해 주세요.');
      return;
    }
    /* 서버에서 표가 이미 사라졌다 — 재입력은 무조건 실패한다. */
    setSpent(true);
    setError(result.message);
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={[styles.root, { backgroundColor: t.bg }]}
    >
      <View style={[styles.glow, { backgroundColor: t.l3 }]} />

      <ScrollView
        contentContainerStyle={[styles.body, { paddingTop: insets.top + 20 }]}
        keyboardShouldPersistTaps="handled"
      >
        <Pressable onPress={navigation.goBack} accessibilityLabel="뒤로" style={styles.back}>
          <Icon name="arrowLeft" size={19} color={t.mu} strokeWidth={2.2} />
        </Pressable>

        <View style={styles.head}>
          <Icon name="lock" size={20} color={t.l7} strokeWidth={2.2} />
          <T size={17} weight={800} em={-0.01}>
            2단계 인증
          </T>
        </View>

        <T size={13} color={t.mu} leading={1.55} style={styles.lead}>
          {useRecovery
            ? '저장해 둔 복구 코드 하나를 입력하세요. 한 번 쓰면 사라집니다.'
            : '인증 앱에 표시된 6자리를 입력하세요.'}
        </T>

        <Field
          label={useRecovery ? '복구 코드' : '인증 코드'}
          icon="lock"
          value={code}
          onChangeText={(next) => {
            /* 인증 앱 코드는 숫자만, 복구 코드는 영문·하이픈이 섞인다. */
            setCode(useRecovery ? next : next.replace(/\D/g, '').slice(0, 6));
            setError(null);
          }}
          placeholder={useRecovery ? 'XXXX-XXXX' : '000000'}
          keyboardType={useRecovery ? 'default' : 'number-pad'}
          autoCapitalize="none"
          autoComplete="one-time-code"
          editable={!spent}
          onSubmitEditing={submit}
          returnKeyType="go"
        />

        {error ? (
          <T size={12} color="#ee1a64" leading={1.5} style={styles.message}>
            {error}
          </T>
        ) : null}

        {spent ? (
          <PillButton
            label="다시 로그인"
            fontSize={15}
            onPress={() => navigation.reset({ index: 0, routes: [{ name: 'Login' }] })}
            style={styles.submit}
          />
        ) : (
          <PillButton
            label={busy ? '확인하는 중…' : '확인'}
            fontSize={15}
            disabled={busy || code.trim().length === 0}
            onPress={submit}
            style={styles.submit}
          />
        )}

        {!spent ? (
          <Pressable
            onPress={() => {
              setUseRecovery((v) => !v);
              setCode('');
              setError(null);
            }}
            style={styles.toggle}
          >
            <T size={12} color={t.mu} style={styles.underline}>
              {useRecovery ? '인증 앱 코드로 입력' : '인증 앱을 쓸 수 없나요? 복구 코드 사용'}
            </T>
          </Pressable>
        ) : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  glow: {
    position: 'absolute',
    right: -70,
    top: 40,
    width: 240,
    height: 240,
    borderRadius: 120,
    opacity: 0.12,
  },
  body: { paddingHorizontal: 22, paddingBottom: 40 },
  back: { width: 40, height: 40, justifyContent: 'center', marginLeft: -8, marginBottom: 8 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 8 },
  lead: { marginBottom: 20 },
  message: { marginTop: 12 },
  submit: { marginTop: 18 },
  toggle: { marginTop: 16, alignItems: 'center' },
  underline: { textDecorationLine: 'underline' },
});
