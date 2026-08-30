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
import { findEmail, resetPassword, sendResetCode, type FoundAccount } from './accountApi';
import { verifyEmailCode } from './authApi';
import { checkPassword, normalizePhone } from './validate';

/**
 * 계정 찾기 — 시안 05. 웹 {@code app/find-account/page.tsx} 와 같은 두 탭.
 *
 * <p>아이디 찾기는 한 번에 끝나고, 비밀번호 찾기는 세 단계다(이메일·이름 → 인증번호 → 새 비밀번호).
 * 시안이 그린 진행 막대가 그 세 단계다.
 */

type Tab = 'id' | 'pw';

export default function FindAccountScreen() {
  const { t } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const [tab, setTab] = useState<Tab>('id');

  /* 아이디 찾기 */
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [found, setFound] = useState<FoundAccount | null>(null);
  const [idMessage, setIdMessage] = useState<string | null>(null);

  /* 비밀번호 찾기 */
  const [pwStep, setPwStep] = useState<1 | 2 | 3>(1);
  const [pwEmail, setPwEmail] = useState('');
  const [pwName, setPwName] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [pwMessage, setPwMessage] = useState<string | null>(null);

  const [busy, setBusy] = useState(false);

  const run = async (task: () => Promise<void>) => {
    if (busy) return;
    setBusy(true);
    await task();
    setBusy(false);
  };

  const doFindId = () =>
    run(async () => {
      setIdMessage(null);
      setFound(null);
      const result = await findEmail(name.trim(), normalizePhone(phone));
      if (result.kind === 'ok') setFound(result.account);
      else if (result.kind === 'notFound') setIdMessage('입력하신 정보와 맞는 계정이 없어요.');
      else setIdMessage(result.message);
    });

  const doSendCode = () =>
    run(async () => {
      setPwMessage(null);
      const failure = await sendResetCode(pwEmail.trim(), pwName.trim());
      if (failure) setPwMessage(failure);
      else setPwStep(2);
    });

  const doVerify = () =>
    run(async () => {
      setPwMessage(null);
      const failure = await verifyEmailCode(pwEmail.trim(), code.trim(), 'PASSWORD_RESET');
      if (failure) setPwMessage(failure);
      else setPwStep(3);
    });

  const doReset = () =>
    run(async () => {
      setPwMessage(null);
      const check = checkPassword(newPassword);
      if (!check.ok) {
        setPwMessage(check.message);
        return;
      }
      const failure = await resetPassword(pwEmail.trim(), newPassword);
      if (failure) setPwMessage(failure);
      else navigation.navigate('Login');
    });

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
          <T size={20} weight={800} em={-0.02}>
            계정 찾기
          </T>
        </View>

        <View style={[styles.tabs, { backgroundColor: t.mp }]}>
          {([['id', '아이디 찾기'], ['pw', '비밀번호 찾기']] as const).map(([key, label]) => (
            <Pressable
              key={key}
              onPress={() => setTab(key)}
              style={[styles.tab, tab === key && { backgroundColor: t.l3 }]}
            >
              <T size={13} weight={800} color={tab === key ? t.hif : t.mu}>
                {label}
              </T>
            </Pressable>
          ))}
        </View>

        {tab === 'id' ? (
          <>
            <Field label="이름 (닉네임)" value={name} onChangeText={setName} placeholder="가입한 이름" />
            <Field
              label="휴대폰 번호"
              value={phone}
              onChangeText={setPhone}
              placeholder="01012345678"
              keyboardType="number-pad"
            />
            <PillButton
              label={busy ? '찾는 중…' : '내 아이디 찾기'}
              disabled={busy}
              onPress={doFindId}
              style={styles.cta}
            />

            {found ? (
              <View style={[styles.result, { backgroundColor: t.sf, borderColor: t.ln }]}>
                <T size={12.5} color={t.mu}>
                  회원님의 아이디는
                </T>
                <T size={16} weight={800} em={-0.01} style={styles.resultEmail}>
                  {maskEmail(found.email)}
                </T>
                <T size={12.5} color={t.mu}>
                  입니다.
                </T>
                {found.provider ? (
                  <View style={[styles.provider, { backgroundColor: t.sft }]}>
                    <T size={11} weight={700} color={t.l7}>
                      가입 계정 · {found.provider}
                    </T>
                  </View>
                ) : null}
              </View>
            ) : null}

            {idMessage ? (
              <T size={12} color="#ee1a64" leading={1.5}>
                {idMessage}
              </T>
            ) : null}
          </>
        ) : (
          <>
            <View style={styles.steps}>
              {[1, 2, 3].map((n) => (
                <View
                  key={n}
                  style={[styles.step, { backgroundColor: n <= pwStep ? t.l4 : t.ln }]}
                />
              ))}
            </View>
            <T size={10} weight={700} em={0.1} color={t.l7} numeric style={styles.stepLabel}>
              STEP {pwStep} · {['이메일 확인', '인증번호 확인', '새 비밀번호'][pwStep - 1]}
            </T>

            <Field
              label="이메일 (아이디)"
              value={pwEmail}
              onChangeText={setPwEmail}
              placeholder="popspot@naver.com"
              keyboardType="email-address"
              autoCapitalize="none"
              editable={pwStep === 1}
              ok={pwStep > 1}
            />

            {pwStep === 1 ? (
              <>
                <Field label="이름 (닉네임)" value={pwName} onChangeText={setPwName} placeholder="가입한 이름" />
                <PillButton
                  label={busy ? '보내는 중…' : '인증번호 받기'}
                  disabled={busy}
                  onPress={doSendCode}
                  style={styles.cta}
                />
              </>
            ) : null}

            {pwStep === 2 ? (
              <>
                <Field
                  label="인증번호 6자리"
                  value={code}
                  onChangeText={setCode}
                  placeholder="메일로 받은 숫자"
                  keyboardType="number-pad"
                  maxLength={6}
                  hint="메일함을 확인해 주세요. 오지 않으면 스팸함도 확인해 주세요."
                />
                <PillButton label={busy ? '확인하는 중…' : '다음'} disabled={busy} onPress={doVerify} style={styles.cta} />
                <PillButton
                  label="인증번호 다시 받기"
                  variant="outline"
                  height={44}
                  fontSize={13}
                  disabled={busy}
                  onPress={doSendCode}
                />
              </>
            ) : null}

            {pwStep === 3 ? (
              <>
                <Field
                  label="새 비밀번호"
                  value={newPassword}
                  onChangeText={setNewPassword}
                  placeholder="영문 · 숫자 · 특수문자 8~20자"
                  secure
                  autoCapitalize="none"
                  hint={newPassword ? checkPassword(newPassword).message : undefined}
                  ok={newPassword ? checkPassword(newPassword).ok : false}
                  error={newPassword ? !checkPassword(newPassword).ok : false}
                />
                <PillButton
                  label={busy ? '바꾸는 중…' : '비밀번호 바꾸기'}
                  disabled={busy}
                  onPress={doReset}
                  style={styles.cta}
                />
              </>
            ) : null}

            {pwMessage ? (
              <T size={12} color="#ee1a64" leading={1.5}>
                {pwMessage}
              </T>
            ) : null}
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

/**
 * 아이디를 부분만 보여준다.
 *
 * <p>이름과 전화번호만 알면 누구나 부를 수 있는 화면이라, 전체 주소를 그대로 내보내면 <b>남의
 * 이메일을 알아내는 도구</b>가 된다. 본인은 앞 다섯 자만 봐도 자기 계정인지 안다.
 */
function maskEmail(email: string): string {
  const at = email.indexOf('@');
  if (at <= 0) return email;
  const local = email.slice(0, at);
  const domain = email.slice(at);
  const head = local.slice(0, Math.min(5, local.length));
  return `${head}${'*'.repeat(Math.max(1, local.length - head.length))}${domain}`;
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  body: { paddingHorizontal: 20, paddingBottom: 40 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 22 },
  back: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },

  tabs: { flexDirection: 'row', gap: 4, padding: 4, borderRadius: 14, marginBottom: 22 },
  tab: { flex: 1, minHeight: 40, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },

  cta: { marginTop: 8, marginBottom: 10 },

  result: { borderRadius: 16, borderWidth: 1, padding: 18, alignItems: 'center', marginTop: 8 },
  resultEmail: { marginVertical: 7 },
  provider: { marginTop: 12, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },

  steps: { flexDirection: 'row', gap: 6, marginBottom: 20 },
  step: { flex: 1, height: 3, borderRadius: 2 },
  stepLabel: { marginBottom: 12 },
});
