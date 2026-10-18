import React, { useMemo, useState } from "react";
import { ActivityIndicator, Alert, FlatList, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest, ApiError } from "../api/client";
import { toCollection } from "../api/payload";
import { useAuth } from "../auth/AuthProvider";
import { useWorkspaceContext } from "../workspace/WorkspaceContextProvider";
import { colors, radius, spacing } from "../ui/theme";

type EventType = "HOLIDAY" | "EXAM" | "EVENT" | "DEADLINE" | "ACADEMIC";
type Audience = "ALL" | "STUDENTS" | "FACULTY" | "STAFF";
type CampusEvent = { id: string; title: string; description?: string | null; eventType: EventType; startDate: string; endDate: string; audience: Audience; [key: string]: unknown };
const eventTypes: EventType[] = ["EVENT", "ACADEMIC", "HOLIDAY", "EXAM", "DEADLINE"];
const audiences: Audience[] = ["ALL", "STUDENTS", "FACULTY", "STAFF"];
function rows(value: unknown): CampusEvent[] {
  return toCollection(value).filter((item): item is CampusEvent => typeof item === "object" && item !== null &&
    typeof (item as Record<string, unknown>).id === "string" && typeof (item as Record<string, unknown>).title === "string");
}
function dateInput(value?: string) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.valueOf())) return value.slice(0, 10);
  return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");
}
function dateLabel(value?: string) {
  if (!value) return "—";
  const d = new Date(value);
  return Number.isNaN(d.valueOf()) ? value : d.toLocaleDateString();
}
function parseDateInput(value: string, endOfDay = false): string {
  const time = endOfDay ? "T18:00:00" : "T09:00:00";
  return new Date(value + time).toISOString();
}

