import React, { useMemo, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, TextInput, View } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useQuery } from "@tanstack/react-query";
import { apiRequest, ApiError } from "../api/client";
import { toCollection, displayValue, safeRecordEntries, recordTitle } from "../api/payload";
import { useAuth } from "../auth/AuthProvider";
import { getModule } from "../modules/catalog";
import { useWorkspaceContext } from "../workspace/WorkspaceContextProvider";
import { AssignmentsScreen } from "./AssignmentsScreen";
import { NoticesScreen } from "./NoticesScreen";
import { TimetableScreen } from "./TimetableScreen";
import { LibraryScreen } from "./LibraryScreen";
import { CalendarScreen } from "./CalendarScreen";
import { AttendanceScreen } from "./AttendanceScreen";
import { LeaveScreen } from "./LeaveScreen";
import { HRScreen } from "./HRScreen";
import { AdmissionsScreen } from "./AdmissionsScreen";
import { PlacementScreen } from "./PlacementScreen";
import { LmsScreen } from "./LmsScreen";
import { StudentPortalScreen } from "./StudentPortalScreen";
import { NotificationsScreen } from "./NotificationsScreen";
import { ParentScreen } from "./ParentScreen";
import { InternalMarksScreen } from "./InternalMarksScreen";
import { ExaminationsScreen } from "./ExaminationsScreen";
import { FinanceScreen } from "./FinanceScreen";
import { DocumentsScreen } from "./DocumentsScreen";
import { AcademicRecordsScreen, supportsAcademicRecords } from "./AcademicRecordsScreen";
import { StudentsScreen } from "./StudentsScreen";
import { EventsScreen } from "./EventsScreen";
import { RegistrationsScreen } from "./RegistrationsScreen";
import { UsersScreen } from "./UsersScreen";
import { FacultyScreen } from "./FacultyScreen";
import { EnrollmentRequestsScreen } from "./EnrollmentRequestsScreen";
import { OperationsScreen } from "./OperationsScreen";
import { CertificatesScreen } from "./CertificatesScreen";
import { ReportsScreen } from "./ReportsScreen";
import { ObeScreen } from "./ObeScreen";
import { InstitutionsScreen } from "./InstitutionsScreen";
import type { Section as FinanceSection } from "./FinanceScreen";
import { RootStackParamList } from "../navigation/RootNavigator";
import { colors, radius, spacing } from "../ui/theme";

type Props = NativeStackScreenProps<RootStackParamList, "Module">;

