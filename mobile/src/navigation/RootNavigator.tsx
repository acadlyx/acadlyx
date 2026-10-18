import React from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { NavigationContainer, DefaultTheme } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator, NativeStackScreenProps } from "@react-navigation/native-stack";
import { StatusBar } from "expo-status-bar";
import { useAuth } from "../auth/AuthProvider";
import { LoginScreen } from "../screens/LoginScreen";
import { HomeScreen } from "../screens/HomeScreen";
import { RoleDashboardScreen } from "../screens/RoleDashboardScreen";
import { ModulesScreen } from "../screens/ModulesScreen";
import { GlobalSearchScreen } from "../screens/GlobalSearchScreen";
import { NotificationsScreen } from "../screens/NotificationsScreen";
import { ProfileScreen } from "../screens/ProfileScreen";
import { AssignmentsScreen } from "../screens/AssignmentsScreen";
import { NoticesScreen } from "../screens/NoticesScreen";
import { TimetableScreen } from "../screens/TimetableScreen";
import { LibraryScreen } from "../screens/LibraryScreen";
import { CalendarScreen } from "../screens/CalendarScreen";
import { AttendanceScreen } from "../screens/AttendanceScreen";
import { LeaveScreen } from "../screens/LeaveScreen";
import { ParentScreen } from "../screens/ParentScreen";
import { HRScreen } from "../screens/HRScreen";
import { AdmissionsScreen } from "../screens/AdmissionsScreen";
import { PlacementScreen } from "../screens/PlacementScreen";
import { LmsScreen } from "../screens/LmsScreen";
import { StudentPortalScreen } from "../screens/StudentPortalScreen";
import { ModuleScreen } from "../screens/ModuleScreen";
import { getModule } from "../modules/catalog";
import { colors } from "../ui/theme";
import { WorkspaceContextScreen } from "../screens/WorkspaceContextScreen";

export type RootStackParamList = { Login: undefined; Main: undefined; WorkspaceContext: undefined; Module: { moduleId: string }; Assignments: undefined; Notices: undefined; Timetable: undefined; Library: undefined; Calendar: undefined; Attendance: undefined; Leave: undefined; Parent: undefined; HR: undefined; Admissions: undefined; Placement: undefined; Lms: undefined; StudentPortal: { initialTab?: "OVERVIEW"|"ATTENDANCE"|"MARKS"|"RESULTS"|"ASSIGNMENTS"|"TIMETABLE" } };
export type TabParamList = { Home: undefined; Modules: undefined; Search: undefined; Notifications: undefined; Profile: undefined };
const Stack = createNativeStackNavigator<RootStackParamList>();
const Tabs = createBottomTabNavigator<TabParamList>();

function HomeTab() {
  const { user } = useAuth();
  // The dashboard resolves the same effective-role priority as the backend;
  // this also prevents a multi-role account from falling into a secondary
  // Student workspace merely because it carries the STUDENT role.
  return user ? <RoleDashboardScreen /> : <HomeScreen />;
}

function MainTabs() {
  return (
    <Tabs.Navigator backBehavior="history" screenOptions={{
      headerStyle: { backgroundColor: colors.surface },
      headerTintColor: colors.text,
      headerTitleStyle: { fontWeight: "800" },
      tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border, height: 62, paddingTop: 5, paddingBottom: 7 },
      tabBarActiveTintColor: colors.primary,
      tabBarInactiveTintColor: colors.textMuted
    }}>
      <Tabs.Screen name="Home" component={HomeTab} options={{ title: "ACADLYX", tabBarLabel: "Home", tabBarIcon: () => <Text>⌂</Text> }} />
      <Tabs.Screen name="Modules" component={ModulesScreen} options={{ title: "Modules", tabBarIcon: () => <Text>▦</Text> }} />
      <Tabs.Screen name="Search" component={GlobalSearchScreen} options={{ title: "Search", tabBarIcon: () => <Text>⌕</Text> }} />
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
          <Stack.Screen name="WorkspaceContext" component={WorkspaceContextScreen} options={{ title: "Workspace & context" }} />
          <Stack.Screen name="Module" component={ModuleScreen} options={({ route }) => ({ title: getModule(route.params.moduleId)?.title || "Module" })} />
          <Stack.Screen name="Assignments" component={AssignmentsScreen} options={{ title: "Assignments" }} />
          <Stack.Screen name="Notices" component={NoticesScreen} options={{ title: "Notices" }} />
          <Stack.Screen name="Timetable" component={TimetableScreen} options={{ title: "Timetable" }} />
          <Stack.Screen name="Library" component={LibraryScreen} options={{ title: "Library" }} />
          <Stack.Screen name="Calendar" component={CalendarScreen} options={{ title: "Calendar" }} />
          <Stack.Screen name="Attendance" component={AttendanceScreen} options={{ title: "Attendance" }} />
          <Stack.Screen name="Leave" component={LeaveScreen} options={{ title: "Leave management" }} />
          <Stack.Screen name="Parent" component={ParentScreen} options={{ title: "Parent portal" }} />
          <Stack.Screen name="HR" component={HRScreen} options={{ title: "Human resources" }} />
          <Stack.Screen name="Admissions" component={AdmissionsScreen} options={{ title: "Admissions" }} />
          <Stack.Screen name="Placement" component={PlacementScreen} options={{ title: "Placement" }} />
          <Stack.Screen name="Lms" component={LmsScreen} options={{ title: "Learning management" }} />
          <Stack.Screen name="StudentPortal" component={({ route }: NativeStackScreenProps<RootStackParamList, "StudentPortal">) => <StudentPortalScreen initialTab={route.params?.initialTab} />} options={{ title: "Student portal" }} />
        </> : <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
