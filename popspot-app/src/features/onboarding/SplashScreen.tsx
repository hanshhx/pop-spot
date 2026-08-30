import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, Pressable, StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { Symbol, SYMBOL_OUTLINE, SYMBOL_OUTLINE_DASH } from '@/components/layout/Symbol';
import { T } from '@/components/ui/Text';
import { useTokens } from '@/theme/ThemeProvider';
import type { RootStackParamList } from '@/types/navigation';

/**
 * 스플래시 — 시안의 2.2초 연출.
 *
 * <p>"로딩" 이 아니라 <b>반가운 2.2초</b>다. 실제로는 이 시간에 목록과 계절 테마를 받아 둔다.
 * 시안 노트의 순서를 그대로 옮겼다 — 바스켓 선이 그려지고(0→0.95s), 핑크 점이 떨어지며 파동(0.5s),
 * POPSPOT 일곱 글자가 스프링으로 튀고(0.86s~), 라임 원이 확장되며 홈으로 넘어간다(1.95s).
 *
 * <h3>왜 Reanimated 를 쓰지 않았나</h3>
 *
 * <p>여기 있는 것은 전부 투명도·이동·크기·{@code strokeDashoffset} 이고, RN 기본 {@code Animated}
 * 로 다 된다. 화면 하나를 위해 네이티브 설정이 필요한 의존성을 늘리면, 나중에 Expo SDK 를 올릴 때
 * 막히는 지점이 하나 더 생긴다.
 *
 * <p>다만 <b>{@code strokeDashoffset} 만은 네이티브 드라이버를 못 쓴다</b> — 네이티브 드라이버는
 * transform 과 opacity 만 다룬다. 그 하나만 JS 드라이버로 돌린다(0.95초, 선 네 개라 부담이 없다).
 */

/** 시안의 자동 전환 시각. 마스크가 다 퍼진 뒤 여유를 두고 넘어간다. */
const AUTO_ADVANCE_MS = 2800;

const AnimatedPath = Animated.createAnimatedComponent(Path);

/** 한 글자씩 스프링으로 튀어 오르는 워드마크. 시안의 pvSpringUp 스태거. */
const LETTERS = ['P', 'O', 'P', 'S', 'P', 'O', 'T'];

/** 앞의 POP 은 크림, 뒤의 SPOT 은 라임 — 시안 그대로. */
const LIME_FROM = 3;

/** 스플래시는 어두운 바탕 고정이라 계절 토큰이 아니라 이 크림을 쓴다. */
const CREAM = '#f5f3ee';

