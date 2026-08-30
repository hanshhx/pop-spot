import { useNavigation } from '@react-navigation/native';
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
import { sendSignupCode, signup, verifyEmailCode } from './authApi';
import {
  checkEmail,
  checkNickname,
  checkPassword,
  checkPasswordMatch,
  checkPhone,
  normalizePhone,
} from './validate';

/**
 * 회원가입 — 시안 04.
 *
 * <p>시안의 필드를 그대로 뒀다. 상태 문구도 웹과 같다 — 검사 규칙은 {@code validate.ts} 에 있고
 * 테스트가 붙어 있다.
 *
 * <p>시안의 이메일 인증(6자리)도 그대로 있다. 서버에 {@code /api/v1/auth/email/send} 와
 * {@code /email/verify} 가 실재해서 붙였다 — 웹 가입 화면이 부르는 것과 같은 문이다.
 *
 * <p><b>인증을 마쳐야 가입 버튼이 열린다.</b> 서버가 어차피 다시 검사하지만, 다 채우고 눌렀다가
 * "이메일 인증이 필요합니다" 로 되돌아오면 어디를 고쳐야 하는지 알 수 없다.
 */

/** 시안의 약관 세 줄. 전부 필수라 전체 동의 하나로 묶여 있다. */
const AGREEMENTS = [
  { key: 'age', label: '[필수] 본인은 만 14세 이상입니다.', hasView: false },
  { key: 'terms', label: '[필수] POP-SPOT 서비스 이용약관', hasView: true },
  { key: 'privacy', label: '[필수] 개인정보 처리방침에 동의합니다', hasView: true },
];

