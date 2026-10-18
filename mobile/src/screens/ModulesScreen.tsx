import React, { useMemo, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useNavigation } from "@react-navigation/native";
import { useAuth } from "../auth/AuthProvider";
import { MODULES, MobileModule, canOpenModule } from "../modules/catalog";
import { RootStackParamList } from "../navigation/RootNavigator";
import { colors, radius, spacing } from "../ui/theme";

export function ModulesScreen() {
  const { user } = useAuth();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [search, setSearch] = useState("");
  const visible = useMemo(() => {
    if (!user) return [];
    const normalized = search.trim().toLowerCase();
    return MODULES.filter((item) => canOpenModule(item, user)).filter((item) =>
      !normalized || item.title.toLowerCase().includes(normalized) ||
      item.category.toLowerCase().includes(normalized) || item.description.toLowerCase().includes(normalized)
    );
  }, [user, search]);

  const renderModule = ({ item }: { item: MobileModule }) => (
    <Pressable accessibilityRole="button" accessibilityLabel={"Open " + item.title}
      onPress={() => item.id === "assignments" ? navigation.navigate("Assignments") : item.id === "notices" ? navigation.navigate("Notices") : item.id === "timetable" ? navigation.navigate("Timetable") : item.id === "library" ? navigation.navigate("Library") : item.id === "calendar" ? navigation.navigate("Calendar") : item.id === "attendance" ? navigation.navigate("Attendance") : item.id === "leave" ? navigation.navigate("Leave") : item.id === "parent-children" ? navigation.navigate("Parent") : item.id === "hr" ? navigation.navigate("HR") : item.id === "admissions" ? navigation.navigate("Admissions") : item.id === "placements" ? navigation.navigate("Placement") : item.id === "student-dashboard" ? navigation.navigate("StudentPortal", { initialTab: "OVERVIEW" }) : item.id === "student-attendance" ? navigation.navigate("StudentPortal", { initialTab: "ATTENDANCE" }) : item.id === "student-marks" ? navigation.navigate("StudentPortal", { initialTab: "MARKS" }) : item.id === "student-results" ? navigation.navigate("StudentPortal", { initialTab: "RESULTS" }) : item.id === "student-assignments" ? navigation.navigate("StudentPortal", { initialTab: "ASSIGNMENTS" }) : item.id === "student-timetable" ? navigation.navigate("StudentPortal", { initialTab: "TIMETABLE" }) : navigation.navigate("Module", { moduleId: item.id })}
      style={({ pressed }) => [styles.card, pressed ? styles.pressed : null]}>
      <View style={styles.cardHeader}><Text style={styles.title}>{item.title}</Text><Text style={styles.arrow}>›</Text></View>
      <Text style={styles.category}>{item.category}</Text>
      <Text style={styles.description}>{item.description}</Text>
    </Pressable>
  );

  return <View style={styles.root}>
    <Text style={styles.intro}>Visible modules are filtered using the permissions returned by your session. The API still evaluates every request.</Text>
    <TextInput value={search} onChangeText={setSearch} placeholder="Find a module" placeholderTextColor={colors.textMuted}
      style={styles.search} accessibilityLabel="Find a module" returnKeyType="search" />
    <FlatList data={visible} keyExtractor={(item) => item.id} renderItem={renderModule}
      contentContainerStyle={styles.list} initialNumToRender={12} windowSize={7} keyboardShouldPersistTaps="handled"
      ListEmptyComponent={<View style={styles.empty}><Text style={styles.emptyTitle}>No matching modules</Text><Text style={styles.emptyText}>No module matches this search and the current permission payload.</Text></View>} />
  </View>;
}
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.canvas, paddingTop: spacing.md },
  intro: { marginHorizontal: spacing.lg, marginBottom: spacing.md, color: colors.textMuted, fontSize: 12, lineHeight: 18 },
  search: { marginHorizontal: spacing.lg, backgroundColor: colors.surface, color: colors.text, borderColor: colors.border, borderWidth: 1, borderRadius: radius.md, paddingHorizontal: 14, paddingVertical: 12, marginBottom: spacing.md },
  list: { paddingHorizontal: spacing.lg, paddingBottom: 24 },
  card: { backgroundColor: colors.surface, borderRadius: radius.md, borderColor: colors.border, borderWidth: 1, padding: spacing.lg, marginBottom: 10 },
  pressed: { opacity: 0.75 },
  cardHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  title: { flex: 1, fontSize: 16, fontWeight: "800", color: colors.text }, arrow: { fontSize: 24, lineHeight: 26, color: colors.primary },
  category: { color: colors.primary, fontSize: 10, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.7, marginTop: 6 },
  description: { color: colors.textMuted, fontSize: 13, lineHeight: 19, marginTop: 7 },
  empty: { alignItems: "center", padding: 26, backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border },
  emptyTitle: { fontSize: 16, fontWeight: "800", color: colors.text }, emptyText: { textAlign: "center", color: colors.textMuted, marginTop: 7, lineHeight: 19 }
});
