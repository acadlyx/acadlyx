import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, FlatList, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest, ApiError } from "../api/client";
import { toCollection } from "../api/payload";
import { useAuth } from "../auth/AuthProvider";
import { useWorkspaceContext } from "../workspace/WorkspaceContextProvider";
import { colors, radius, spacing } from "../ui/theme";

type AttendanceStatus = "PRESENT" | "ABSENT" | "LATE";
type RosterPerson = { studentId: string; firstName?: string; lastName?: string; rollNumber?: string; admissionNumber?: string; status?: AttendanceStatus | null };
type Offering = { id: string; course?: { code?: string; name?: string }; section?: { name?: string }; semester?: { name?: string; number?: number }; [key: string]: unknown };
type Session = {
  id: string; sessionDate: string; isSubmitted: boolean; submittedAt?: string | null; isLocked?: boolean; lockedAt?: string | null;
  courseOfferingId: string; courseOffering?: { course?: { code?: string; name?: string }; section?: { name?: string }; semester?: { name?: string | null; number?: number | null } };
  roster: RosterPerson[];
};
function rows<T>(value: unknown): T[] { return toCollection(value) as T[]; }
function offeringLabel(o: Offering): string {
  return [o.course?.code, o.course?.name, o.section?.name ? "Section " + o.section.name : "", o.semester?.name || (o.semester?.number ? "Semester " + o.semester.number : "")]
    .filter(Boolean).join(" · ") || "Course offering";
}
function dateValue(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.valueOf())) return value;
  return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");
}
function personName(p: RosterPerson): string {
  return [p.firstName,p.lastName].filter(Boolean).join(" ") || p.admissionNumber || p.studentId;
}
const statusChoices: AttendanceStatus[] = ["PRESENT","ABSENT","LATE"];

