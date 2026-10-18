import React, { useMemo, useState } from "react";
import { ActivityIndicator, Alert, FlatList, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest, ApiError } from "../api/client";
import { toCollection } from "../api/payload";
import { useAuth } from "../auth/AuthProvider";
import { useWorkspaceContext } from "../workspace/WorkspaceContextProvider";
import { colors, radius, spacing } from "../ui/theme";

type Offering = { id: string; course?: { code?: string; name?: string }; section?: { name?: string }; faculty?: { firstName?: string; lastName?: string }; [key: string]: unknown };
type Entry = {
  id: string; courseOfferingId?: string; dayOfWeek: number; startTime: string; endTime: string; room?: string | null;
  courseOffering?: { course?: { code?: string; name?: string }; section?: { name?: string }; faculty?: { firstName?: string; lastName?: string }; semester?: { name?: string; number?: number } };
};
const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
function rows<T>(value: unknown): T[] { return toCollection(value) as T[]; }
function offeringLabel(offering: Offering): string {
  return [offering.course?.code, offering.course?.name, offering.section?.name ? "Section " + offering.section.name : ""].filter(Boolean).join(" · ") || "Course offering";
}
function entryLabel(entry: Entry): string {
  const c = entry.courseOffering?.course;
  const section = entry.courseOffering?.section?.name;
  return [c?.code, c?.name, section ? "Section " + section : ""].filter(Boolean).join(" · ") || "Teaching session";
}
function validTime(value: string): boolean { return /^([01]\d|2[0-3]):[0-5]\d$/.test(value); }

