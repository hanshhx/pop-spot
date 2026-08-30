import { Pressable, StyleSheet, View } from 'react-native';

import { useTokens } from '@/theme/ThemeProvider';

/**
 * 켜기·끄기 스위치 — 시안의 40x23 트랙 + 18px 손잡이.
 *
 * <p>RN 의 {@code <Switch>} 를 쓰지 않는다. 플랫폼마다 크기와 모양이 다르고 안드로이드에서는
 * Material 스위치가 나와서, 시안의 알림 설정·플래너 옵션 줄이 통째로 다른 디자인이 된다.
 */
export function Toggle({ on, onChange }: { on: boolean; onChange: () => void }) {
  const t = useTokens();
  return (
    <Pressable
      onPress={onChange}
      accessibilityRole="switch"
      accessibilityState={{ checked: on }}
      hitSlop={8}
      style={[styles.track, { backgroundColor: on ? t.l4 : 'rgba(10,10,10,.16)' }]}
    >
      <View style={[styles.knob, { left: on ? 19 : 2.5 }]} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  track: { width: 40, height: 23, borderRadius: 999 },
  knob: {
    position: 'absolute',
    top: 2.5,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#fff',
    /* 시안의 box-shadow:0 1px 3px rgba(10,10,10,.25) — 흰 손잡이가 라임 트랙 위에서 뜨게 한다. */
    shadowColor: '#0a0a0a',
    shadowOpacity: 0.25,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
});
