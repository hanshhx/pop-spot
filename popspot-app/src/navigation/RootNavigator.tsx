import { createNativeStackNavigator } from '@react-navigation/native-stack';

import FindAccountScreen from '@/features/auth/FindAccountScreen';
import LoginScreen from '@/features/auth/LoginScreen';
import SignupScreen from '@/features/auth/SignupScreen';
import TotpScreen from '@/features/auth/TotpScreen';
import CourseScreen from '@/features/course/CourseScreen';
import GuideScreen from '@/features/guide/GuideScreen';
import MusicScreen from '@/features/music/MusicScreen';
import PassportScreen from '@/features/passport/PassportScreen';
import MyScreen from '@/features/profile/MyScreen';
import HomeScreen from '@/features/map/HomeScreen';
import PlannerScreen from '@/features/planning/PlannerScreen';
import ScheduleScreen from '@/features/schedule/ScheduleScreen';
import DetailScreen from '@/features/popup/DetailScreen';
import SearchScreen from '@/features/popup/SearchScreen';
import PopAllScreen from '@/features/popup/PopAllScreen';
import NotificationCenterScreen from '@/features/notifications/NotificationCenterScreen';
import PushPreviewScreen from '@/features/notifications/PushPreviewScreen';
import OnboardingScreen from '@/features/onboarding/OnboardingScreen';
import SplashScreen from '@/features/onboarding/SplashScreen';
import type { RootStackParamList } from '@/types/navigation';

/**
 * 화면 하나짜리 스택 — 시안의 17개 화면이 전부 여기 등록된다.
 *
 * <p>탭 내비게이터를 쓰지 않는 이유는 {@code types/navigation.ts} 에 적어 두었다. 요약하면 시안의
 * 하단 독이 탭바가 아니기 때문이다.
 *
 * <p>헤더는 전부 끈다. 시안의 화면들이 각자 자기 상단을 그리고(뒤로가기 화살표 + 제목), 상세는
 * 사진이 상태바까지 올라간다 — 내비게이션 헤더가 있으면 그 위에 한 줄이 더 생긴다.
 */
const Stack = createNativeStackNavigator<RootStackParamList>();

export function RootNavigator() {
  return (
    <Stack.Navigator initialRouteName="Splash" screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Splash" component={SplashScreen} />
      <Stack.Screen name="Home" component={HomeScreen} />
      <Stack.Screen name="Onboarding" component={OnboardingScreen} />
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="Signup" component={SignupScreen} />
      <Stack.Screen name="FindAccount" component={FindAccountScreen} />
      <Stack.Screen name="Totp" component={TotpScreen} />
      <Stack.Screen name="PopAll" component={PopAllScreen} />
      <Stack.Screen name="Search" component={SearchScreen} />
      <Stack.Screen name="Detail" component={DetailScreen} />
      <Stack.Screen name="Course" component={CourseScreen} />
      <Stack.Screen name="Schedule" component={ScheduleScreen} />
      <Stack.Screen name="Planner" component={PlannerScreen} />
      <Stack.Screen name="Guide" component={GuideScreen} />
      <Stack.Screen name="Notifications" component={NotificationCenterScreen} />
      <Stack.Screen name="PushPreview" component={PushPreviewScreen} />
      <Stack.Screen name="Music" component={MusicScreen} />
      <Stack.Screen name="Passport" component={PassportScreen} />
      <Stack.Screen name="My" component={MyScreen} />
    </Stack.Navigator>
  );
}
