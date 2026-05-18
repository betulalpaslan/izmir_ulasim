import { useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { SafeAreaProvider } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import OnboardingScreen from "./Screens/OnBoardingScreen";
import HomeScreen from "./Screens/HomeScreen";
import FavoritesScreen from "./Screens/FavoritesScreen";
import SettingsScreen from "./Screens/SettingsScreen";
import AppIcon from "./Components/AppIcon";
import ErrorBoundary from "./Components/ErrorBoundary";
import { ThemeProvider, useTheme } from "./utils/ThemeContext";

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

const TAB_ICONS = { Harita: "map", Favoriler: "star", Ayarlar: "settings" };

function TabIcon({ name, color }) {
  return <AppIcon name={TAB_ICONS[name]} size={22} color={color} />;
}

function MainTabs() {
  const { theme } = useTheme();

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarIcon: ({ color }) => <TabIcon name={route.name} color={color} />,
        tabBarStyle: {
          backgroundColor: theme.surface,
          borderTopColor: theme.border,
          borderTopWidth: 1,
          height: 68,
          paddingBottom: 10,
          paddingTop: 6,
        },
        tabBarActiveTintColor: theme.active,
        tabBarInactiveTintColor: theme.muted,
        tabBarLabelStyle: { fontSize: 11, fontWeight: "700" },
      })}
    >
      <Tab.Screen name="Harita"    component={HomeScreen} />
      <Tab.Screen name="Favoriler" component={FavoritesScreen} />
      <Tab.Screen name="Ayarlar"   component={SettingsScreen} />
    </Tab.Navigator>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <SafeAreaProvider>
        <ThemeProvider>
          <AppShell />
        </ThemeProvider>
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}

function AppShell() {
  const { theme } = useTheme();
  const [ready, setReady] = useState(false);
  const [onboarded, setOnboarded] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem("userPrefs");
        if (raw && JSON.parse(raw).onboardingDone) setOnboarded(true);
      } catch {}
      setReady(true);
    })();
  }, []);

  if (!ready) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.bg, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator color={theme.active} size="large" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator
        screenOptions={{ headerShown: false }}
        initialRouteName={onboarded ? "Main" : "Onboarding"}
      >
        <Stack.Screen name="Onboarding" component={OnboardingScreen} />
        <Stack.Screen name="Main"       component={MainTabs} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
