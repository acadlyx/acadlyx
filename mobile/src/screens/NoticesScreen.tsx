import React, { useMemo, useState } from "react";
import { ActivityIndicator, Alert, FlatList, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest, ApiError } from "../api/client";
import { toCollection } from "../api/payload";
import { useAuth } from "../auth/AuthProvider";
import { useWorkspaceContext } from "../workspace/WorkspaceContextProvider";
import { colors, radius, spacing } from "../ui/theme";

type Audience = "ALL" | "STUDENT" | "FACULTY" | "PARENT" | "STAFF" | "HOD" | "MANAGEMENT";
type Notice = { id: string; title: string; body: string; audience?: Audience; departmentId?: string | null; department?: { name?: string; code?: string } | null; expiresAt?: string | null; createdAt?: string; [key: string]: unknown };
type DepartmentChoice = { id: string; name: string; code?: string };
const audiences: Audience[] = ["ALL", "STUDENT", "FACULTY", "PARENT", "STAFF", "HOD", "MANAGEMENT"];

function normalizeNotices(value: unknown): Notice[] {
  return toCollection(value).filter((item): item is Notice =>
    typeof item === "object" && item !== null &&
    typeof (item as Record<string, unknown>).id === "string" &&
    typeof (item as Record<string, unknown>).title === "string"
  );
}
function displayDate(value?: string | null): string {
  if (!value) return "No expiry";
  const d = new Date(value);
  return Number.isNaN(d.valueOf()) ? value : d.toLocaleDateString();
}

