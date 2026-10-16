import React from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { NavigationContainer, DefaultTheme } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { StatusBar } from "expo-status-bar";
import { useAuth } from "../auth/AuthProvider";
import { LoginScreen } from "../screens/LoginScreen";
import { HomeScreen } from "../screens/HomeScreen";
import { ModulesScreen } from "../screens/ModulesScreen";
import { NotificationsScreen } from "../screens/NotificationsScreen";
import { ProfileScreen } from "../screens/ProfileScreen";
import { AssignmentsScreen } from "../screens/AssignmentsScreen";
import { NoticesScreen } from "../screens/NoticesScreen";
import { TimetableScreen } from "../screens/TimetableScreen";
import { ModuleScreen } from "../screens/ModuleScreen";
import { getModule } from "../modules/catalog";
import { colors } from "../ui/theme";

export type RootStackParamList = { Login: undefined; Main: undefined; Module: { moduleId: string }; Assignments: undefined; Notices: undefined; Timetable: undefined };
export type TabParamList = { Home: undefined; Modules: undefined; Notifications: undefined; Profile: undefined };
const Stack = createNativeStackNavigator<RootStackParamList>();
const Tabs = createBottomTabNavigator<TabParamList>();

function MainTabs() {
  return (
    <Tabs.Navigator screenOptions={{
      headerStyle: { backgroundColor: colors.surface },
      headerTintColor: colors.text,
      headerTitleStyle: { fontWeight: "800" },
      tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border, height: 62, paddingTop: 5, paddingBottom: 7 },
      tabBarActiveTintColor: colors.primary,
      tabBarInactiveTintColor: colors.textMuted
    }}>
      <Tabs.Screen name="Home" component={HomeScreen} options={{ title: "ACADLYX", tabBarLabel: "Home", tabBarIcon: () => <Text>⌂</Text> }} />
      <Tabs.Screen name="Modules" component={ModulesScreen} options={{ title: "Modules", tabBarIcon: () => <Text>▦</Text> }} />
      <Tabs.Screen name="Notifications" component={NotificationsScreen} options={{ title: "Notifications", tabBarIcon: () => <Text>♢</Text> }} />
      <Tabs.Screen name="Profile" component={ProfileScreen} options={{ title: "My Account", tabBarIcon: () => <Text>◉</Text> }} />
    </Tabs.Navigator>
  );
}

const navigationTheme = {
  ...DefaultTheme,
  colors: { ...DefaultTheme.colors, primary: colors.primary, background: colors.canvas, card: colors.surface, text: colors.text, border: colors.border }
};

export function RootNavigator() {
  const { status } = useAuth();
  if (status === "restoring") return (
    <View style={{ flex: 1, backgroundColor: colors.canvas, alignItems: "center", justifyContent: "center" }}>
      <StatusBar style="dark" />
      <ActivityIndicator size="large" color={colors.primary} />
      <Text style={{ marginTop: 12, color: colors.textMuted }}>Connecting securely to ACADLYX…</Text>
    </View>
  );

  return (
    <NavigationContainer theme={navigationTheme}>
      <StatusBar style="dark" />
      <Stack.Navigator screenOptions={{
        headerStyle: { backgroundColor: colors.surface }, headerTintColor: colors.text,
        headerTitleStyle: { fontWeight: "800" }, contentStyle: { backgroundColor: colors.canvas },
        headerBackTitle: "Back"
      }}>
        {status === "authenticated" ? <>
          <Stack.Screen name="Main" component={MainTabs} options={{ headerShown: false }} />
          <Stack.Screen name="Module" component={ModuleScreen} options={({ route }) => ({ title: getModule(route.params.moduleId)?.title || "Module" })} />
          <Stack.Screen name="Assignments" component={AssignmentsScreen} options={{ title: "Assignments" }} />
          <Stack.Screen name="Notices" component={NoticesScreen} options={{ title: "Notices" }} />
          <Stack.Screen name="Timetable" component={TimetableScreen} options={{ title: "Timetable" }} />
        </> : <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />}
      </Stack.Navigator>
    </NavigationContainer>
  );
}