export function AttendanceScreen() {
  const { user } = useAuth();
  const { context } = useWorkspaceContext();
  const workspaceKey = JSON.stringify(context?.scope ?? {});
  const client = useQueryClient();
  const canRead = Boolean(user?.permissions.includes("attendance.read"));
  const canMark = Boolean(user?.permissions.includes("attendance.mark"));
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [createVisible, setCreateVisible] = useState(false);
  const [courseOfferingId, setCourseOfferingId] = useState<string | null>(null);
  const [sessionDate, setSessionDate] = useState(dateValue(new Date().toISOString()));
  const [statuses, setStatuses] = useState<Record<string, AttendanceStatus | null>>({});
  const [search, setSearch] = useState("");

  const sessionsQuery = useQuery({
    queryKey: ["attendance-sessions", user?.id],
    queryFn: () => apiRequest<unknown>("/attendance-sessions?page=1&pageSize=50"),
    enabled: Boolean(user?.id && canRead),
    staleTime: 0
  });
  const offeringsQuery = useQuery({
    queryKey: ["attendance-course-offerings", user?.id],
    queryFn: () => apiRequest<unknown>("/course-offerings?page=1&pageSize=100"),
    enabled: Boolean(user?.id && canMark && createVisible),
    staleTime: 15000
  });
  const detailQuery = useQuery({
    queryKey: ["attendance-session", user?.id, workspaceKey, selectedId],
    queryFn: () => apiRequest<Session>("/attendance-sessions/" + encodeURIComponent(selectedId as string)),
    enabled: Boolean(user?.id && canRead && selectedId),
    staleTime: 0
  });

  const sessions = useMemo(() => rows<Session>(sessionsQuery.data).filter(s => typeof s.id === "string"), [sessionsQuery.data]);
  const offerings = useMemo(() => rows<Offering>(offeringsQuery.data).filter(o => typeof o.id === "string"), [offeringsQuery.data]);
  const session = detailQuery.data;
  const visibleRoster = useMemo(() => {
    const roster = session?.roster || [];
    const term = search.trim().toLowerCase();
    return term ? roster.filter(p => (personName(p) + " " + (p.rollNumber || "") + " " + (p.admissionNumber || "")).toLowerCase().includes(term)) : roster;
  }, [session?.roster, search]);

  useEffect(() => {
    if (session) {
      const next: Record<string, AttendanceStatus | null> = {};
      for (const person of session.roster || []) next[person.studentId] = person.status || null;
      setStatuses(next);
    } else setStatuses({});
  }, [selectedId, session?.id, session?.roster]);

  async function invalidate() {
    await Promise.all([
      client.invalidateQueries({ queryKey: ["attendance-sessions", user?.id] }),
      client.invalidateQueries({ queryKey: ["attendance-session", user?.id] }),
      client.invalidateQueries({ queryKey: ["my-work", user?.id] }),
      client.invalidateQueries({ queryKey: ["module", user?.id] })
    ]);
  }

  const create = useMutation({
    mutationFn: async () => {
      if (!canMark) throw new Error("Your session does not include attendance.mark.");
      if (!courseOfferingId) throw new Error("Select a course offering.");
      if (!/^\d{4}-\d{2}-\d{2}$/.test(sessionDate) || Number.isNaN(new Date(sessionDate + "T12:00:00").valueOf())) {
        throw new Error("Enter a valid session date using YYYY-MM-DD.");
      }
      return apiRequest<Session>("/attendance-sessions", {
        method: "POST",
        body: JSON.stringify({ courseOfferingId, sessionDate: new Date(sessionDate + "T12:00:00").toISOString() })
      });
    },
    onSuccess: async (result) => {
      await client.invalidateQueries({ queryKey: ["attendance-sessions", user?.id] });
      setCreateVisible(false);
      setCourseOfferingId(null);
      if (result?.id) setSelectedId(result.id);
    }
  });

  const saveRecords = useMutation({
    mutationFn: async (submit: boolean) => {
      if (!session || !selectedId) throw new Error("Select an attendance session first.");
      if (!canMark) throw new Error("Your session does not include attendance.mark.");
      if (session.isLocked) throw new Error("This session is locked. The backend requires an approved correction request.");
      const records = (session.roster || [])
        .filter(p => statuses[p.studentId] !== null && statuses[p.studentId] !== undefined)
        .map(p => ({ studentId: p.studentId, status: statuses[p.studentId] as AttendanceStatus }));
      if (!records.length) throw new Error("Mark at least one student before saving.");
      if (submit && records.length !== (session.roster || []).length) {
        throw new Error("Every student must have a status before submitting attendance.");
      }
      return apiRequest<Session>("/attendance-sessions/" + encodeURIComponent(selectedId) + "/records", {
        method: "PATCH",
        body: JSON.stringify({ records, submit })
      });
    },
    onSuccess: async () => {
      await invalidate();
      await detailQuery.refetch();
      Alert.alert("Attendance saved", saveRecords.variables ? "Attendance submission was processed by ACADLYX." : "Your attendance draft was saved.");
    }
  });

  const error = create.error || saveRecords.error;
  if (!canRead && !canMark) {
    return <View style={styles.state}><Text style={styles.sectionTitle}>Attendance access unavailable</Text><Text style={styles.muted}>Your current authenticated permissions do not include attendance read or marking. The backend remains authoritative.</Text></View>;
  }

  if (selectedId) {
    const locked = Boolean(session?.isLocked || session?.lockedAt);
    const unmarked = (session?.roster || []).filter(p => statuses[p.studentId] === null || statuses[p.studentId] === undefined).length;
    return <View style={styles.root}>
      <View style={styles.header}>
        <Pressable onPress={() => { setSelectedId(null); setSearch(""); }}><Text style={styles.back}>‹ All sessions</Text></Pressable>
        {detailQuery.isLoading ? <ActivityIndicator color={colors.primary} /> : session ? <>
          <Text style={styles.title}>{session.courseOffering?.course?.code || ""} {session.courseOffering?.course?.name || "Attendance session"}</Text>
          <Text style={styles.subtitle}>{session.courseOffering?.section?.name ? "Section " + session.courseOffering.section.name + " · " : ""}{dateValue(session.sessionDate)}</Text>
          <View style={styles.sessionMeta}>
            <Text style={styles.statusPill}>{session.isLocked ? "LOCKED" : session.isSubmitted ? "SUBMITTED" : "DRAFT"}</Text>
            <Text style={styles.meta}>{String((session.roster || []).length - unmarked)}/{String((session.roster || []).length)} students marked</Text>
          </View>
          {locked ? <Text style={styles.warning}>This session is locked. Attendance changes must use the backend’s approved correction request workflow.</Text> : null}
          <TextInput value={search} onChangeText={setSearch} style={styles.input} placeholder="Search roster" placeholderTextColor={colors.textMuted} accessibilityLabel="Search attendance roster" />
          {canMark && !locked ? <View style={styles.actionRow}>
            <Pressable disabled={saveRecords.isPending} onPress={() => saveRecords.mutate(false)} style={styles.secondaryButton}><Text style={styles.secondaryText}>{saveRecords.isPending && saveRecords.variables === false ? "Saving…" : "Save draft"}</Text></Pressable>
            <Pressable disabled={saveRecords.isPending || unmarked > 0 || (session.roster || []).length === 0} onPress={() => Alert.alert("Submit attendance", "Submit this session after checking every student’s status? The server validates roster membership and audit records.", [
              { text: "Cancel", style: "cancel" },
              { text: "Submit", onPress: () => saveRecords.mutate(true) }
            ])} style={[styles.primaryButton, (unmarked > 0 || (session.roster || []).length === 0) ? styles.disabled : null]}><Text style={styles.buttonText}>{saveRecords.isPending && saveRecords.variables === true ? "Submitting…" : "Submit attendance"}</Text></Pressable>
          </View> : null}
        </> : null}
      </View>
      {detailQuery.isError ? <View style={styles.state}><Text style={styles.sectionTitle}>Session unavailable</Text><Text style={styles.muted}>{detailQuery.error instanceof Error ? detailQuery.error.message : "Could not load attendance."}</Text><Pressable onPress={() => { void detailQuery.refetch(); }} style={styles.primaryButton}><Text style={styles.buttonText}>Retry</Text></Pressable></View> :
        <FlatList data={visibleRoster} keyExtractor={p => p.studentId} contentContainerStyle={styles.list} initialNumToRender={20} windowSize={8}
          renderItem={({ item }) => <View style={styles.studentCard}>
            <Text style={styles.personName}>{personName(item)}</Text>
            <Text style={styles.meta}>{item.rollNumber ? "Roll " + item.rollNumber : item.admissionNumber || ""}</Text>
            <View style={styles.statusRow}>{statusChoices.map(choice => <Pressable key={choice} disabled={!canMark || locked || saveRecords.isPending}
              onPress={() => setStatuses(prev => ({ ...prev, [item.studentId]: choice }))}
              style={[styles.statusChoice, statuses[item.studentId] === choice ? styles.statusSelected : null, (!canMark || locked) ? styles.disabled : null]}>
              <Text style={[styles.statusText, statuses[item.studentId] === choice ? styles.statusTextSelected : null]}>{choice}</Text>
            </Pressable>)}</View>
          </View>}
          ListEmptyComponent={<View style={styles.state}><Text style={styles.sectionTitle}>No roster members</Text><Text style={styles.muted}>The selected offering returned no roster or no students match the search.</Text></View>} />}
      {error ? <View style={styles.errorBanner}><Text style={styles.error}>{error instanceof ApiError ? error.message : error instanceof Error ? error.message : "Attendance action failed."}</Text></View> : null}
    </View>;
  }

  return <View style={styles.root}>
    <View style={styles.header}>
      <Text style={styles.title}>Attendance</Text>
      <Text style={styles.subtitle}>Attendance records are saved transactionally by the existing ACADLYX service; locked sessions require the correction workflow.</Text>
      {canMark ? <Pressable onPress={() => setCreateVisible(v => !v)} style={styles.primaryButton}><Text style={styles.buttonText}>{createVisible ? "Close new session" : "Create session"}</Text></Pressable> : null}
    </View>
    {createVisible && canMark ? <ScrollView style={styles.createForm} contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
      <Text style={styles.sectionTitle}>New attendance session</Text>
      <Text style={styles.label}>Course offering</Text>
      {offeringsQuery.isLoading ? <ActivityIndicator color={colors.primary} /> : offeringsQuery.isError ? <Text style={styles.error}>Course offerings could not be loaded. Select an offering from the authorized API list.</Text> :
        offerings.map(o => <Pressable key={o.id} onPress={() => setCourseOfferingId(o.id)} style={[styles.offering, courseOfferingId === o.id ? styles.offeringSelected : null]}>
          <Text style={styles.personName}>{offeringLabel(o)}</Text>{courseOfferingId === o.id ? <Text style={styles.selected}>Selected</Text> : null}
        </Pressable>)}
      <Text style={styles.label}>Session date (YYYY-MM-DD)</Text><TextInput value={sessionDate} onChangeText={setSessionDate} maxLength={10} style={styles.input} placeholder="2026-10-17" placeholderTextColor={colors.textMuted} />
      {create.isError ? <Text style={styles.error}>{create.error instanceof ApiError ? create.error.message : create.error instanceof Error ? create.error.message : "Could not create session."}</Text> : null}
      <Pressable disabled={create.isPending || !courseOfferingId} onPress={() => create.mutate()} style={[styles.primaryButton, !courseOfferingId ? styles.disabled : null]}>
        {create.isPending ? <ActivityIndicator color={colors.white} /> : <Text style={styles.buttonText}>Create / open session</Text>}
      </Pressable>
    </ScrollView> : null}
    {sessionsQuery.isLoading ? <View style={styles.state}><ActivityIndicator color={colors.primary} /><Text style={styles.muted}>Loading attendance sessions…</Text></View> :
      sessionsQuery.isError ? <View style={styles.state}><Text style={styles.sectionTitle}>Sessions unavailable</Text><Text style={styles.muted}>{sessionsQuery.error instanceof Error ? sessionsQuery.error.message : "Try again."}</Text><Pressable onPress={() => { void sessionsQuery.refetch(); }} style={styles.primaryButton}><Text style={styles.buttonText}>Retry</Text></Pressable></View> :
      <FlatList data={sessions} keyExtractor={item => item.id} contentContainerStyle={styles.list} initialNumToRender={15} windowSize={7}
        renderItem={({ item }) => <Pressable onPress={() => setSelectedId(item.id)} style={styles.sessionCard}>
          <View style={styles.sessionTop}><Text style={styles.personName}>{item.courseOffering?.course?.name || item.courseOffering?.course?.code || "Attendance session"}</Text><Text style={styles.statusPill}>{(item.isLocked || item.lockedAt) ? "LOCKED" : item.isSubmitted ? "SUBMITTED" : "DRAFT"}</Text></View>
          <Text style={styles.meta}>{dateValue(item.sessionDate)}{item.courseOffering?.section?.name ? " · Section " + item.courseOffering.section.name : ""}</Text>
          <Text style={styles.open}>Open roster and attendance →</Text>
        </Pressable>}
        ListEmptyComponent={<View style={styles.state}><Text style={styles.sectionTitle}>No sessions found</Text><Text style={styles.muted}>Create a session for an authorized course offering to begin attendance.</Text></View>} />}
  </View>;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.canvas },
  header: { padding: spacing.lg, gap: 8, backgroundColor: colors.surface, borderBottomWidth: 1, borderColor: colors.border },
  title: { color: colors.text, fontWeight: "900", fontSize: 23 }, subtitle: { color: colors.textMuted, fontSize: 12, lineHeight: 18 },
  back: { color: colors.primary, fontSize: 13, fontWeight: "900", paddingVertical: 3 },
  sessionMeta: { flexDirection: "row", alignItems: "center", gap: 9, marginVertical: 5 }, statusPill: { color: colors.primary, backgroundColor: colors.primarySoft, borderRadius: radius.pill, paddingHorizontal: 9, paddingVertical: 5, overflow: "hidden", fontSize: 9, fontWeight: "900" },
  meta: { color: colors.textMuted, fontSize: 11, lineHeight: 17, marginTop: 4 },
  actionRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 5 },
  primaryButton: { backgroundColor: colors.primary, borderRadius: radius.md, minHeight: 42, paddingHorizontal: 12, paddingVertical: 10, alignItems: "center", justifyContent: "center" },
  buttonText: { color: colors.white, fontSize: 11, fontWeight: "900" }, secondaryButton: { backgroundColor: colors.primarySoft, borderRadius: radius.md, paddingHorizontal: 12, paddingVertical: 10 },
  secondaryText: { color: colors.primary, fontWeight: "900", fontSize: 11 },
  createForm: { maxHeight: 430, backgroundColor: colors.surface, borderBottomWidth: 1, borderColor: colors.border }, form: { padding: spacing.lg, gap: 8 },
  sectionTitle: { color: colors.text, fontSize: 17, fontWeight: "900" }, label: { color: colors.text, fontSize: 12, fontWeight: "800", marginTop: 6 },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, backgroundColor: colors.surface, color: colors.text, paddingHorizontal: 12, paddingVertical: 10, fontSize: 13 },
  offering: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: 11, marginBottom: 5 }, offeringSelected: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  selected: { color: colors.primary, fontWeight: "900", fontSize: 10, marginTop: 4 }, disabled: { opacity: 0.45 },
  list: { padding: spacing.lg, paddingBottom: 28 }, sessionCard: { padding: spacing.lg, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, backgroundColor: colors.surface, marginBottom: 10 },
  sessionTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }, personName: { color: colors.text, fontWeight: "800", fontSize: 14, flex: 1 },
  open: { color: colors.primary, fontSize: 11, fontWeight: "800", marginTop: 10 },
  studentCard: { borderBottomWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, padding: spacing.lg },
  statusRow: { flexDirection: "row", flexWrap: "wrap", gap: 7, marginTop: 10 }, statusChoice: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.pill, paddingHorizontal: 11, paddingVertical: 8, backgroundColor: colors.surfaceMuted },
  statusSelected: { borderColor: colors.primary, backgroundColor: colors.primary }, statusText: { color: colors.textMuted, fontSize: 10, fontWeight: "900" }, statusTextSelected: { color: colors.white },
  warning: { color: colors.warning, backgroundColor: "#F7EBD0", padding: 10, borderRadius: radius.sm, fontSize: 11, lineHeight: 16 },
  state: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.xl, gap: 10 },
  muted: { color: colors.textMuted, fontSize: 12, lineHeight: 18, textAlign: "center" },
  error: { color: colors.danger, fontSize: 12, lineHeight: 17 }, errorBanner: { padding: 10, backgroundColor: colors.dangerSoft, borderTopWidth: 1, borderColor: colors.border }
});