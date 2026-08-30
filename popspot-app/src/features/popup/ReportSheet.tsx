import { useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, View } from 'react-native';

import { Field } from '@/components/ui/Field';
import { Icon } from '@/components/ui/Icon';
import { PillButton } from '@/components/ui/PillButton';
import { T } from '@/components/ui/Text';
import { checkEmail } from '@/features/auth/validate';
import { apiFetch } from '@/lib/api';
import { useTheme } from '@/theme/ThemeProvider';

/**
 * 정보 수정 요청 · 신고하기 — 시안 상세 아래 두 버튼이 여는 시트.
 *
 * <p><b>둘은 서로 다른 문으로 나간다.</b> 겉보기엔 비슷한 "문제를 알린다" 지만 뒤에서 하는 일이
 * 다르다.
 *
 * <ul>
 *   <li><b>수정 요청</b> → {@code POST /api/feedback}. 날짜가 틀렸다거나 이미 끝났다는 제보다.
 *       운영자가 고치면 끝이고, 급하지 않다.
 *   <li><b>신고</b> → {@code POST /api/popups/:id/takedown}. 권리 침해·허위 게시물 신고이고,
 *       이용약관 §11 에 <b>24시간 내 검토</b>가 걸려 있다. 그래서 연락받을 이메일을 받는다 —
 *       검토 결과를 알려야 하는 절차라 익명으로 받을 수 없다.
 * </ul>
 *
 * <p>두 흐름을 한 엔드포인트로 합치고 싶어지지만, 합치면 신고가 일반 의견함에 섞여 24시간
 * 약속을 지킬 수 없게 된다.
 */

export type ReportMode = 'fix' | 'takedown';

export interface ReportSheetProps {
  mode: ReportMode | null;
  popupId: number;
  popupName: string;
  onClose: () => void;
}

/** 신고 사유. 웹 {@code TakedownModal} 과 같은 갈래. */
const TAKEDOWN_REASONS = [
  '저작권·상표권 침해',
  '허위 또는 사칭 게시물',
  '이미 종료된 팝업',
  '그 밖의 사유',
];

const COPY: Record<ReportMode, { title: string; lead: string; label: string; cta: string }> = {
  fix: {
    title: '정보 수정 요청',
    lead: '날짜·장소·이름이 실제와 다르면 알려 주세요. 확인 후 고칩니다.',
    label: '무엇이 다른가요',
    cta: '수정 요청 보내기',
  },
  takedown: {
    title: '신고하기',
    lead: '권리 침해나 허위 게시물을 신고합니다. 접수하면 24시간 안에 검토합니다.',
    label: '자세한 내용',
    cta: '신고 접수',
  },
};

