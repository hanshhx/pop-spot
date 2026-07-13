import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";

import DetailScreen from "./src/screens/DetailScreen";
import ListScreen from "./src/screens/ListScreen";
import { colors } from "./src/theme";
import { RootStackParamList } from "./src/types";

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function App() {
  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <NavigationContainer>
        <Stack.Navigator
          screenOptions={{
            headerStyle: { backgroundColor: colors.cream },
            headerTintColor: colors.ink,
            headerTitleStyle: { fontWeight: "800" },
            headerShadowVisible: false,
            contentStyle: { backgroundColor: colors.cream },
          }}
        >
          <Stack.Screen
            name="List"
            component={ListScreen}
            options={{ title: "팝스팟 · 서울 팝업" }}
          />
          <Stack.Screen name="Detail" component={DetailScreen} options={{ title: "팝업 상세" }} />
        </Stack.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