export function NoticesScreen() {
  const { user } = useAuth();
  const { context } = useWorkspaceContext();
  const workspaceKey = JSON.stringify(context?.scope ?? {});
  const client = useQueryClient();
  const canManage = Boolean(user?.permissions.includes("notices.manage"));
  const canTargetDepartment = Boolean(canManage && user?.permissions.includes("departments.read"));
  const [editing, setEditing] = useState<Notice | null>(null);
  const [formVisible, setFormVisible] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [audience, setAudience] = useState<Audience>("ALL");
  const [departmentId, setDepartmentId] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [search, setSearch] = useState("");

  const query = useQuery({
    queryKey: ["notices", user?.id, workspaceKey],
    queryFn: () => apiRequest<unknown>("/erp/notices?includeExpired=false"),
    enabled: Boolean(user?.id),
    staleTime: 0
  });
  const departmentsQuery = useQuery({
    queryKey: ["notice-departments", user?.id, workspaceKey],
    queryFn: () => apiRequest<unknown>("/departments?page=1&pageSize=100"),
    enabled: Boolean(user?.id && canTargetDepartment),
    staleTime: 0,
  });
  const departments = useMemo(() => toCollection(departmentsQuery.data).filter((item) => {
    if (typeof item !== "object" || item === null || Array.isArray(item)) return false;
    const value = item as Record<string, unknown>;
    return typeof value.id === "string" && typeof value.name === "string";
  }).map((item) => item as DepartmentChoice), [departmentsQuery.data]);

  const notices = useMemo(() => {
    const rows = normalizeNotices(query.data);
    const term = search.trim().toLowerCase();
    return term ? rows.filter((row) => (row.title + " " + row.body + " " + (row.audience || "")).toLowerCase().includes(term)) : rows;
  }, [query.data, search]);

  async function afterSave() {
    await client.invalidateQueries({ queryKey: ["notices", user?.id, workspaceKey] });
    setEditing(null); setFormVisible(false); setTitle(""); setBody(""); setAudience("ALL"); setDepartmentId(""); setExpiresAt("");
  }

  function beginCreate() {
    setEditing(null); setTitle(""); setBody(""); setAudience("ALL"); setDepartmentId(""); setExpiresAt(""); setFormVisible(true);
  }
  function beginEdit(notice: Notice) {
    setEditing(notice); setTitle(notice.title); setBody(notice.body);
    setAudience(audiences.includes(notice.audience || "ALL") ? (notice.audience || "ALL") as Audience : "ALL");
    setDepartmentId(typeof notice.departmentId === "string" ? notice.departmentId : "");
    setExpiresAt(notice.expiresAt ? new Date(notice.expiresAt).toISOString().slice(0, 10) : "");
    setFormVisible(true);
  }

  const save = useMutation({
    mutationFn: async () => {
      if (!canManage) throw new Error("Your session does not include notices.manage.");
      if (title.trim().length < 1 || title.trim().length > 200) throw new Error("Notice title must contain 1–200 characters.");
      if (body.trim().length < 1 || body.trim().length > 10000) throw new Error("Notice body must contain 1–10,000 characters.");
      if (expiresAt && (!/^\d{4}-\d{2}-\d{2}$/.test(expiresAt) || Number.isNaN(new Date(expiresAt + "T12:00:00").valueOf()))) {
        throw new Error("Expiry date must use YYYY-MM-DD.");
      }
      const payload = {
        title: title.trim(), body: body.trim(), audience,
        ...(canTargetDepartment ? (editing ? { departmentId: departmentId || null } : (departmentId ? { departmentId } : {})) : {}),
        ...(editing ? { expiresAt: expiresAt ? new Date(expiresAt + "T12:00:00").toISOString() : null } : (expiresAt ? { expiresAt: new Date(expiresAt + "T12:00:00").toISOString() } : {}))
      };
      if (editing) {
        return apiRequest<Notice>("/erp/notices/" + encodeURIComponent(editing.id), { method: "PATCH", body: JSON.stringify(payload) });
      }
      return apiRequest<Notice>("/erp/notices", { method: "POST", body: JSON.stringify(payload) });
    },
    onSuccess: afterSave
  });
  const remove = useMutation({
    mutationFn: (id: string) => apiRequest("/erp/notices/" + encodeURIComponent(id), { method: "DELETE" }),
    onSuccess: async () => { await client.invalidateQueries({ queryKey: ["notices", user?.id] }); }
  });
  const mutationError = save.error || remove.error;

  return <View style={styles.root}>
    <View style={styles.header}>
      <Text style={styles.title}>Notices</Text>
      <Text style={styles.subtitle}>Notices are created, scoped and enforced by the existing ACADLYX backend.</Text>
      <TextInput value={search} onChangeText={setSearch} style={styles.input} placeholder="Search notices" placeholderTextColor={colors.textMuted} accessibilityLabel="Search notices" />
      {canManage ? <Pressable accessibilityRole="button" onPress={formVisible ? () => setFormVisible(false) : beginCreate} style={styles.primaryButton}><Text style={styles.buttonText}>{formVisible ? "Close editor" : "Create notice"}</Text></Pressable> : null}
    </View>

    {formVisible && canManage ? <ScrollView style={styles.formScroll} contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
      <Text style={styles.sectionTitle}>{editing ? "Edit notice" : "New notice"}</Text>
      <Text style={styles.label}>Title</Text>
      <TextInput value={title} onChangeText={setTitle} maxLength={200} style={styles.input} placeholder="Notice title" placeholderTextColor={colors.textMuted} />
      <Text style={styles.label}>Message</Text>
      <TextInput value={body} onChangeText={setBody} maxLength={10000} multiline textAlignVertical="top" style={[styles.input, styles.textArea]} placeholder="Write the notice message" placeholderTextColor={colors.textMuted} />
      <Text style={styles.label}>Audience</Text>
      <View style={styles.audiences}>{audiences.map((value) => <Pressable key={value} onPress={() => setAudience(value)} style={[styles.audience, audience === value ? styles.audienceSelected : null]}><Text style={[styles.audienceText, audience === value ? styles.audienceTextSelected : null]}>{value}</Text></Pressable>)}</View>
      {canTargetDepartment ? <>
        <Text style={styles.label}>Department scope (optional)</Text>
        <View style={styles.audiences}>
          <Pressable accessibilityRole="button" accessibilityState={{ selected: !departmentId }} onPress={() => setDepartmentId("")} style={[styles.audience, !departmentId ? styles.audienceSelected : null]}><Text style={[styles.audienceText, !departmentId ? styles.audienceTextSelected : null]}>Institution-wide</Text></Pressable>
          {departments.map((department) => <Pressable key={department.id} accessibilityRole="button" accessibilityState={{ selected: departmentId === department.id }} onPress={() => setDepartmentId(department.id)} style={[styles.audience, departmentId === department.id ? styles.audienceSelected : null]}><Text style={[styles.audienceText, departmentId === department.id ? styles.audienceTextSelected : null]}>{[department.code, department.name].filter(Boolean).join(" · ")}</Text></Pressable>)}
        </View>
        {departmentsQuery.isLoading ? <Text style={styles.helper}>Loading authorized departments…</Text> : null}
        {departmentsQuery.isError ? <Text accessibilityRole="alert" style={styles.error}>Department choices are unavailable. Retry the department request or leave the notice institution-wide.</Text> : null}
      </> : null}
      <Text style={styles.label}>Expiry date (optional, YYYY-MM-DD)</Text>
      <TextInput value={expiresAt} onChangeText={setExpiresAt} maxLength={10} style={styles.input} placeholder="2026-12-31" placeholderTextColor={colors.textMuted} />
      <Text style={styles.helper}>Institution-wide or role audience only. Department targeting is not offered here because the editor does not yet resolve a backend-authorized department picker.</Text>
      {save.isError ? <Text accessibilityRole="alert" style={styles.error}>{save.error instanceof ApiError ? save.error.message : save.error instanceof Error ? save.error.message : "The notice could not be saved."}</Text> : null}
      <Pressable accessibilityRole="button" disabled={save.isPending} onPress={() => save.mutate()} style={styles.primaryButton}>{save.isPending ? <ActivityIndicator color={colors.white} /> : <Text style={styles.buttonText}>{editing ? "Save changes" : "Create notice"}</Text>}</Pressable>
    </ScrollView> : null}

    {query.isLoading ? <View style={styles.state}><ActivityIndicator color={colors.primary} /><Text style={styles.subtitle}>Loading notices…</Text></View> :
      query.isError ? <View style={styles.state}><Text style={styles.sectionTitle}>Notices unavailable</Text><Text style={styles.subtitle}>{query.error instanceof Error ? query.error.message : "Try again."}</Text><Pressable onPress={() => { void query.refetch(); }} style={styles.primaryButton}><Text style={styles.buttonText}>Retry</Text></Pressable></View> :
      <FlatList data={notices} keyExtractor={(item) => item.id} contentContainerStyle={styles.list} initialNumToRender={12} windowSize={7}
        renderItem={({ item }) => <View style={styles.card}>
          <View style={styles.noticeHeader}><Text style={styles.noticeTitle}>{item.title}</Text><Text style={styles.audiencePill}>{item.audience || "ALL"}</Text></View>
          <Text style={styles.body}>{item.body}</Text>
          <Text style={styles.meta}>Scope: {item.department?.name || item.department?.code || (item.departmentId ? "Department-specific" : "Institution-wide")} · Expiry: {displayDate(item.expiresAt)}</Text>
          {canManage ? <View style={styles.actions}>
            <Pressable onPress={() => beginEdit(item)} style={styles.secondaryButton}><Text style={styles.secondaryText}>Edit</Text></Pressable>
            <Pressable onPress={() => Alert.alert("Delete notice", "Delete this notice from the existing system?", [
              { text: "Cancel", style: "cancel" },
              { text: "Delete", style: "destructive", onPress: () => remove.mutate(item.id) }
            ])} style={styles.deleteButton}><Text style={styles.deleteText}>Delete</Text></Pressable>
          </View> : null}
        </View>}
        ListEmptyComponent={<View style={styles.state}><Text style={styles.sectionTitle}>No notices found</Text><Text style={styles.subtitle}>No active notices matched this query.</Text></View>} />}
    {mutationError ? <Text accessibilityRole="alert" style={styles.bottomError}>{mutationError instanceof Error ? mutationError.message : "The action failed."}</Text> : null}
  </View>;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.canvas },
  header: { backgroundColor: colors.surface, padding: spacing.lg, borderBottomWidth: 1, borderColor: colors.border, gap: 9 },
  title: { color: colors.text, fontSize: 23, fontWeight: "900" }, subtitle: { color: colors.textMuted, fontSize: 12, lineHeight: 18 },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, backgroundColor: colors.surface, color: colors.text, paddingHorizontal: 12, paddingVertical: 11, fontSize: 14 },
  textArea: { minHeight: 120 }, primaryButton: { backgroundColor: colors.primary, borderRadius: radius.md, minHeight: 42, paddingHorizontal: 14, paddingVertical: 11, alignItems: "center", justifyContent: "center" },
  buttonText: { color: colors.white, fontSize: 12, fontWeight: "900" }, formScroll: { maxHeight: 460, backgroundColor: colors.surface, borderBottomWidth: 1, borderColor: colors.border },
  form: { padding: spacing.lg, gap: 8 }, sectionTitle: { color: colors.text, fontSize: 17, fontWeight: "900" },
  label: { marginTop: 7, marginBottom: 2, color: colors.text, fontSize: 12, fontWeight: "800" },
  audiences: { flexDirection: "row", flexWrap: "wrap", gap: 6 }, audience: { paddingHorizontal: 9, paddingVertical: 8, borderRadius: radius.pill, backgroundColor: colors.surfaceMuted },
  audienceSelected: { backgroundColor: colors.primary }, audienceText: { color: colors.textMuted, fontSize: 10, fontWeight: "800" }, audienceTextSelected: { color: colors.white },
  helper: { color: colors.textMuted, fontSize: 11, lineHeight: 16, marginVertical: 4 }, error: { color: colors.danger, fontSize: 12, lineHeight: 17 },
  list: { padding: spacing.lg, paddingBottom: 30 }, card: { backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: spacing.lg, marginBottom: 10 },
  noticeHeader: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }, noticeTitle: { color: colors.text, fontWeight: "900", fontSize: 15, flex: 1 },
  audiencePill: { backgroundColor: colors.primarySoft, paddingHorizontal: 8, paddingVertical: 4, borderRadius: radius.pill, color: colors.primary, fontSize: 9, fontWeight: "900" },
  body: { color: colors.text, lineHeight: 20, fontSize: 13, marginTop: 9 }, meta: { color: colors.textMuted, fontSize: 10, marginTop: 8 },
  actions: { flexDirection: "row", gap: 8, marginTop: 12 }, secondaryButton: { backgroundColor: colors.primarySoft, borderRadius: radius.sm, paddingHorizontal: 12, paddingVertical: 8 },
  secondaryText: { color: colors.primary, fontWeight: "800", fontSize: 11 }, deleteButton: { borderColor: colors.danger, borderWidth: 1, borderRadius: radius.sm, paddingHorizontal: 12, paddingVertical: 8 },
  deleteText: { color: colors.danger, fontWeight: "800", fontSize: 11 }, state: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.xl, gap: 10 },
  bottomError: { padding: 9, color: colors.danger, fontSize: 11, backgroundColor: colors.dangerSoft }
});