export default function SignupScreen() {
  const { t } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [nickname, setNickname] = useState('');
  const [phone, setPhone] = useState('');
  const [agreed, setAgreed] = useState(false);

  /* 인증은 세 단계다 — 아직 안 보냄 / 보냄(코드 입력 중) / 확인됨. 불리언 두 개로 나누면
     "보냈는데 확인 안 됨" 과 "안 보냄" 이 같은 모양이 되어 버튼 문구를 고를 수 없다. */
  const [emailStep, setEmailStep] = useState<'idle' | 'sent' | 'verified'>('idle');
  const [code, setCode] = useState('');
  const [codeError, setCodeError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /* 입력하기 전에는 빨간 글씨를 보이지 않는다 — 아직 틀린 게 아니라 아직 안 쓴 것이다. */
  const emailCheck = email ? checkEmail(email) : null;
  const passwordCheck = password ? checkPassword(password) : null;
  const matchCheck = confirm ? checkPasswordMatch(password, confirm) : null;
  const nicknameCheck = nickname ? checkNickname(nickname) : null;
  const phoneCheck = phone ? checkPhone(phone) : null;

  const ready =
    agreed &&
    emailStep === 'verified' &&
    checkEmail(email).ok &&
    checkPassword(password).ok &&
    checkPasswordMatch(password, confirm).ok &&
    checkNickname(nickname).ok &&
    checkPhone(phone).ok;

  const sendCode = async () => {
    if (!checkEmail(email).ok) return;
    setCodeError(null);
    const failure = await sendSignupCode(email.trim());
    if (failure) {
      setCodeError(failure);
      return;
    }
    setEmailStep('sent');
  };

  const confirmCode = async () => {
    setCodeError(null);
    const failure = await verifyEmailCode(email.trim(), code.trim(), 'SIGNUP');
    if (failure) {
      setCodeError(failure);
      return;
    }
    setEmailStep('verified');
  };

  const submit = async () => {
    if (!ready || busy) return;
    setBusy(true);
    setError(null);

    const result = await signup({
      email: email.trim(),
      password,
      nickname: nickname.trim(),
      phoneNumber: normalizePhone(phone),
    });

    if (result.kind === 'ok') {
      navigation.reset({ index: 0, routes: [{ name: 'Home' }] });
      return;
    }
    setError(result.kind === 'error' ? result.message : '가입 후 추가 인증이 필요합니다.');
    setBusy(false);
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={[styles.root, { backgroundColor: t.bg }]}
    >
      <ScrollView
        contentContainerStyle={[styles.body, { paddingTop: insets.top + 16 }]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.head}>
          <Pressable onPress={navigation.goBack} accessibilityLabel="뒤로" style={styles.back}>
            <Icon name="arrowLeft" size={19} color={t.ik} strokeWidth={2.2} />
          </Pressable>
          <T size={20} weight={800} em={-0.02} style={styles.grow}>
            회원가입
          </T>
          <T size={10} weight={700} color={t.mu} dim={0.7} numeric>
            30초
          </T>
        </View>

        <Field
          label="이메일 (아이디)"
          value={email}
          onChangeText={(next) => {
            setEmail(next);
            /* 주소를 고치면 앞서 받은 인증은 무효다 — 남겨 두면 다른 주소로 가입된다. */
            if (emailStep !== 'idle') setEmailStep('idle');
          }}
          placeholder="popspot@naver.com"
          keyboardType="email-address"
          autoCapitalize="none"
          editable={emailStep !== 'verified'}
          height={46}
          hint={
            emailStep === 'verified'
              ? '이메일 인증 완료'
              : emailCheck && !emailCheck.ok
                ? emailCheck.message
                : undefined
          }
          ok={emailStep === 'verified'}
          error={emailCheck ? !emailCheck.ok : false}
          action={
            emailStep === 'verified'
              ? undefined
              : { label: emailStep === 'sent' ? '다시 받기' : '인증하기', onPress: sendCode }
          }
        />

        {emailStep === 'sent' ? (
          <Field
            label="인증번호 6자리"
            value={code}
            onChangeText={setCode}
            placeholder="메일로 받은 숫자"
            keyboardType="number-pad"
            maxLength={6}
            height={46}
            hint={codeError ?? '메일함을 확인해 주세요. 오지 않으면 스팸함도 확인해 주세요.'}
            error={codeError !== null}
            action={{ label: '확인', onPress: confirmCode, primary: true }}
          />
        ) : null}

        {emailStep === 'idle' && codeError ? (
          <T size={11.5} color="#ee1a64" leading={1.5} style={styles.error}>
            {codeError}
          </T>
        ) : null}

        <Field
          label="비밀번호"
          value={password}
          onChangeText={setPassword}
          placeholder="영문 · 숫자 · 특수문자 8~20자"
          secure
          autoCapitalize="none"
          height={46}
          hint={passwordCheck?.message}
          ok={passwordCheck?.ok ?? false}
          error={passwordCheck ? !passwordCheck.ok : false}
        />

        <Field
          label="비밀번호 확인"
          value={confirm}
          onChangeText={setConfirm}
          placeholder="한 번 더 입력"
          secure
          autoCapitalize="none"
          height={46}
          hint={matchCheck?.message}
          ok={matchCheck?.ok ?? false}
          error={matchCheck ? !matchCheck.ok : false}
        />

        <Field
          label="이름 (닉네임)"
          value={nickname}
          onChangeText={setNickname}
          placeholder="성수러버"
          height={46}
          hint={nicknameCheck && !nicknameCheck.ok ? nicknameCheck.message : '한글, 영문, 숫자 2~8자리만 가능합니다.'}
          error={nicknameCheck ? !nicknameCheck.ok : false}
        />

        <Field
          label="휴대전화"
          value={phone}
          onChangeText={setPhone}
          placeholder="01012345678"
          keyboardType="number-pad"
          height={46}
          hint={phoneCheck && !phoneCheck.ok ? phoneCheck.message : '010으로 시작하는 11자리 숫자만 입력 가능합니다.'}
          error={phoneCheck ? !phoneCheck.ok : false}
        />

        <View style={[styles.agreeBox, { backgroundColor: t.sf, borderColor: t.ln }]}>
          <Pressable onPress={() => setAgreed((a) => !a)} style={[styles.agreeAll, { borderBottomColor: t.ln }]}>
            <View
              style={[
                styles.checkBox,
                { width: 20, height: 20, borderColor: agreed ? t.l4 : t.ln, backgroundColor: agreed ? t.l4 : 'transparent' },
              ]}
            >
              {agreed ? <Icon name="check" size={12} color="#0a0a0a" strokeWidth={3.4} /> : null}
            </View>
            <T size={13.5} weight={800}>
              전체 약관에 동의합니다
            </T>
          </Pressable>

          {AGREEMENTS.map((a, i) => (
            <View
              key={a.key}
              style={[
                styles.agreeRow,
                { borderBottomColor: i === AGREEMENTS.length - 1 ? 'transparent' : t.ln },
              ]}
            >
              <View
                style={[
                  styles.checkBox,
                  { borderColor: agreed ? t.l4 : t.ln, backgroundColor: agreed ? t.l4 : 'transparent' },
                ]}
              >
                {agreed ? <Icon name="check" size={10} color="#0a0a0a" strokeWidth={3.6} /> : null}
              </View>
              <T size={12} color={t.mu} style={styles.grow}>
                {a.label}
              </T>
              {a.hasView ? (
                <T size={11} weight={700} color={t.l7} style={styles.underline}>
                  보기
                </T>
              ) : null}
            </View>
          ))}
        </View>

        {error ? (
          <T size={12} color="#ee1a64" leading={1.5} style={styles.error}>
            {error}
          </T>
        ) : null}

        <PillButton
          label={busy ? '가입하는 중…' : 'POP-SPOT 시작하기'}
          fontSize={15}
          height={52}
          disabled={!ready || busy}
          onPress={submit}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  grow: { flex: 1 },
  body: { paddingHorizontal: 20, paddingBottom: 40 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 20 },
  back: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },

  checkBox: {
    width: 16,
    height: 16,
    borderRadius: 5,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  agreeBox: { borderRadius: 14, borderWidth: 1, paddingHorizontal: 14, marginBottom: 18, marginTop: 4 },
  agreeAll: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 13, borderBottomWidth: 1 },
  agreeRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 11, borderBottomWidth: 1 },
  underline: { textDecorationLine: 'underline' },

  error: { marginBottom: 12 },
});
