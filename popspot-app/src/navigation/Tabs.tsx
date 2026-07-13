import { Ionicons } from "@expo/vector-icons";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { BlurView } from "expo-blur";
import { StyleSheet, View } from "react-native";

import HomeScreen from "../screens/HomeScreen";
import StubScreen from "../screens/StubScreen";
import { colors } from "../theme";
import { TabParamList } from "../types";

const Tab = createBottomTabNavigator<TabParamList>();

const CourseScreen = () => (
  <StubScreen title="코스" subtitle="AI가 짜주는 팝업 데이트 동선" icon="navigate-outline" />
);
const MusicScreen = () => (
  <StubScreen title="음악" subtitle="무드로 고르는 팝업 + 배경음악" icon="musical-notes-outline" />
);
const PassportScreen = () => (
  <StubScreen title="여권" subtitle="방문 도장 모으기" icon="ticket-outline" />
);
const MyScreen = () => (
  <StubScreen title="MY" subtitle="위시·알림·내 정보" icon="person-outline" />
);

const ICON: Record<keyof TabParamList, keyof typeof Ionicons.glyphMap> = {
  Map: "map",
  Course: "navigate",
  Music: "musical-notes",
  Passport: "ticket",
  My: "person",
};
const LABEL: Record<keyof TabParamList, string> = {
  Map: "지도",
  Course: "코스",
  Music: "음악",
  Passport: "여권",
  My: "MY",
};

export default function Tabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.ink,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: styles.bar,
        tabBarLabel: LABEL[route.name],
        tabBarLabelStyle: styles.label,
        tabBarBackground: () => (
          <BlurView intensity={55} tint="light" style={StyleSheet.absoluteFill}>
            <View style={[StyleSheet.absoluteFill, styles.barTint]} />
          </BlurView>
        ),
        tabBarIcon: ({ focused }) => (
          <View style={[styles.iconWrap, focused && styles.iconActive]}>
            <Ionicons
              name={ICON[route.name]}
              size={21}
              color={focused ? colors.ink : colors.muted}
            />
          </View>
        ),
      })}
    >
      <Tab.Screen name="Map" component={HomeScreen} />
      <Tab.Screen name="Course" component={CourseScreen} />
      <Tab.Screen name="Music" component={MusicScreen} />
      <Tab.Screen name="Passport" component={PassportScreen} />
      <Tab.Screen name="My" component={MyScreen} />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: "absolute",
    borderTopWidth: 0,
    elevation: 0,
    backgroundColor: "transparent",
    height: 76,
    paddingTop: 8,
  },
  barTint: {
    backgroundColor: colors.glassStrong,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.glassBorder,
  },
  label: { fontSize: 11, fontWeight: "700", marginTop: 2 },
  iconWrap: {
    width: 46,
    height: 30,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  iconActive: { backgroundColor: colors.lime },
});