export function ReportSheet({ mode, popupId, popupName, onClose }: ReportSheetProps) {
  const { t } = useTheme();
  const [reason, setReason] = useState(TAKEDOWN_REASONS[0]);
  const [detail, setDetail] = useState('');
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  if (mode === null) return null;
  const copy = COPY[mode];

  /* 신고는 연락받을 주소가 있어야 접수된다. 수정 요청은 없어도 된다. */
  const emailOk = mode === 'fix' ? true : checkEmail(email).ok;
  const ready = detail.trim().length > 0 && emailOk && !busy;

  const close = () => {
    setDetail('');
    setEmail('');
    setError(null);
    setDone(false);
    onClose();
  };

  const submit = async () => {
    if (!ready) return;
    setBusy(true);
    setError(null);

    try {
      const res =
        mode === 'takedown'
          ? await apiFetch(`/api/popups/${popupId}/takedown`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ requesterEmail: email.trim(), reason: `${reason} — ${detail.trim()}` }),
            })
          : await apiFetch('/api/feedback', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                category: 'BUG',
                title: `[정보 수정] ${popupName}`,
                content: detail.trim(),
                ...(email.trim() ? { guestEmail: email.trim() } : null),
              }),
            });

      if (res.ok) {
        setDone(true);
        return;
      }
      setError((await res.text().catch(() => '')) || '보내지 못했어요. 잠시 후 다시 시도해 주세요.');
    } catch {
      setError('서버에 연결하지 못했습니다.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal visible transparent animationType="slide" onRequestClose={close}>
      <View style={styles.root}>
        <Pressable style={StyleSheet.absoluteFill} onPress={close} accessibilityLabel="닫기" />

        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={[styles.sheet, { backgroundColor: t.sf }]}>
            <View style={[styles.handle, { backgroundColor: t.ln }]} />

            {done ? (
              <View style={styles.done}>
                <View style={[styles.doneIcon, { backgroundColor: t.l3 }]}>
                  <Icon name="check" size={24} color="#0a0a0a" strokeWidth={3} />
                </View>
                <T size={16} weight={800}>
                  접수했어요
                </T>
                <T size={12.5} color={t.mu} leading={1.6} style={styles.doneBody}>
                  {mode === 'takedown'
                    ? '24시간 안에 검토하고 적어 주신 주소로 결과를 알려드립니다.'
                    : '확인 후 정보를 고치겠습니다. 고맙습니다.'}
                </T>
                <PillButton label="닫기" variant="outline" height={44} fontSize={13} onPress={close} style={styles.doneCta} />
              </View>
            ) : (
              <>
                <T size={17} weight={800} em={-0.01}>
                  {copy.title}
                </T>
                <T size={12.5} color={t.mu} leading={1.6} style={styles.lead}>
                  {copy.lead}
                </T>
                <T size={11.5} weight={700} color={t.mu} dim={0.8} numberOfLines={1} style={styles.target}>
                  {popupName}
                </T>

                {mode === 'takedown' ? (
                  <View style={styles.reasons}>
                    {TAKEDOWN_REASONS.map((r) => (
                      <Pressable
                        key={r}
                        onPress={() => setReason(r)}
                        style={[
                          styles.reason,
                          {
                            borderColor: reason === r ? t.l4 : t.ln,
                            backgroundColor: reason === r ? t.sft : 'transparent',
                          },
                        ]}
                      >
                        <T size={12} weight={700} color={reason === r ? t.l7 : t.mu}>
                          {r}
                        </T>
                      </Pressable>
                    ))}
                  </View>
                ) : null}

                <Field
                  label={copy.label}
                  value={detail}
                  onChangeText={setDetail}
                  placeholder={mode === 'fix' ? '예: 9월 3일에 이미 끝났어요' : '어떤 점이 문제인지 적어 주세요'}
                  multiline
                  height={80}
                />

                <Field
                  label={mode === 'takedown' ? '연락받을 이메일' : '이메일 (선택)'}
                  value={email}
                  onChangeText={setEmail}
                  placeholder="you@example.com"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  height={46}
                  hint={
                    mode === 'takedown'
                      ? '검토 결과를 이 주소로 알려드립니다.'
                      : '적어 주시면 결과를 알려드릴 수 있어요.'
                  }
                />

                {error ? (
                  <T size={12} color="#ee1a64" leading={1.5} style={styles.error}>
                    {error}
                  </T>
                ) : null}

                <View style={styles.actions}>
                  <PillButton label="취소" variant="outline" height={48} fontSize={13.5} onPress={close} style={styles.grow} />
                  <PillButton
                    label={busy ? '보내는 중…' : copy.cta}
                    height={48}
                    fontSize={13.5}
                    disabled={!ready}
                    onPress={submit}
                    style={styles.grow}
                  />
                </View>
              </>
            )}
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(10,10,10,.5)' },
  grow: { flex: 1 },
  sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 20, paddingTop: 10, paddingBottom: 32 },
  handle: { width: 38, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  lead: { marginTop: 6 },
  target: { marginTop: 10, marginBottom: 16 },
  reasons: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 16 },
  reason: { minHeight: 34, paddingHorizontal: 12, borderRadius: 999, borderWidth: 1, justifyContent: 'center' },
  error: { marginBottom: 10 },
  actions: { flexDirection: 'row', gap: 8, marginTop: 4 },

  done: { alignItems: 'center', paddingVertical: 12 },
  doneIcon: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  doneBody: { textAlign: 'center', marginTop: 6 },
  doneCta: { alignSelf: 'stretch', marginTop: 18 },
});
