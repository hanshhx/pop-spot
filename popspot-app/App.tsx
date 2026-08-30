// 굵기별 하위 경로로 가져온다. 패키지 루트에서 가져오면 16종 전부가 번들에 실린다(실측 1.9MB) —
// 쓰는 것은 두 벌뿐이다.
import { JetBrainsMono_400Regular } from '@expo-google-fonts/jetbrains-mono/400Regular';
import { JetBrainsMono_700Bold } from '@expo-google-fonts/jetbrains-mono/700Bold';
import { DefaultTheme, NavigationContainer, type Theme } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import 'react-native-url-polyfill/auto';

import { useSocialLoginListener } from '@/features/auth/useSocialLogin';
import { RootNavigator } from '@/navigation/RootNavigator';
import { ThemeProvider, useTheme } from '@/theme/ThemeProvider';

/**
 * 앱 진입점.
 *
 * <p><b>{@code react-native-url-polyfill} 을 맨 위에서 부른다.</b> 이식한
 * {@code lib/popupCover.ts} 가 사진 주소의 호스트를 보고 스톡 이미지를 가려내는데
 * ({@code new URL(url).hostname}), Hermes 의 기본 {@code URL} 은 {@code hostname} 을 제대로 주지
 * 않는다. 폴리필이 없으면 <b>모든 사진이 조용히 사라진다</b> — 예외가 아니라 빈 값이라서 오류
 * 로그도 남지 않는다.
 */

/** 시안이 쓰는 굵기. app.json 의 expo-font 목록과 이름이 맞아야 한다. */
const WANTED_SANS = {
  'WantedSans-Regular': require('./assets/fonts/WantedSans-Regular.ttf'),
  'WantedSans-SemiBold': require('./assets/fonts/WantedSans-SemiBold.ttf'),
  'WantedSans-Bold': require('./assets/fonts/WantedSans-Bold.ttf'),
  'WantedSans-ExtraBold': require('./assets/fonts/WantedSans-ExtraBold.ttf'),
};

export default function App() {
  const [fontsLoaded] = useFonts({
    ...WANTED_SANS,
    JetBrainsMono_400Regular,
    JetBrainsMono_700Bold,
  });

  /* 폰트가 준비되기 전에 그리면 시스템 폰트로 한 번 그린 뒤 바뀐다 — 글자 폭이 달라 화면이
     통째로 출렁인다. 스플래시가 어차피 검은 화면으로 시작하므로, 그 색으로 잠깐 기다린다. */
  if (!fontsLoaded) return <View style={{ flex: 1, backgroundColor: '#0a0a0a' }} />;

  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <Shell />
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

/**
 * 테마를 읽어 내비게이션과 상태바에 입힌다.
 *
 * <p>{@code ThemeProvider} 안쪽이어야 {@code useTheme} 이 값을 받는다 — 밖에서 부르면 월 기준
 * 폴백으로 떨어져서, 사용자가 고른 계절이 이 두 곳에만 적용되지 않는 미묘한 어긋남이 생긴다.
 */
function Shell() {
  const { t, dark } = useTheme();

  /* 소셜 로그인의 딥링크(popspot://auth?code=…)를 듣는 <b>단 한 곳</b>.
     로그인 화면에 두면 안 된다 — 브라우저에 다녀오는 동안 안드로이드가 메모리가 모자라 앱을
     죽이면, 돌아왔을 때 그 화면은 없고 코드를 받을 사람도 없다. */
  useSocialLoginListener();

  const navTheme: Theme = {
    ...DefaultTheme,
    dark,
    colors: {
      ...DefaultTheme.colors,
      background: t.bg,
      card: t.sf,
      text: t.ik,
      border: t.ln,
      primary: t.l5,
    },
  };

  return (
    <>
      <StatusBar style={dark ? 'light' : 'dark'} />
      <NavigationContainer theme={navTheme}>
        <RootNavigator />
      </NavigationContainer>
    </>
  );
}