export function TimetableScreen() {
  const { user } = useAuth();
  const { context } = useWorkspaceContext();
  const workspaceKey = JSON.stringify(context?.scope ?? {});
  const client = useQueryClient();
  const canManage = Boolean(user?.permissions.includes("timetable.manage"));
  const [editing, setEditing] = useState<Entry | null>(null);
  const [formVisible, setFormVisible] = useState(false);
  const [courseOfferingId, setCourseOfferingId] = useState<string | null>(null);
  const [dayOfWeek, setDayOfWeek] = useState(1);
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("10:00");
  const [room, setRoom] = useState("");

  const entriesQuery = useQuery({
    queryKey: ["timetable", user?.id, workspaceKey],
    queryFn: () => apiRequest<unknown>("/erp/timetable"),
    enabled: Boolean(user?.id),
    staleTime: 0
  });
  const offeringsQuery = useQuery({
    queryKey: ["course-offerings-for-timetable", user?.id, workspaceKey],
    queryFn: () => apiRequest<unknown>("/course-offerings?page=1&pageSize=100"),
    enabled: Boolean(user?.id && canManage && formVisible),
    staleTime: 15000
  });
  const offerings = useMemo(() => rows<Offering>(offeringsQuery.data).filter((row) => typeof row.id === "string"), [offeringsQuery.data]);
  const entries = useMemo(() => rows<Entry>(entriesQuery.data).filter((row) => typeof row.id === "string"), [entriesQuery.data]);

  async function refresh() {
    await client.invalidateQueries({ queryKey: ["timetable", user?.id] });
    await client.invalidateQueries({ queryKey: ["my-work", user?.id] });
  }
  function resetForm() {
    setEditing(null); setFormVisible(false); setCourseOfferingId(null); setDayOfWeek(1); setStartTime("09:00"); setEndTime("10:00"); setRoom("");
  }
  function beginCreate() {
    setEditing(null); setCourseOfferingId(null); setDayOfWeek(1); setStartTime("09:00"); setEndTime("10:00"); setRoom(""); setFormVisible(true);
  }
  function beginEdit(entry: Entry) {
    setEditing(entry); setCourseOfferingId(entry.courseOfferingId || null); setDayOfWeek(entry.dayOfWeek);
    setStartTime(entry.startTime); setEndTime(entry.endTime); setRoom(entry.room || ""); setFormVisible(true);
  }

  const save = useMutation({
    mutationFn: async () => {
      if (!canManage) throw new Error("Your session does not include timetable.manage.");
      if (!courseOfferingId) throw new Error("Choose a course offering.");
      if (!Number.isInteger(dayOfWeek) || dayOfWeek < 0 || dayOfWeek > 6) throw new Error("Choose a valid day.");
      if (!validTime(startTime) || !validTime(endTime)) throw new Error("Times must use HH:mm (24-hour) format.");
      if (endTime <= startTime) throw new Error("End time must be after start time.");
      if (room.trim().length > 100) throw new Error("Room must be at most 100 characters.");
      const common = { courseOfferingId, dayOfWeek, startTime, endTime };
      if (editing) return apiRequest<Entry>("/erp/timetable/" + encodeURIComponent(editing.id), {
        method: "PATCH", body: JSON.stringify({ ...common, room: room.trim() || null })
      });
      return apiRequest<Entry>("/erp/timetable", {
        method: "POST", body: JSON.stringify({ ...common, ...(room.trim() ? { room: room.trim() } : {}) })
      });
    },
    onSuccess: async () => { await refresh(); resetForm(); }
  });
  const remove = useMutation({
    mutationFn: (id: string) => apiRequest("/erp/timetable/" + encodeURIComponent(id), { method: "DELETE" }),
    onSuccess: refresh
  });

  const error = save.error || remove.error;
  return <View style={styles.root}>
    <View style={styles.header}>
      <Text style={styles.title}>Timetable</Text>
      <Text style={styles.subtitle}>Schedules are read and changed through the existing timetable service, which validates scope and detects conflicts.</Text>
      <View style={styles.actionRow}>
        <Pressable onPress={() => { void entriesQuery.refetch(); }} style={styles.secondaryButton}><Text style={styles.secondaryText}>Refresh</Text></Pressable>
        {canManage ? <Pressable onPress={formVisible ? resetForm : beginCreate} style={styles.primaryButton}><Text style={styles.buttonText}>{formVisible ? "Close editor" : "Add timetable entry"}</Text></Pressable> : null}
      </View>
    </View>

    {formVisible && canManage ? <ScrollView style={styles.formScroll} contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
      <Text style={styles.sectionTitle}>{editing ? "Edit timetable entry" : "New timetable entry"}</Text>
      <Text style={styles.label}>Course offering</Text>
      {offeringsQuery.isLoading ? <ActivityIndicator color={colors.primary} /> : offeringsQuery.isError ? <Text style={styles.error}>Course offerings could not be loaded. You must select a valid offering.</Text> :
        offerings.map((offering) => <Pressable key={offering.id} onPress={() => setCourseOfferingId(offering.id)} style={[styles.offering, courseOfferingId === offering.id ? styles.offeringSelected : null]}>
          <Text style={styles.offeringText}>{offeringLabel(offering)}</Text>{courseOfferingId === offering.id ? <Text style={styles.selected}>Selected</Text> : null}
        </Pressable>)}
      {offerings.length === 0 && !offeringsQuery.isLoading && !offeringsQuery.isError ? <Text style={styles.helper}>No course offerings returned; no raw ID field is provided.</Text> : null}
      <Text style={styles.label}>Day</Text>
      <View style={styles.days}>{days.map((day, index) => <Pressable key={day} onPress={() => setDayOfWeek(index)} style={[styles.day, dayOfWeek === index ? styles.daySelected : null]}><Text style={[styles.dayText, dayOfWeek === index ? styles.dayTextSelected : null]}>{day.slice(0, 3)}</Text></Pressable>)}</View>
      <View style={styles.timeRow}>
        <View style={styles.timeColumn}><Text style={styles.label}>Start (HH:mm)</Text><TextInput value={startTime} onChangeText={setStartTime} maxLength={5} style={styles.input} placeholder="09:00" placeholderTextColor={colors.textMuted} /></View>
        <View style={styles.timeColumn}><Text style={styles.label}>End (HH:mm)</Text><TextInput value={endTime} onChangeText={setEndTime} maxLength={5} style={styles.input} placeholder="10:00" placeholderTextColor={colors.textMuted} /></View>
      </View>
      <Text style={styles.label}>Room (optional)</Text><TextInput value={room} onChangeText={setRoom} maxLength={100} style={styles.input} placeholder="Room / lab" placeholderTextColor={colors.textMuted} />
      {save.isError ? <Text accessibilityRole="alert" style={styles.error}>{save.error instanceof ApiError ? save.error.message : save.error instanceof Error ? save.error.message : "Unable to save timetable entry."}</Text> : null}
      <Pressable disabled={save.isPending || offerings.length === 0} onPress={() => save.mutate()} style={styles.primaryButton}>{save.isPending ? <ActivityIndicator color={colors.white} /> : <Text style={styles.buttonText}>{editing ? "Save changes" : "Create timetable entry"}</Text>}</Pressable>
    </ScrollView> : null}

    {entriesQuery.isLoading ? <View style={styles.state}><ActivityIndicator color={colors.primary} /><Text style={styles.subtitle}>Loading timetable…</Text></View> :
      entriesQuery.isError ? <View style={styles.state}><Text style={styles.sectionTitle}>Timetable unavailable</Text><Text style={styles.subtitle}>{entriesQuery.error instanceof Error ? entriesQuery.error.message : "Try again."}</Text><Pressable onPress={() => { void entriesQuery.refetch(); }} style={styles.primaryButton}><Text style={styles.buttonText}>Retry</Text></Pressable></View> :
      <FlatList data={entries} keyExtractor={(item) => item.id} contentContainerStyle={styles.list} initialNumToRender={18} windowSize={7}
        renderItem={({ item }) => <View style={styles.card}>
          <Text style={styles.entryTitle}>{entryLabel(item)}</Text>
          <Text style={styles.dayLabel}>{days[item.dayOfWeek] || "Day " + String(item.dayOfWeek)}</Text>
          <Text style={styles.time}>{item.startTime} – {item.endTime}</Text>
          <Text style={styles.meta}>{item.room ? "Room " + item.room : "Room not assigned"}{item.courseOffering?.faculty ? " · " + [item.courseOffering.faculty.firstName, item.courseOffering.faculty.lastName].filter(Boolean).join(" ") : ""}</Text>
          {canManage ? <View style={styles.actionRow}>
            <Pressable onPress={() => beginEdit(item)} style={styles.secondaryButton}><Text style={styles.secondaryText}>Edit</Text></Pressable>
            <Pressable onPress={() => Alert.alert("Delete timetable entry", "Remove this schedule entry? The backend will validate the action and scope.", [
              { text: "Cancel", style: "cancel" }, { text: "Delete", style: "destructive", onPress: () => remove.mutate(item.id) }
            ])} style={styles.deleteButton}><Text style={styles.deleteText}>Delete</Text></Pressable>
          </View> : null}
        </View>}
        ListEmptyComponent={<View style={styles.state}><Text style={styles.sectionTitle}>No timetable entries</Text><Text style={styles.subtitle}>No entries were returned for the current authenticated scope.</Text></View>} />}
    {error ? <Text accessibilityRole="alert" style={styles.bottomError}>{error instanceof Error ? error.message : "Timetable update failed."}</Text> : null}
  </View>;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.canvas }, header: { backgroundColor: colors.surface, padding: spacing.lg, borderBottomWidth: 1, borderColor: colors.border, gap: 8 },
  title: { color: colors.text, fontSize: 23, fontWeight: "900" }, subtitle: { color: colors.textMuted, fontSize: 12, lineHeight: 18 },
  actionRow: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 8, marginTop: 8 },
  primaryButton: { backgroundColor: colors.primary, borderRadius: radius.md, minHeight: 42, paddingHorizontal: 13, paddingVertical: 11, alignItems: "center", justifyContent: "center" },
  buttonText: { color: colors.white, fontSize: 11, fontWeight: "900" }, secondaryButton: { backgroundColor: colors.primarySoft, borderRadius: radius.md, paddingHorizontal: 12, paddingVertical: 10 },
  secondaryText: { color: colors.primary, fontSize: 11, fontWeight: "800" }, formScroll: { maxHeight: 470, backgroundColor: colors.surface, borderBottomWidth: 1, borderColor: colors.border },
  form: { padding: spacing.lg, gap: 7 }, sectionTitle: { color: colors.text, fontWeight: "900", fontSize: 17 }, label: { color: colors.text, fontSize: 12, fontWeight: "800", marginTop: 8, marginBottom: 5 },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, backgroundColor: colors.surface, color: colors.text, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14 },
  offering: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: 10, marginBottom: 5 }, offeringSelected: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  offeringText: { color: colors.text, fontWeight: "700" }, selected: { color: colors.primary, fontSize: 10, fontWeight: "900", marginTop: 3 },
  days: { flexDirection: "row", flexWrap: "wrap", gap: 5 }, day: { paddingVertical: 8, paddingHorizontal: 10, borderRadius: radius.pill, backgroundColor: colors.surfaceMuted }, daySelected: { backgroundColor: colors.primary },
  dayText: { color: colors.textMuted, fontSize: 10, fontWeight: "800" }, dayTextSelected: { color: colors.white }, timeRow: { flexDirection: "row", gap: 10 }, timeColumn: { flex: 1 },
  helper: { color: colors.textMuted, fontSize: 11, lineHeight: 16 }, error: { color: colors.danger, fontSize: 12, lineHeight: 17, marginTop: 8 },
  list: { padding: spacing.lg, paddingBottom: 30 }, card: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.lg, marginBottom: 10 },
  entryTitle: { color: colors.text, fontSize: 15, fontWeight: "900" }, dayLabel: { color: colors.primary, fontSize: 11, fontWeight: "800", marginTop: 7 },
  time: { color: colors.text, fontSize: 18, fontWeight: "800", marginTop: 4 }, meta: { color: colors.textMuted, fontSize: 11, lineHeight: 16, marginTop: 5 },
  deleteButton: { borderColor: colors.danger, borderWidth: 1, borderRadius: radius.sm, paddingHorizontal: 12, paddingVertical: 8 }, deleteText: { color: colors.danger, fontWeight: "800", fontSize: 11 },
  state: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.xl, gap: 10 }, bottomError: { padding: 9, color: colors.danger, fontSize: 11, backgroundColor: colors.dangerSoft }
});