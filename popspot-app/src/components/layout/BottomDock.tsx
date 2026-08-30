import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Pressable, StyleSheet, View } from 'react-native';

import { useTokens } from '@/theme/ThemeProvider';
import type { DockTab, RootStackParamList } from '@/types/navigation';
import { Icon, type IconName } from '../ui/Icon';
import { T } from '../ui/Text';

/**
 * 하단 독 — 웹 {@code BottomDock} 의 핵심 4탭 + 더보기를 그대로.
 *
 * <p>시안은 화면 아래에 <b>떠 있는</b> 알약이다(좌우 8px, 아래 30px). 화면 바닥에 붙는 탭바가
 * 아니라서, 이 아래로 지도가 계속 보인다 — 지도가 주 화면인 앱이라 그 여백이 정보다.
 */

const TABS: { key: DockTab; label: string; icon: IconName; to: keyof RootStackParamList }[] = [
  { key: 'map', label: '지도', icon: 'pin', to: 'Home' },
  { key: 'course', label: '코스', icon: 'course', to: 'Course' },
  { key: 'plan', label: '일정', icon: 'calendar', to: 'Planner' },
  { key: 'my', label: '마이', icon: 'user', to: 'My' },
  { key: 'more', label: '더보기', icon: 'more', to: 'Music' },
];

export function BottomDock({ active }: { active: DockTab }) {
  const t = useTokens();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  return (
    <View style={styles.wrap} pointerEvents="box-none">
      <View style={[styles.bar, { backgroundColor: t.sf, borderColor: t.ln }]}>
        {TABS.map((tab) => {
          const on = tab.key === active;
          const fg = on ? t.hif : t.mu;
          return (
            <Pressable
              key={tab.key}
              onPress={() => navigation.navigate(tab.to as never)}
              accessibilityRole="tab"
              accessibilityState={{ selected: on }}
              style={styles.tab}
            >
              {on ? <View style={[styles.tabFill, { backgroundColor: t.l3 }]} /> : null}
              <Icon name={tab.icon} size={20} color={fg} strokeWidth={tab.key === 'more' ? 2.6 : 2} />
              <T size={10} weight={700} em={-0.01} color={fg}>
                {tab.label}
              </T>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

/** 독에 가리지 않도록 스크롤 콘텐츠가 남겨야 하는 아래 여백. 시안의 76~84px. */
export const DOCK_INSET = 100;

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 8, right: 8, bottom: 30, zIndex: 40 },
  bar: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 2,
    padding: 6,
    borderRadius: 24,
    borderWidth: 1,
    /* 시안: box-shadow:0 16px 40px rgba(10,10,10,.14) */
    shadowColor: '#0a0a0a',
    shadowOpacity: 0.14,
    shadowRadius: 40,
    shadowOffset: { width: 0, height: 16 },
    elevation: 12,
  },
  tab: {
    flex: 1,
    minWidth: 0,
    height: 56,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    overflow: 'hidden',
  },
  tabFill: { ...StyleSheet.absoluteFillObject, borderRadius: 18 },
});
