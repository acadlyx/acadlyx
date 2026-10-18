import React from "react";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { apiRequest, ApiError } from "../api/client";
import { useAuth } from "../auth/AuthProvider";
import { colors, radius, spacing } from "../ui/theme";
import { RootStackParamList } from "../navigation/RootNavigator";
import { useWorkspaceContext } from "../workspace/WorkspaceContextProvider";

type WorkItem = { id: string; title: string; count: number; priority: "critical" | "high" | "normal"; detail?: string; href?: string; state?: string };
type WorkSummary = { generatedAt?: string; total?: number; critical?: number; high?: number; items?: WorkItem[]; completed?: number; pending?: number };

export function HomeScreen() {
  const { user } = useAuth();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { context: workspaceContext } = useWorkspaceContext();
  const query = useQuery({
    queryKey: ["my-work", user?.id],
    queryFn: () => apiRequest<WorkSummary>("/my-work"),
    enabled: Boolean(user?.id),
    staleTime: 10000
  });
  const fullName = [user?.firstName, user?.lastName].filter((part) => typeof part === "string" && part.length > 0).join(" ");
  const greeting = fullName || user?.email || "ACADLYX user";
  const activeScopeLabels = workspaceContext ? [
    workspaceContext.scope.campusId ? workspaceContext.children.campuses.find((item) => item.id === workspaceContext.scope.campusId)?.name : null,
    workspaceContext.scope.departmentId ? workspaceContext.children.departments.find((item) => item.id === workspaceContext.scope.departmentId)?.name : null,
    workspaceContext.scope.programId ? workspaceContext.children.programs.find((item) => item.id === workspaceContext.scope.programId)?.name : null,
    workspaceContext.scope.academicYearId ? workspaceContext.children.academicYears.find((item) => item.id === workspaceContext.scope.academicYearId)?.name : null,
    workspaceContext.scope.batchId ? workspaceContext.children.batches.find((item) => item.id === workspaceContext.scope.batchId)?.name : null,
    workspaceContext.scope.semesterId ? workspaceContext.children.semesters.find((item) => item.id === workspaceContext.scope.semesterId)?.name : null,
    workspaceContext.scope.sectionId ? workspaceContext.children.sections.find((item) => item.id === workspaceContext.scope.sectionId)?.name : null
  ].filter((label): label is string => Boolean(label)).join(" / ") : "Loading authorized scope";
  const activeScopeLabel = activeScopeLabels || workspaceContext?.institution?.name || "Institution-wide";

  return <ScrollView style={styles.root} contentContainerStyle={styles.content}
    refreshControl={<RefreshControl refreshing={query.isRefetching} onRefresh={() => { void query.refetch(); }} tintColor={colors.primary} />}>
    <View style={styles.hero}>
      <Text style={styles.eyebrow}>YOUR INSTITUTIONAL WORKSPACE</Text>
      <Text style={styles.title}>Welcome, {greeting}</Text>
      <Text style={styles.subtitle}>Work and access are determined by your current ACADLYX session.</Text>
      <View style={styles.roleRow}>{(user?.roles || []).map((role) => <View key={role} style={styles.rolePill}><Text style={styles.roleText}>{role.replace(/_/g, " ")}</Text></View>)}</View>
      <Pressable accessibilityRole="button" accessibilityLabel="Change workspace and academic context" onPress={() => navigation.navigate("WorkspaceContext")} style={styles.contextButton}>
        <View style={styles.contextCopy}><Text style={styles.contextTitle}>Workspace & academic context</Text><Text style={styles.contextSubtitle}>Active: {activeScopeLabel}</Text><Text style={styles.contextHint}>Campus, department, programme, year, batch, semester and section</Text></View>
        <Text style={styles.contextArrow}>›</Text>
      </Pressable>
    </View>

    <View style={styles.sectionHeader}><Text style={styles.sectionTitle}>My Work</Text><Pressable onPress={() => { void query.refetch(); }} accessibilityRole="button"><Text style={styles.link}>Refresh</Text></Pressable></View>
    {query.isLoading ? <View style={styles.stateCard}><ActivityIndicator color={colors.primary} /><Text style={styles.muted}>Loading live work items…</Text></View> :
      query.isError ? <View style={styles.stateCard}>
        <Text style={styles.stateTitle}>Work summary unavailable</Text>
        <Text style={styles.muted}>{query.error instanceof ApiError ? query.error.message : "Check your connection and try again."}</Text>
        <Pressable onPress={() => { void query.refetch(); }} style={styles.retry}><Text style={styles.retryText}>Try again</Text></Pressable>
      </View> : <>
        <View style={styles.metrics}>
          {([["Open items", query.data?.total], ["Critical", query.data?.critical], ["Pending", query.data?.pending], ["Completed", query.data?.completed]] as Array<[string, number | undefined]>)
            .filter((entry) => entry[1] !== undefined).map((entry) => <View key={entry[0]} style={styles.metricCard}><Text style={styles.metricValue}>{String(entry[1])}</Text><Text style={styles.metricLabel}>{entry[0]}</Text></View>)}
        </View>
        {(query.data?.items || []).length ? (query.data?.items || []).map((item) => <View key={item.id} style={styles.workCard}>
          <View style={styles.workTop}><Text style={styles.workTitle}>{item.title}</Text><View style={[styles.priority, item.priority === "critical" ? styles.critical : item.priority === "high" ? styles.high : styles.normal]}><Text style={styles.priorityText}>{item.priority}</Text></View></View>
          <Text style={styles.workCount}>{String(item.count)} item(s)</Text>
          {item.detail ? <Text style={styles.muted}>{item.detail}</Text> : null}
        </View>) : <View style={styles.stateCard}><Text style={styles.stateTitle}>You are all caught up</Text><Text style={styles.muted}>The backend returned no pending work items for this account.</Text></View>}
      </>}
    <Text style={styles.footnote}>Metrics are fetched live from the ACADLYX API. No sample production records are inserted by this app.</Text>
  </ScrollView>;
}
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.canvas }, content: { padding: spacing.lg, paddingBottom: 36 },
  hero: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: spacing.xl },
  eyebrow: { color: colors.primary, fontWeight: "800", fontSize: 10, letterSpacing: 1.1 },
  title: { color: colors.text, fontSize: 25, fontWeight: "900", marginTop: 8 },
  subtitle: { color: colors.textMuted, lineHeight: 20, marginTop: 8, fontSize: 13 },
  roleRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 14 },
  rolePill: { backgroundColor: colors.primarySoft, paddingHorizontal: 9, paddingVertical: 6, borderRadius: radius.pill },
  roleText: { color: colors.primary, fontSize: 10, fontWeight: "800" },
  contextButton: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 18, padding: 13, borderRadius: radius.md, backgroundColor: colors.primarySoft },
  contextCopy: { flex: 1, gap: 4 }, contextTitle: { color: colors.primary, fontWeight: "900", fontSize: 13 },
  contextSubtitle: { color: colors.text, fontSize: 12, lineHeight: 17, fontWeight: "700" }, contextHint: { color: colors.textMuted, fontSize: 10, lineHeight: 15 }, contextArrow: { color: colors.primary, fontSize: 24, fontWeight: "900" },
  sectionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 24, marginBottom: 10 },
  sectionTitle: { color: colors.text, fontSize: 19, fontWeight: "800" }, link: { color: colors.primary, fontWeight: "800" },
  metrics: { flexDirection: "row", flexWrap: "wrap", gap: 9, marginBottom: 12 },
  metricCard: { flexGrow: 1, flexBasis: "45%", backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, padding: 15, borderRadius: radius.md },
  metricValue: { color: colors.text, fontSize: 24, fontWeight: "900" }, metricLabel: { color: colors.textMuted, fontSize: 12, marginTop: 4 },
  workCard: { backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: spacing.lg, marginBottom: 9 },
  workTop: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 10 },
  workTitle: { color: colors.text, flex: 1, fontSize: 15, fontWeight: "800" }, workCount: { color: colors.primary, fontWeight: "800", marginTop: 8, marginBottom: 5 },
  priority: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: radius.pill }, critical: { backgroundColor: colors.dangerSoft }, high: { backgroundColor: "#F7EBD0" }, normal: { backgroundColor: colors.primarySoft },
  priorityText: { color: colors.text, fontSize: 10, fontWeight: "800", textTransform: "uppercase" },
  stateCard: { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: radius.md, padding: spacing.xl, alignItems: "center", gap: 10 },
  stateTitle: { color: colors.text, fontWeight: "800", fontSize: 16 }, muted: { color: colors.textMuted, fontSize: 13, lineHeight: 19, textAlign: "center" },
  retry: { marginTop: 5, backgroundColor: colors.primarySoft, borderRadius: radius.sm, paddingHorizontal: 16, paddingVertical: 9 }, retryText: { color: colors.primary, fontWeight: "800" },
  footnote: { color: colors.textMuted, fontSize: 11, lineHeight: 17, marginTop: 17, textAlign: "center" }
});