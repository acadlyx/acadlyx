import React, { useMemo, useState } from "react";
import { ActivityIndicator, Alert, Linking, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "../api/client";
import { toCollection } from "../api/payload";
import { useAuth } from "../auth/AuthProvider";
import { colors, radius, spacing } from "../ui/theme";

type RecordValue = Record<string, unknown>;
type Course = RecordValue & { id: string };
type Workspace = RecordValue & { offering: RecordValue; workflow: RecordValue; modules: unknown[]; assignments: unknown[]; quizzes: unknown[]; liveClasses: unknown[]; announcements: unknown[]; discussions: unknown[] };

const asRecord = (value: unknown): RecordValue => typeof value === "object" && value !== null && !Array.isArray(value) ? value as RecordValue : {};
const text = (record: RecordValue, key: string) => record[key] === null || record[key] === undefined ? "" : String(record[key]);
const date = (value: unknown) => typeof value === "string" && value ? new Date(value).toLocaleString() : "—";
const title = (record: RecordValue, fallback: string) => text(record, "title") || text(record, "name") || text(record, "code") || fallback;

function Failure({ error, retry }: { error: unknown; retry: () => void }) {
  return <View style={styles.center}><Text style={styles.failure}>{error instanceof Error ? error.message : "Could not load this learning space."}</Text><Pressable style={styles.secondaryButton} onPress={retry}><Text style={styles.secondaryText}>Try again</Text></Pressable></View>;
}
function Loading({ label }: { label: string }) { return <View style={styles.center}><ActivityIndicator color={colors.primary} /><Text style={styles.muted}>Loading {label}…</Text></View>; }
function Empty({ title: heading, detail }: { title: string; detail: string }) { return <View style={styles.empty}><Text style={styles.cardTitle}>{heading}</Text><Text style={styles.muted}>{detail}</Text></View>; }

export function LmsScreen() {
  const { user } = useAuth();
  const client = useQueryClient();
  const [search, setSearch] = useState("");
  const [courseId, setCourseId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const canManage = Boolean(user?.permissions.includes("lms.manage"));
  const canDiscuss = Boolean(user?.permissions.includes("lms.attempt")) && !user?.roles.includes("PARENT");

  const catalogQuery = useQuery({ queryKey: ["lms", user?.id, "catalog", search], queryFn: () => apiRequest<unknown>("/lms/catalog?page=1&pageSize=50" + (search.trim() ? "&search=" + encodeURIComponent(search.trim()) : "")), enabled: Boolean(user?.id), staleTime: 0 });
  const workspaceQuery = useQuery({ queryKey: ["lms", user?.id, "workspace", courseId], queryFn: () => apiRequest<Workspace>("/lms/offerings/" + encodeURIComponent(courseId || "") + "/workspace"), enabled: Boolean(user?.id && courseId), staleTime: 0 });
  const courses = useMemo(() => toCollection(catalogQuery.data).map(asRecord).filter(item => Boolean(text(item, "id"))) as Course[], [catalogQuery.data]);
  const workspace = workspaceQuery.data;
  const refresh = async () => {
    await client.invalidateQueries({ queryKey: ["lms", user?.id] });
    await client.invalidateQueries({ queryKey: ["my-work", user?.id] });
  };
  const transition = useMutation({
    mutationFn: (action: string) => apiRequest<unknown>("/lms/offerings/" + encodeURIComponent(courseId || "") + "/workflow", { method: "POST", body: JSON.stringify({ action }) }),
    onSuccess: refresh
  });
  const discuss = useMutation({
    mutationFn: () => {
      const body = message.trim();
      if (!body) throw new Error("Write a discussion message before posting.");
      return apiRequest<unknown>("/lms/offerings/" + encodeURIComponent(courseId || "") + "/discussions", { method: "POST", body: JSON.stringify({ body }) });
    },
    onSuccess: async () => { setMessage(""); await refresh(); }
  });
  const workflow = asRecord(workspace?.workflow);
  const workflowStatus = text(workflow, "status") || "DRAFT";
  const workflowActions = useMemo(() => {
    if (!canManage) return [] as Array<{ action: string; label: string }>;
    if (workflowStatus === "DRAFT" || workflowStatus === "REJECTED") return [{ action: "SUBMIT", label: "Submit for approval" }];
    if (workflowStatus === "PENDING_APPROVAL") return [{ action: "APPROVE", label: "Approve" }, { action: "REJECT", label: "Reject" }];
    if (workflowStatus === "APPROVED") return [{ action: "PUBLISH", label: "Publish" }];
    if (workflowStatus === "PUBLISHED") return [{ action: "ARCHIVE", label: "Archive" }];
    if (workflowStatus === "ARCHIVED") return [{ action: "REOPEN", label: "Reopen" }];
    return [];
  }, [canManage, workflowStatus]);
  const runTransition = (action: string, label: string) => Alert.alert(label + " course?", "The existing LMS workflow validates this transition and your course scope.", [{ text: "Cancel", style: "cancel" }, { text: label, onPress: () => transition.mutate(action) }]);

  if (!courseId) return <View style={styles.root}><View style={styles.header}><Text style={styles.eyebrow}>LEARNING MANAGEMENT</Text><Text style={styles.pageTitle}>My learning spaces</Text><Text style={styles.subtitle}>Courses are supplied by your authorised enrolment, faculty assignment, or academic scope.</Text><TextInput value={search} onChangeText={setSearch} style={styles.input} placeholder="Search course code or name" placeholderTextColor={colors.textMuted} accessibilityLabel="Search learning spaces" /></View>{catalogQuery.isLoading ? <Loading label="learning spaces" /> : catalogQuery.isError ? <Failure error={catalogQuery.error} retry={() => { void catalogQuery.refetch(); }} /> : <ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={catalogQuery.isRefetching} onRefresh={() => { void catalogQuery.refetch(); }} tintColor={colors.primary} />}>{courses.map(course => <Pressable key={text(course, "id")} style={styles.card} onPress={() => setCourseId(text(course, "id"))}><View style={styles.row}><Text style={styles.cardTitle}>{text(course, "code") || "Course"} · {text(course, "name") || "Learning space"}</Text><Text style={styles.status}>{text(course, "lmsStatus").replace(/_/g, " ") || "DRAFT"}</Text></View><Text style={styles.muted}>{[text(course, "programName"), text(course, "semesterName"), text(course, "sectionName")].filter(Boolean).join(" · ") || "Academic offering"}</Text><Text style={styles.link}>Open learning space →</Text></Pressable>)}{!courses.length ? <Empty title="No learning spaces" detail="No courses are available for the active academic context." /> : null}</ScrollView>}</View>;

  if (workspaceQuery.isLoading) return <Loading label="learning space" />;
  if (workspaceQuery.isError || !workspace) return <Failure error={workspaceQuery.error || new Error("This learning space is unavailable.")} retry={() => { void workspaceQuery.refetch(); }} />;
  const modules = Array.isArray(workspace.modules) ? workspace.modules.map(asRecord) : [];
  const assignments = Array.isArray(workspace.assignments) ? workspace.assignments.map(asRecord) : [];
  const quizzes = Array.isArray(workspace.quizzes) ? workspace.quizzes.map(asRecord) : [];
  const liveClasses = Array.isArray(workspace.liveClasses) ? workspace.liveClasses.map(asRecord) : [];
  const announcements = Array.isArray(workspace.announcements) ? workspace.announcements.map(asRecord) : [];
  const discussions = Array.isArray(workspace.discussions) ? workspace.discussions.map(asRecord) : [];
  const offering = asRecord(workspace.offering);
  const actionError = transition.error || discuss.error;
  return <ScrollView style={styles.root} contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={workspaceQuery.isRefetching} onRefresh={() => { void workspaceQuery.refetch(); }} tintColor={colors.primary} />}>
    <Pressable onPress={() => { setCourseId(null); setMessage(""); }}><Text style={styles.back}>‹ All learning spaces</Text></Pressable>
    <Text style={styles.eyebrow}>LEARNING MANAGEMENT</Text><Text style={styles.pageTitle}>{text(offering, "code")} · {text(offering, "name") || "Course workspace"}</Text><View style={styles.row}><Text style={styles.muted}>{text(offering, "sectionName") || "Current offering"}</Text><Text style={styles.status}>{workflowStatus.replace(/_/g, " ")}</Text></View>
    {workflowActions.length ? <View style={styles.actionRow}>{workflowActions.map(item => <Pressable key={item.action} style={styles.primaryButton} onPress={() => runTransition(item.action, item.label)} disabled={transition.isPending}><Text style={styles.primaryText}>{transition.isPending ? "Updating…" : item.label}</Text></Pressable>)}</View> : null}
    {actionError ? <Text style={styles.failure}>{actionError instanceof Error ? actionError.message : "The requested LMS action failed."}</Text> : null}
    <Section title="Course content">{modules.length ? modules.map(module => <View key={text(module,"id") || title(module,"module")} style={styles.item}><Text style={styles.cardTitle}>{text(module,"sequence") ? text(module,"sequence") + ". " : ""}{title(module,"Learning module")}</Text>{(Array.isArray(module.lessons) ? module.lessons.map(asRecord) : []).map(lesson => <View key={text(lesson,"id") || title(lesson,"lesson")} style={styles.lesson}><Text style={styles.detail}>{text(lesson,"sequence") ? text(lesson,"sequence") + ". " : ""}{title(lesson,"Lesson")}</Text>{(Array.isArray(lesson.resources) ? lesson.resources.map(asRecord) : []).map(resource => <Pressable key={text(resource,"id") || title(resource,"resource")} onPress={() => { const url = text(resource,"fileUrl"); if (url) void Linking.openURL(url); }} disabled={!text(resource,"fileUrl")}><Text style={[styles.link,!text(resource,"fileUrl") ? styles.disabled : null]}>↳ {title(resource,"Resource")}{text(resource,"fileUrl") ? " · Open" : " · No linked file"}</Text></Pressable>)}</View>)}</View>) : <Empty title="No course content yet" detail="Published lessons and linked learning resources will appear here." />}</Section>
    <Section title="Assignments">{assignments.length ? assignments.map(item => <View key={text(item,"id")} style={styles.item}><Text style={styles.cardTitle}>{title(item,"Assignment")}</Text><Text style={styles.muted}>Due {date(item.dueDate)} · {text(item,"status").replace(/_/g," ") || "Draft"}</Text><Text style={styles.detail}>{text(item,"description") || text(item,"instructions") || "Open Assignments to submit, review, or grade."}</Text></View>) : <Empty title="No assignments" detail="Assignments for this course will appear here when available." />}</Section>
    <Section title="Quizzes">{quizzes.length ? quizzes.map(item => <View key={text(item,"id")} style={styles.item}><Text style={styles.cardTitle}>{title(item,"Quiz")}</Text><Text style={styles.muted}>{text(item,"status").replace(/_/g," ") || "Available"} · Due {date(item.dueDate || item.endsAt)}</Text></View>) : <Empty title="No quizzes" detail="There are no quizzes visible in this course." />}</Section>
    <Section title="Live classes">{liveClasses.length ? liveClasses.map(item => <View key={text(item,"id")} style={styles.item}><Text style={styles.cardTitle}>{title(item,"Live class")}</Text><Text style={styles.muted}>{date(item.startsAt)} – {date(item.endsAt)} · {text(item,"status") || "SCHEDULED"}</Text>{text(item,"meetingUrl") ? <Pressable onPress={() => void Linking.openURL(text(item,"meetingUrl"))}><Text style={styles.link}>Join meeting →</Text></Pressable> : null}</View>) : <Empty title="No live classes" detail="Scheduled sessions will appear here." />}</Section>
    <Section title="Announcements">{announcements.length ? announcements.map(item => <View key={text(item,"id")} style={styles.item}><Text style={styles.cardTitle}>{title(item,"Announcement")}</Text><Text style={styles.detail}>{text(item,"body")}</Text><Text style={styles.muted}>{date(item.publishedAt)}</Text></View>) : <Empty title="No announcements" detail="Course and institution announcements will appear here." />}</Section>
    <Section title="Discussion">{discussions.map(item => <View key={text(item,"id")} style={styles.item}><Text style={styles.detail}>{text(item,"firstName")} {text(item,"lastName")}</Text><Text style={styles.muted}>{text(item,"body")}</Text></View>)}{canDiscuss ? <><TextInput value={message} onChangeText={setMessage} multiline style={[styles.input,styles.message]} placeholder="Ask the class or faculty a question" placeholderTextColor={colors.textMuted} accessibilityLabel="Discussion message" /><Pressable style={styles.primaryButton} onPress={() => discuss.mutate()} disabled={discuss.isPending}><Text style={styles.primaryText}>{discuss.isPending ? "Posting…" : "Post discussion"}</Text></Pressable></> : <Text style={styles.muted}>Discussion is read-only for this account.</Text>}{!discussions.length && !canDiscuss ? <Empty title="No discussion messages" detail="No discussion messages are available yet." /> : null}</Section>
  </ScrollView>;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) { return <View style={styles.section}><Text style={styles.sectionTitle}>{title}</Text>{children}</View>; }

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.canvas }, content: { padding: spacing.lg, paddingBottom: 36 }, header: { padding: spacing.lg, paddingBottom: 4 }, center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 30, gap: 12 }, eyebrow: { color: colors.primary, fontSize: 11, fontWeight: "800", letterSpacing: 1, marginTop: 6 }, pageTitle: { color: colors.text, fontSize: 23, fontWeight: "800", marginTop: 5 }, subtitle: { color: colors.textMuted, lineHeight: 19, marginTop: 7, marginBottom: 12 }, card: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.md, marginBottom: 10 }, row: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }, cardTitle: { color: colors.text, fontWeight: "800", fontSize: 15, flex: 1 }, status: { color: colors.primary, fontSize: 10, fontWeight: "800", textTransform: "uppercase", textAlign: "right", maxWidth: 120 }, muted: { color: colors.textMuted, fontSize: 13, lineHeight: 19, marginTop: 5 }, detail: { color: colors.text, fontSize: 13, lineHeight: 19, marginTop: 5 }, link: { color: colors.primary, fontWeight: "700", fontSize: 13, marginTop: 8 }, disabled: { color: colors.textMuted }, input: { borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, borderRadius: radius.md, color: colors.text, paddingHorizontal: 12, paddingVertical: 11, marginTop: 12 }, message: { minHeight: 86, textAlignVertical: "top" }, back: { color: colors.primary, fontWeight: "700", marginBottom: 12 }, actionRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 12 }, primaryButton: { backgroundColor: colors.primary, borderRadius: radius.md, paddingHorizontal: 13, paddingVertical: 10, alignSelf: "flex-start", marginTop: 10 }, primaryText: { color: "#fff", fontWeight: "800", fontSize: 13 }, secondaryButton: { borderWidth: 1, borderColor: colors.primary, borderRadius: radius.md, paddingHorizontal: 14, paddingVertical: 10 }, secondaryText: { color: colors.primary, fontWeight: "800" }, failure: { color: colors.danger, lineHeight: 19, marginTop: 10 }, section: { marginTop: 22 }, sectionTitle: { color: colors.text, fontSize: 18, fontWeight: "800", marginBottom: 8 }, item: { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: radius.md, padding: spacing.md, marginBottom: 8 }, lesson: { borderLeftColor: colors.border, borderLeftWidth: 2, paddingLeft: 10, marginTop: 10 }, empty: { backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: spacing.md }
});