export function ModuleScreen({ route }: Props) {
  const { user } = useAuth();
  const { context } = useWorkspaceContext();
  const workspaceKey = JSON.stringify(context?.scope ?? {});
  const module = getModule(route.params.moduleId);
  const financeSections: Record<string, FinanceSection> = { "fee-structures": "structures", "finance-invoices": "invoices", "finance-payments": "payments", "finance-refunds": "refunds" };
  const isFinanceWorkspace = Boolean(module && Object.prototype.hasOwnProperty.call(financeSections, module.id));
  const isExaminationsWorkspace = module?.id === "examinations";
  const isInternalMarksWorkspace = module?.id === "internal-marks" || module?.id === "grades";
  const isDocumentsWorkspace = module?.id === "documents";
  const isAcademicRecordsWorkspace = Boolean(module && supportsAcademicRecords(module.id));
  const isStudentsWorkspace = module?.id === "students";
  const isEventsWorkspace = module?.id === "events";
  const isRegistrationsWorkspace = module?.id === "registrations";
  const isUsersWorkspace = module?.id === "users";
  const isFacultyWorkspace = module?.id === "faculty";
  const isEnrollmentRequestsWorkspace = module?.id === "enrollment-requests";
  const isOperationsWorkspace = module?.id === "operations";
  const isCertificatesWorkspace = module?.id === "certificates";
  const isReportsWorkspace = module?.id === "reports" || module?.id === "intelligence";
  const isObeWorkspace = module?.id === "obe";
  const isInstitutionsWorkspace = module?.id === "institutions";
  const isDedicatedWorkflow = Boolean(module && [
    "assignments", "notices", "timetable", "library", "calendar", "attendance",
    "leave", "hr", "admissions", "placements", "lms", "notifications",
    "parent-children", "student-dashboard", "student-attendance", "student-marks",
    "student-results", "student-assignments", "student-timetable",
  ].includes(module.id));
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const query = useQuery({
    queryKey: ["module", user?.id, workspaceKey, module?.id],
    queryFn: () => {
      if (!module) throw new Error("This mobile module has not been mapped.");
      return apiRequest<unknown>(module.endpoint);
    },
    enabled: Boolean(user?.id && module && !isFinanceWorkspace && !isExaminationsWorkspace && !isInternalMarksWorkspace && !isDocumentsWorkspace && !isAcademicRecordsWorkspace && !isStudentsWorkspace && !isEventsWorkspace && !isRegistrationsWorkspace && !isUsersWorkspace && !isFacultyWorkspace && !isEnrollmentRequestsWorkspace && !isOperationsWorkspace && !isCertificatesWorkspace && !isDedicatedWorkflow && !isReportsWorkspace && !isObeWorkspace && !isInstitutionsWorkspace),
    staleTime: 0
  });
  const records = useMemo(() => {
    const loaded = toCollection(query.data);
    const normalized = search.trim().toLowerCase();
    return normalized ? loaded.filter((item) => displayValue(item).toLowerCase().includes(normalized)) : loaded;
  }, [query.data, search]);

  if (!module) return <View style={styles.center}><Text style={styles.errorTitle}>Module not found</Text><Text style={styles.muted}>This route is not in the native catalog.</Text></View>;
  if (isFinanceWorkspace) return <FinanceScreen initialTab={financeSections[module.id]} />;
  if (isExaminationsWorkspace) return <ExaminationsScreen />;
  if (isInternalMarksWorkspace) return <InternalMarksScreen />;
  if (isDocumentsWorkspace) return <DocumentsScreen />;
  if (isAcademicRecordsWorkspace) return <AcademicRecordsScreen moduleId={module.id} />;
  if (isStudentsWorkspace) return <StudentsScreen />;
  if (isEventsWorkspace) return <EventsScreen />;
  if (isRegistrationsWorkspace) return <RegistrationsScreen />;
  if (isUsersWorkspace) return <UsersScreen />;
  if (isFacultyWorkspace) return <FacultyScreen />;
  if (isEnrollmentRequestsWorkspace) return <EnrollmentRequestsScreen />;
  if (isOperationsWorkspace) return <OperationsScreen />;
  if (isCertificatesWorkspace) return <CertificatesScreen />;
  if (isReportsWorkspace) return <ReportsScreen />;
  if (isObeWorkspace) return <ObeScreen />;
  if (isInstitutionsWorkspace) return <InstitutionsScreen />;
  if (module?.id === "assignments") return <AssignmentsScreen />;
  if (module?.id === "notices") return <NoticesScreen />;
  if (module?.id === "timetable") return <TimetableScreen />;
  if (module?.id === "library") return <LibraryScreen />;
  if (module?.id === "calendar") return <CalendarScreen />;
  if (module?.id === "attendance") return <AttendanceScreen />;
  if (module?.id === "leave") return <LeaveScreen />;
  if (module?.id === "hr") return <HRScreen />;
  if (module?.id === "admissions") return <AdmissionsScreen />;
  if (module?.id === "placements") return <PlacementScreen />;
  if (module?.id === "lms") return <LmsScreen />;
  if (module?.id === "notifications") return <NotificationsScreen />;
  if (module?.id === "parent-children") return <ParentScreen />;
  if (module?.id.startsWith("student-")) {
    const initialTabs = {
      "student-dashboard": "OVERVIEW",
      "student-attendance": "ATTENDANCE",
      "student-marks": "MARKS",
      "student-results": "RESULTS",
      "student-assignments": "ASSIGNMENTS",
      "student-timetable": "TIMETABLE",
    } as const;
    const initialTab = initialTabs[module.id as keyof typeof initialTabs];
    return <StudentPortalScreen initialTab={initialTab} />;
  }

  return <View style={styles.root}>
    <View style={styles.heading}><Text style={styles.title}>{module.title}</Text><Text style={styles.description}>{module.description}</Text><Text style={styles.source}>API surface: {module.endpoint}</Text></View>
    <TextInput value={search} onChangeText={setSearch} placeholder="Filter loaded records" placeholderTextColor={colors.textMuted}
      style={styles.search} accessibilityLabel="Filter loaded records" />
    {query.isLoading ? <View style={styles.center}><ActivityIndicator size="large" color={colors.primary} /><Text style={styles.muted}>Loading live records…</Text></View> :
      query.isError ? <View style={styles.center}>
        <Text style={styles.errorTitle}>{query.error instanceof ApiError && query.error.status === 403 ? "Access not granted" : "Could not load records"}</Text>
        <Text style={styles.muted}>{query.error instanceof Error ? query.error.message : "The request failed. Try again."}</Text>
        {query.error instanceof ApiError && query.error.requestId ? <Text style={styles.requestId}>Request reference: {query.error.requestId}</Text> : null}
        <Pressable accessibilityRole="button" onPress={() => { void query.refetch(); }} style={styles.retry}><Text style={styles.retryText}>Retry</Text></Pressable>
      </View> : <FlatList data={records}
        keyExtractor={(item, index) => {
          if (typeof item === "object" && item !== null) {
            const value = item as Record<string, unknown>;
            const key = value.id || value.code || value.email || value.name || value.title;
            if (typeof key === "string" || typeof key === "number") return String(key) + "-" + index;
          }
          return "record-" + index;
        }}
        refreshControl={<RefreshControl refreshing={query.isRefetching} onRefresh={() => { void query.refetch(); }} tintColor={colors.primary} />}
        contentContainerStyle={styles.list}
        renderItem={({ item, index }) => {
          const rowKey = String(index);
          const title = recordTitle(item, "Record " + String(index + 1));
          const fields = safeRecordEntries(item);
          return <View style={styles.record}>
            <Pressable accessibilityRole="button" accessibilityLabel={"Show details for " + title}
              onPress={() => setExpanded(expanded === rowKey ? null : rowKey)} style={styles.recordHead}>
              <Text style={styles.recordTitle}>{title}</Text><Text style={styles.expand}>{expanded === rowKey ? "−" : "+"}</Text>
            </Pressable>
            {fields.slice(0, expanded === rowKey ? 30 : 3).map(([field, value]) => <View key={field} style={styles.field}>
              <Text style={styles.fieldLabel}>{field.replace(/([A-Z])/g, " $1").replace(/[_-]/g, " ")}</Text><Text style={styles.fieldValue}>{displayValue(value)}</Text>
            </View>)}
            {expanded === rowKey && fields.length === 0 ? <Text style={styles.muted}>No displayable fields were returned.</Text> : null}
            {fields.length > 3 && expanded !== rowKey ? <Text style={styles.more}>Tap to inspect {fields.length} displayable fields</Text> : null}
          </View>;
        }}
        ListEmptyComponent={<View style={styles.center}><Text style={styles.errorTitle}>No records returned</Text><Text style={styles.muted}>The authorized API response contained no displayable records.</Text></View>}
        initialNumToRender={12} windowSize={7} />}
    <View style={styles.footer}><Text style={styles.footerText}>Read-only foundation. Create, edit, delete and approval actions need their actual backend schemas and permissions before they can be enabled.</Text></View>
  </View>;
}
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.canvas },
  heading: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: spacing.md },
  title: { color: colors.text, fontWeight: "900", fontSize: 23 },
  description: { color: colors.textMuted, lineHeight: 19, fontSize: 13, marginTop: 6 }, source: { color: colors.textMuted, fontSize: 10, marginTop: 7 },
  search: { marginHorizontal: spacing.lg, marginBottom: spacing.md, backgroundColor: colors.surface, color: colors.text, borderColor: colors.border, borderWidth: 1, borderRadius: radius.md, paddingHorizontal: 13, paddingVertical: 11 },
  list: { paddingHorizontal: spacing.lg, paddingBottom: 14 },
  record: { borderColor: colors.border, borderWidth: 1, backgroundColor: colors.surface, borderRadius: radius.md, marginBottom: 10, padding: spacing.md },
  recordHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10, paddingBottom: 7 },
  recordTitle: { flex: 1, color: colors.text, fontSize: 15, fontWeight: "800" }, expand: { color: colors.primary, fontSize: 22, fontWeight: "800", paddingHorizontal: 5 },
  field: { borderTopWidth: 1, borderTopColor: colors.surfaceMuted, paddingTop: 8, marginTop: 5 },
  fieldLabel: { color: colors.textMuted, fontSize: 10, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.4 },
  fieldValue: { color: colors.text, fontSize: 13, lineHeight: 19, marginTop: 3 }, more: { color: colors.primary, marginTop: 9, fontSize: 11, fontWeight: "800" },
  center: { flex: 1, padding: spacing.xl, justifyContent: "center", alignItems: "center", gap: 10 },
  muted: { color: colors.textMuted, textAlign: "center", fontSize: 13, lineHeight: 19 }, errorTitle: { color: colors.text, fontSize: 17, fontWeight: "800" },
  retry: { backgroundColor: colors.primary, paddingHorizontal: 18, paddingVertical: 10, borderRadius: radius.md, marginTop: 6 }, retryText: { color: colors.white, fontWeight: "800" },
  requestId: { color: colors.textMuted, fontSize: 11, marginTop: 4 },
  footer: { borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.surface, padding: spacing.md },
  footerText: { color: colors.textMuted, fontSize: 10, lineHeight: 15, textAlign: "center" }
});