export default function SplashScreen() {
  const t = useTokens();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const draw = useRef(new Animated.Value(0)).current;
  const fill = useRef(new Animated.Value(0)).current;
  const ripple = useRef(new Animated.Value(0)).current;
  const tail = useRef(new Animated.Value(0)).current;
  const bar = useRef(new Animated.Value(0)).current;
  const mask = useRef(new Animated.Value(0)).current;
  const letters = useMemo(() => LETTERS.map(() => new Animated.Value(0)), []);

  const goHome = useRef(() => {
    navigation.reset({ index: 0, routes: [{ name: 'Home' }] });
  }).current;

  useEffect(() => {
    const ease = Easing.bezier(0.25, 1, 0.5, 1);
    const spring = Easing.bezier(0.34, 1.56, 0.64, 1);

    const timed = (
      value: Animated.Value,
      duration: number,
      delay = 0,
      easing = ease,
      native = true,
    ) => Animated.timing(value, { toValue: 1, duration, delay, easing, useNativeDriver: native });

    const animation = Animated.parallel([
      // 선 그리기만 JS 드라이버 — strokeDashoffset 은 네이티브 드라이버가 못 다룬다.
      timed(draw, 950, 0, ease, false),
      timed(fill, 1500),
      timed(ripple, 1500, 550),
      ...letters.map((value, i) => timed(value, 500, 860 + i * 60, spring)),
      timed(tail, 500, 1350),
      timed(bar, 1100, 1500, ease, false),
      timed(mask, 750, 1950, Easing.bezier(0.76, 0, 0.24, 1)),
    ]);
    animation.start();

    const timer = setTimeout(goHome, AUTO_ADVANCE_MS);
    return () => {
      animation.stop();
      clearTimeout(timer);
    };
  }, [draw, fill, ripple, letters, tail, bar, mask, goHome]);

  return (
    <View style={styles.root}>
      {/* 뒷배경 글로우. 계절이 바뀌면 이 빛이 그 계절 색으로 간다. */}
      <View style={[styles.glow, { backgroundColor: t.hi }]} />

      {/* 파동 — 점이 떨어진 자리에서 퍼진다. */}
      <Animated.View
        style={[
          styles.ripple,
          {
            borderColor: t.l3,
            opacity: ripple.interpolate({ inputRange: [0, 1], outputRange: [0.55, 0] }),
            transform: [
              { scale: ripple.interpolate({ inputRange: [0, 1], outputRange: [0.3, 3.4] }) },
            ],
          },
        ]}
      />

      <View style={styles.mark}>
        <Animated.View style={{ opacity: fill }}>
          <Symbol height={124} />
        </Animated.View>

        {/* 채움 위에 겹쳐 그리는 윤곽선. 좌표계가 같아야 겹치므로 같은 뷰박스를 쓴다. */}
        <Animated.View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFillObject,
            { opacity: draw.interpolate({ inputRange: [0, 0.9, 1], outputRange: [1, 1, 0] }) },
          ]}
        >
          <Svg width="100%" height="100%" viewBox="0 0 31.23 37.25">
            {SYMBOL_OUTLINE.map((d, i) => (
              <AnimatedPath
                key={i}
                d={d}
                fill="none"
                stroke={t.l3}
                strokeWidth={1.1}
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeDasharray={SYMBOL_OUTLINE_DASH}
                strokeDashoffset={draw.interpolate({
                  inputRange: [0, 1],
                  outputRange: [SYMBOL_OUTLINE_DASH, 0],
                })}
              />
            ))}
          </Svg>
        </Animated.View>
      </View>

      <View style={styles.word}>
        {LETTERS.map((letter, i) => (
          <Animated.View
            key={i}
            style={{
              opacity: letters[i],
              transform: [
                {
                  translateY: letters[i].interpolate({
                    inputRange: [0, 1],
                    outputRange: [16, 0],
                  }),
                },
                { scale: letters[i].interpolate({ inputRange: [0, 1], outputRange: [0.7, 1] }) },
              ],
            }}
          >
            <T size={32} weight={800} em={-0.02} color={i >= LIME_FROM ? t.l3 : CREAM}>
              {letter}
            </T>
          </Animated.View>
        ))}
      </View>

      <Animated.View style={[styles.tail, { opacity: tail }]}>
        <T size={13} weight={600} color="rgba(245,243,238,.5)">
          서울에서 지금 열려 있는 팝업
        </T>
      </Animated.View>

      <View style={styles.bottom}>
        <View style={styles.barTrack}>
          <Animated.View
            style={[
              styles.barFill,
              {
                backgroundColor: t.l3,
                width: bar.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
              },
            ]}
          />
        </View>
        <T size={10} weight={600} em={0.12} color="rgba(245,243,238,.3)" numeric>
          SEOUL POP-UP MAP
        </T>
      </View>

      {/* 라임 원이 화면을 덮으며 홈으로 넘어간다. */}
      <Animated.View
        pointerEvents="none"
        style={[
          styles.mask,
          {
            backgroundColor: t.l3,
            opacity: mask.interpolate({ inputRange: [0, 0.01, 1], outputRange: [0, 1, 1] }),
            transform: [{ scale: mask.interpolate({ inputRange: [0, 1], outputRange: [0, 26] }) }],
          },
        ]}
      />

      {/* 시안대로 아무 데나 누르면 바로 넘어간다 — 두 번째 실행부터는 연출이 기다림이 된다. */}
      <Pressable style={StyleSheet.absoluteFill} onPress={goHome} accessibilityLabel="건너뛰기" />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0a0a0a', alignItems: 'center', justifyContent: 'center' },
  glow: {
    position: 'absolute',
    top: '44%',
    width: 420,
    height: 420,
    borderRadius: 210,
    marginTop: -210,
    opacity: 0.16,
  },
  ripple: { position: 'absolute', width: 120, height: 120, borderRadius: 60, borderWidth: 2 },
  mark: { width: 104, height: 124, marginBottom: 26 },
  word: { flexDirection: 'row', gap: 1 },
  tail: { marginTop: 12 },
  bottom: { position: 'absolute', bottom: 70, alignItems: 'center', gap: 12 },
  barTrack: {
    width: 120,
    height: 3,
    borderRadius: 2,
    backgroundColor: 'rgba(245,243,238,.14)',
    overflow: 'hidden',
  },
  barFill: { height: '100%', borderRadius: 2 },
  mask: { position: 'absolute', width: 60, height: 60, borderRadius: 30 },
});