export function CalendarScreen() {
  const { user } = useAuth();
  const { context } = useWorkspaceContext();
  const workspaceKey = JSON.stringify(context?.scope ?? {});
  const client = useQueryClient();
  const canManage = Boolean(user?.permissions.includes("calendar.manage"));
  const [queryText, setQueryText] = useState("");
  const [editing, setEditing] = useState<CampusEvent | null>(null);
  const [form, setForm] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [eventType, setEventType] = useState<EventType>("EVENT");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [audience, setAudience] = useState<Audience>("ALL");

  const list = useQuery({
    queryKey: ["calendar-events", user?.id],
    queryFn: () => apiRequest<unknown>("/calendar/events?page=1&pageSize=50"),
    enabled: Boolean(user?.id),
    staleTime: 0
  });
  const events = useMemo(() => {
    const term = queryText.trim().toLowerCase();
    const all = rows(list.data);
    return term ? all.filter((event) => [event.title, event.description || "", event.eventType, event.audience].join(" ").toLowerCase().includes(term)) : all;
  }, [list.data, queryText]);

  function reset() {
    setEditing(null); setForm(false); setTitle(""); setDescription(""); setEventType("EVENT"); setStartDate(""); setEndDate(""); setAudience("ALL");
  }
  function create() {
    setEditing(null); setTitle(""); setDescription(""); setEventType("EVENT"); setStartDate(""); setEndDate(""); setAudience("ALL"); setForm(true);
  }
  function edit(event: CampusEvent) {
    setEditing(event); setTitle(event.title); setDescription(event.description || "");
    setEventType(event.eventType); setStartDate(dateInput(event.startDate)); setEndDate(dateInput(event.endDate)); setAudience(event.audience || "ALL"); setForm(true);
  }
  async function invalidate() {
    await Promise.all([
      client.invalidateQueries({ queryKey: ["calendar-events", user?.id] }),
      client.invalidateQueries({ queryKey: ["my-work", user?.id] }),
      client.invalidateQueries({ queryKey: ["module", user?.id] })
    ]);
  }

  const save = useMutation({
    mutationFn: async () => {
      if (!canManage) throw new Error("Your session does not include calendar.manage.");
      if (title.trim().length < 2 || title.trim().length > 200) throw new Error("Title must contain 2–200 characters.");
      if (description.trim().length > 2000) throw new Error("Description cannot exceed 2,000 characters.");
      const validDate = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(new Date(v + "T12:00:00").valueOf());
      if (!validDate(startDate) || !validDate(endDate)) throw new Error("Enter valid start and end dates in YYYY-MM-DD format.");
      if (endDate < startDate) throw new Error("End date cannot be before start date.");
      const payload = {
        title: title.trim(), description: description.trim() || undefined, eventType,
        startDate: parseDateInput(startDate), endDate: parseDateInput(endDate, true), audience
      };
      return editing
        ? apiRequest<CampusEvent>("/calendar/events/" + encodeURIComponent(editing.id), { method: "PATCH", body: JSON.stringify(payload) })
        : apiRequest<CampusEvent>("/calendar/events", { method: "POST", body: JSON.stringify(payload) });
    },
    onSuccess: async () => { await invalidate(); reset(); }
  });
  const remove = useMutation({
    mutationFn: (id: string) => apiRequest("/calendar/events/" + encodeURIComponent(id), { method: "DELETE" }),
    onSuccess: invalidate
  });
  const error = save.error || remove.error;

  return <View style={styles.root}>
    <View style={styles.header}>
      <Text style={styles.title}>Institution Calendar</Text>
      <Text style={styles.subtitle}>Events are stored in ACADLYX and scoped by the existing calendar service.</Text>
      <TextInput value={queryText} onChangeText={setQueryText} style={styles.input} placeholder="Search loaded events" placeholderTextColor={colors.textMuted} accessibilityLabel="Search calendar events" />
      {canManage ? <Pressable onPress={form ? reset : create} style={styles.primaryButton}><Text style={styles.buttonText}>{form ? "Close editor" : "Create event"}</Text></Pressable> : null}
    </View>
    {form && canManage ? <ScrollView style={styles.formScroll} contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
      <Text style={styles.sectionTitle}>{editing ? "Edit event" : "New event"}</Text>
      <Text style={styles.label}>Title</Text><TextInput value={title} onChangeText={setTitle} maxLength={200} style={styles.input} placeholder="Event title" placeholderTextColor={colors.textMuted} />
      <Text style={styles.label}>Description (optional)</Text><TextInput value={description} onChangeText={setDescription} maxLength={2000} multiline textAlignVertical="top" style={[styles.input, styles.textArea]} placeholder="Event details" placeholderTextColor={colors.textMuted} />
      <Text style={styles.label}>Event type</Text><View style={styles.options}>{eventTypes.map((v) => <Pressable key={v} onPress={() => setEventType(v)} style={[styles.option, eventType === v ? styles.optionSelected : null]}><Text style={[styles.optionText, eventType === v ? styles.optionTextSelected : null]}>{v}</Text></Pressable>)}</View>
      <Text style={styles.label}>Audience</Text><View style={styles.options}>{audiences.map((v) => <Pressable key={v} onPress={() => setAudience(v)} style={[styles.option, audience === v ? styles.optionSelected : null]}><Text style={[styles.optionText, audience === v ? styles.optionTextSelected : null]}>{v}</Text></Pressable>)}</View>
      <Text style={styles.label}>Start date (YYYY-MM-DD)</Text><TextInput value={startDate} onChangeText={setStartDate} maxLength={10} style={styles.input} placeholder="2026-11-15" placeholderTextColor={colors.textMuted} />
      <Text style={styles.label}>End date (YYYY-MM-DD)</Text><TextInput value={endDate} onChangeText={setEndDate} maxLength={10} style={styles.input} placeholder="2026-11-15" placeholderTextColor={colors.textMuted} />
      <Text style={styles.helper}>This first native editor uses institution-level audience categories. Academic-year targeting requires a scoped selector and is not guessed.</Text>
      {save.isError ? <Text accessibilityRole="alert" style={styles.error}>{save.error instanceof ApiError ? save.error.message : save.error instanceof Error ? save.error.message : "The event could not be saved."}</Text> : null}
      <Pressable disabled={save.isPending} onPress={() => save.mutate()} style={styles.primaryButton}>{save.isPending ? <ActivityIndicator color={colors.white} /> : <Text style={styles.buttonText}>{editing ? "Save changes" : "Create event"}</Text>}</Pressable>
    </ScrollView> : null}
    {list.isLoading ? <View style={styles.state}><ActivityIndicator color={colors.primary} /><Text style={styles.subtitle}>Loading events…</Text></View> :
      list.isError ? <View style={styles.state}><Text style={styles.sectionTitle}>Calendar unavailable</Text><Text style={styles.subtitle}>{list.error instanceof Error ? list.error.message : "Try again."}</Text><Pressable onPress={() => { void list.refetch(); }} style={styles.primaryButton}><Text style={styles.buttonText}>Retry</Text></Pressable></View> :
      <FlatList data={events} keyExtractor={(event) => event.id} contentContainerStyle={styles.list} initialNumToRender={15} windowSize={7}
        renderItem={({ item }) => <View style={styles.card}>
          <View style={styles.cardTop}><Text style={styles.eventTitle}>{item.title}</Text><Text style={styles.typePill}>{item.eventType}</Text></View>
          <Text style={styles.date}>{dateLabel(item.startDate)}{dateInput(item.startDate) === dateInput(item.endDate) ? "" : " – " + dateLabel(item.endDate)}</Text>
          <Text style={styles.meta}>Audience: {item.audience}</Text>
          {item.description ? <Text style={styles.description}>{item.description}</Text> : null}
          {canManage ? <View style={styles.actions}><Pressable onPress={() => edit(item)} style={styles.secondaryButton}><Text style={styles.secondaryText}>Edit</Text></Pressable>
            <Pressable onPress={() => Alert.alert("Delete event", "Delete this calendar event from ACADLYX?", [
              { text: "Cancel", style: "cancel" }, { text: "Delete", style: "destructive", onPress: () => remove.mutate(item.id) }
            ])} style={styles.deleteButton}><Text style={styles.deleteText}>Delete</Text></Pressable></View> : null}
        </View>}
        ListEmptyComponent={<View style={styles.state}><Text style={styles.sectionTitle}>No matching events</Text><Text style={styles.subtitle}>No events were returned for this account and filter.</Text></View>} />}
    {error ? <View style={styles.errorBanner}><Text style={styles.error}>{error instanceof Error ? error.message : "The calendar action failed."}</Text></View> : null}
  </View>;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.canvas }, header: { padding: spacing.lg, backgroundColor: colors.surface, borderBottomWidth: 1, borderColor: colors.border, gap: 8 },
  title: { color: colors.text, fontSize: 23, fontWeight: "900" }, subtitle: { color: colors.textMuted, fontSize: 12, lineHeight: 18 },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, backgroundColor: colors.surface, color: colors.text, paddingHorizontal: 12, paddingVertical: 10, fontSize: 13 },
  primaryButton: { borderRadius: radius.md, backgroundColor: colors.primary, minHeight: 42, paddingHorizontal: 14, paddingVertical: 10, alignItems: "center", justifyContent: "center" }, buttonText: { color: colors.white, fontSize: 12, fontWeight: "900" },
  formScroll: { maxHeight: 480, borderBottomWidth: 1, borderColor: colors.border, backgroundColor: colors.surface }, form: { padding: spacing.lg, gap: 8 }, sectionTitle: { color: colors.text, fontWeight: "900", fontSize: 17 },
  label: { color: colors.text, fontWeight: "800", fontSize: 12, marginTop: 7, marginBottom: 2 }, textArea: { minHeight: 95 },
  options: { flexDirection: "row", flexWrap: "wrap", gap: 6 }, option: { paddingHorizontal: 10, paddingVertical: 8, borderRadius: radius.pill, backgroundColor: colors.surfaceMuted },
  optionSelected: { backgroundColor: colors.primary }, optionText: { color: colors.textMuted, fontSize: 10, fontWeight: "800" }, optionTextSelected: { color: colors.white },
  helper: { color: colors.textMuted, fontSize: 11, lineHeight: 16 }, error: { color: colors.danger, fontSize: 12, lineHeight: 17 },
  list: { padding: spacing.lg, paddingBottom: 30 }, card: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.lg, marginBottom: 10, gap: 6 },
  cardTop: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }, eventTitle: { flex: 1, color: colors.text, fontSize: 15, fontWeight: "900" },
  typePill: { color: colors.primary, backgroundColor: colors.primarySoft, paddingHorizontal: 8, paddingVertical: 4, borderRadius: radius.pill, fontSize: 9, fontWeight: "900" },
  date: { color: colors.primary, fontWeight: "800", fontSize: 12 }, meta: { color: colors.textMuted, fontSize: 10 },
  description: { color: colors.text, fontSize: 13, lineHeight: 19 }, actions: { flexDirection: "row", gap: 8, marginTop: 5 },
  secondaryButton: { backgroundColor: colors.primarySoft, borderRadius: radius.sm, paddingHorizontal: 13, paddingVertical: 8 },
  secondaryText: { color: colors.primary, fontWeight: "800", fontSize: 11 }, deleteButton: { borderWidth: 1, borderColor: colors.danger, borderRadius: radius.sm, paddingHorizontal: 13, paddingVertical: 8 },
  deleteText: { color: colors.danger, fontSize: 11, fontWeight: "800" }, state: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.xl, gap: 10 },
  errorBanner: { padding: 10, backgroundColor: colors.dangerSoft, borderTopWidth: 1, borderColor: colors.border }
});