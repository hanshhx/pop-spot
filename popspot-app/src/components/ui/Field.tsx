import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View, type TextInputProps } from 'react-native';

import { useTokens } from '@/theme/ThemeProvider';
import { font } from '@/theme/typography';
import { Icon, type IconName } from './Icon';
import { T } from './Text';

/**
 * 입력 한 칸 — 시안의 로그인·가입·계정찾기가 전부 이 모양이다.
 *
 * <p>라벨과 입력칸과 아래 상태 문구를 <b>한 컴포넌트로</b> 묶었다. 시안에서 이 셋은 늘 붙어
 * 다니는데, 따로 두면 화면마다 간격이 조금씩 달라진다 — 회원가입 화면 하나에만 이 묶음이 다섯 번
 * 나온다.
 */

export interface FieldProps extends Omit<TextInputProps, 'style'> {
  label?: string;
  icon?: IconName;
  /** 아래에 붙는 안내. 조건 설명이나 검증 결과. */
  hint?: string;
  /** 안내를 라임으로 — 시안의 "이메일 인증 완료" 처럼 통과했을 때. */
  ok?: boolean;
  /** 안내를 빨강으로. */
  error?: boolean;
  /** 비밀번호 칸. 보임/숨김 버튼이 붙는다. */
  secure?: boolean;
  /** 시안이 48(로그인)과 46(가입)을 골라 쓴다. */
  height?: number;
  /** 오른쪽에 붙는 버튼 — 가입 화면의 "인증하기". */
  action?: { label: string; onPress: () => void; primary?: boolean };
}

export function Field({
  label,
  icon,
  hint,
  ok = false,
  error = false,
  secure = false,
  height = 48,
  action,
  ...input
}: FieldProps) {
  const t = useTokens();
  const [shown, setShown] = useState(false);

  const hintColor = error ? '#ee1a64' : ok ? t.l7 : t.mu;

  return (
    <View style={styles.wrap}>
      {label ? (
        <T size={12} weight={700} style={styles.label}>
          {label}
        </T>
      ) : null}

      <View style={styles.row}>
        <View
          style={[
            styles.box,
            {
              minHeight: height,
              backgroundColor: t.sf,
              borderColor: error ? '#ee1a64' : t.ln,
              alignItems: input.multiline ? 'flex-start' : 'center',
            },
          ]}
        >
          {icon ? <Icon name={icon} size={16} color={t.mu} /> : null}
          <TextInput
            {...input}
            secureTextEntry={secure && !shown}
            placeholderTextColor={t.mu}
            /* 안드로이드는 여러 줄 입력의 첫 글자를 칸 가운데에 놓는다. 위로 붙인다. */
            textAlignVertical={input.multiline ? 'top' : 'center'}
            style={[
              styles.input,
              font(400),
              { color: t.ik },
              input.multiline ? { paddingVertical: 12 } : null,
            ]}
          />
          {secure ? (
            <Pressable
              onPress={() => setShown((s) => !s)}
              accessibilityLabel={shown ? '비밀번호 숨기기' : '비밀번호 보기'}
              hitSlop={8}
            >
              <Icon name={shown ? 'eyeOff' : 'eye'} size={17} color={shown ? t.l7 : t.mu} />
            </Pressable>
          ) : null}
        </View>

        {action ? (
          <Pressable
            onPress={action.onPress}
            style={[
              styles.action,
              {
                minHeight: height,
                backgroundColor: action.primary ? t.l3 : t.sft,
                borderColor: action.primary ? t.l3 : t.l3,
              },
            ]}
          >
            <T size={12.5} weight={action.primary ? 800 : 700} color={action.primary ? t.hif : t.l7}>
              {action.label}
            </T>
          </Pressable>
        ) : null}
      </View>

      {hint ? (
        <View style={styles.hintRow}>
          {ok ? <Icon name="check" size={13} color={t.l7} strokeWidth={3} /> : null}
          <T size={11.5} weight={ok ? 700 : 400} color={hintColor} dim={ok || error ? 1 : 0.8} leading={1.4}>
            {hint}
          </T>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 14 },
  label: { marginBottom: 7 },
  row: { flexDirection: 'row', gap: 7 },
  box: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  input: { flex: 1, fontSize: 13.5, padding: 0 },
  action: {
    paddingHorizontal: 15,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hintRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 6 },
});
