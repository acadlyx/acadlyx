import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest, ApiError } from "../api/client";
import { toCollection } from "../api/payload";
import { useAuth } from "../auth/AuthProvider";
import { useWorkspaceContext } from "../workspace/WorkspaceContextProvider";
import { colors, radius, spacing } from "../ui/theme";

type RecordValue = Record<string, unknown>;
type Draft = { marks: string; absent: boolean; remarks: string };
type Row = { studentId: string; firstName: string; lastName: string; marksObtained: number | null; isAbsent: boolean; status: string; remarks: string; examAttendance: string };

function obj(value: unknown): RecordValue {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? value as RecordValue : {};
}
function value(record: RecordValue, key: string): string {
  return record[key] === null || record[key] === undefined ? "" : String(record[key]);
}
function dateValue(date: unknown): string {
  if (typeof date !== "string" || !date) return "—";
  const parsed = new Date(date);
  return Number.isNaN(parsed.getTime()) ? date : parsed.toLocaleDateString();
}
function stateStyle(state: string) {
  if (["APPROVED", "PUBLISHED", "LOCKED", "RESULTS_PUBLISHED", "COMPLETED"].includes(state)) return styles.good;
  if (["CANCELLED", "REJECTED"].includes(state)) return styles.bad;
  return styles.pending;
}
function label(record: RecordValue, fallback: string): string {
  return value(record, "name") || value(record, "title") || value(record, "courseName") || value(record, "courseCode") || fallback;
}

export function ExaminationsScreen() {
  const { user } = useAuth();
  const { context } = useWorkspaceContext();
  const workspaceKey = JSON.stringify(context?.scope ?? {});
  const client = useQueryClient();
  const permissions = user?.permissions ?? [];
  const has = (...names: string[]) => names.some(name => permissions.includes(name));
  const effectiveRole = useMemo(() => {
    const priority = ["CHAIRMAN","DIRECTOR","DEAN","HOD","FACULTY","STUDENT","PARENT","PLACEMENT","SUPER_ADMIN","INSTITUTION_ADMIN","MANAGEMENT","REGISTRAR","ACCOUNTS","HR","ADMISSIONS","EXAMINATION","LIBRARIAN","IT","CMS","CLUB_PRESIDENT"];
    return priority.find(role => user?.roles.includes(role)) || "";
  }, [user?.roles.join("|")]);
  const portalOnly = effectiveRole === "STUDENT" || effectiveRole === "PARENT";
  const canReadMarks = has("marks.read") && !portalOnly;
  const canEnterMarks = has("marks.enter") && !portalOnly;
  const canApprove = has("exams.approve") && !portalOnly;

  const [sessionId, setSessionId] = useState<string | null>(null);
  const [scheduleId, setScheduleId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [jobId, setJobId] = useState<string | null>(null);

  const sessionsQuery = useQuery({
    queryKey: ["examinations", user?.id, workspaceKey, "sessions"],
    queryFn: () => apiRequest<unknown>("/examinations/sessions?page=1&pageSize=30"),
    enabled: Boolean(user?.id && has("exams.read")),
    staleTime: 0
  });
  const sessionQuery = useQuery({
    queryKey: ["examinations", user?.id, workspaceKey, "session", sessionId],
    queryFn: () => apiRequest<unknown>("/examinations/sessions/" + encodeURIComponent(sessionId || "")),
    enabled: Boolean(user?.id && sessionId),
    staleTime: 0
  });
  const marksQuery = useQuery({
    queryKey: ["examinations", user?.id, workspaceKey, "marks", scheduleId],
    queryFn: () => apiRequest<unknown>("/examinations/schedules/" + encodeURIComponent(scheduleId || "") + "/marks"),
    enabled: Boolean(user?.id && scheduleId && canReadMarks),
    staleTime: 0
  });
  const jobQuery = useQuery({
    queryKey: ["examinations", user?.id, workspaceKey, "publication-job", jobId],
    queryFn: () => apiRequest<unknown>("/examinations/jobs/" + encodeURIComponent(jobId || "")),
    enabled: Boolean(user?.id && jobId && has("exams.read")),
    staleTime: 0
  });

  const sessions = useMemo(() => toCollection(sessionsQuery.data).map(obj).filter(item => typeof item.id === "string"), [sessionsQuery.data]);
  const session = obj(sessionQuery.data);
  const schedules = Array.isArray(session.schedules) ? session.schedules.map(obj) : [];
  const sheet = obj(marksQuery.data);
  const sheetRows = useMemo<Row[]>(() => {
    if (!Array.isArray(sheet.rows)) return [];
    return sheet.rows.map(raw => {
      const row = obj(raw);
      return {
        studentId: value(row, "studentId"),
        firstName: value(row, "firstName"),
        lastName: value(row, "lastName"),
        marksObtained: typeof row.marksObtained === "number" ? row.marksObtained : null,
        isAbsent: row.isAbsent === true,
        status: value(row, "status") || "DRAFT",
        remarks: value(row, "remarks"),
        examAttendance: value(row, "examAttendance")
      };
    }).filter(row => Boolean(row.studentId));
  }, [marksQuery.data]);

  useEffect(() => {
    if (!marksQuery.data) return;
    const next: Record<string, Draft> = {};
    sheetRows.forEach(row => { next[row.studentId] = { marks: row.marksObtained === null ? "" : String(row.marksObtained), absent: row.isAbsent, remarks: row.remarks }; });
    setDrafts(next);
  }, [marksQuery.data]);

  const refreshExam = async () => {
    await Promise.all([
      client.invalidateQueries({ queryKey: ["examinations", user?.id] }),
      client.invalidateQueries({ queryKey: ["examinations", user?.id] }),
      client.invalidateQueries({ queryKey: ["examinations", user?.id] }),
      client.invalidateQueries({ queryKey: ["my-work", user?.id] })
    ]);
  };

  const save = useMutation({
    mutationFn: async ({ submit }: { submit: boolean }) => {
      if (!scheduleId || !sheetRows.length) throw new Error("No eligible marks rows are available for this schedule.");
      const entries: Array<{studentId:string;marksObtained?:number|null;isAbsent?:boolean;remarks?:string}> = [];
      const maxMarks = Number(obj(sheet.schedule).maxMarks);
      for (const row of sheetRows) {
        const draft = drafts[row.studentId] || { marks: "", absent: false, remarks: "" };
        const rawMarks = draft.marks.trim();
        if (draft.absent) {
          entries.push({ studentId: row.studentId, marksObtained: null, isAbsent: true, ...(draft.remarks.trim() ? { remarks: draft.remarks.trim() } : {}) });
        } else if (rawMarks) {
          const marks = Number(rawMarks);
          if (!Number.isFinite(marks) || marks < 0 || marks > maxMarks) throw new Error("Marks must be a valid number from 0 to " + String(maxMarks) + ".");
          entries.push({ studentId: row.studentId, marksObtained: marks, isAbsent: false, ...(draft.remarks.trim() ? { remarks: draft.remarks.trim() } : {}) });
        } else if (submit) {
          throw new Error("Enter marks or mark every candidate absent before submission.");
        }
      }
      if (!entries.length) throw new Error("Enter at least one mark before saving a draft.");
      if (submit && entries.length !== sheetRows.length) throw new Error("Every eligible candidate needs marks or an absent status.");
      return apiRequest<unknown>("/examinations/schedules/" + encodeURIComponent(scheduleId) + "/marks", {
        method: "PUT", body: JSON.stringify({ submit, entries })
      });
    },
    onSuccess: async () => { await refreshExam(); await marksQuery.refetch(); await sessionQuery.refetch(); }
  });

  const transition = useMutation({
    mutationFn: ({ action }: { action: "approve" | "lock" | "publish" }) => {
      if (!scheduleId) throw new Error("Select a schedule first.");
      const suffix = action === "approve" ? "/marks/approve" : action === "lock" ? "/lock" : "/publish";
      return apiRequest<unknown>("/examinations/schedules/" + encodeURIComponent(scheduleId) + suffix, { method: "POST" });
    },
    onSuccess: async (result, input) => {
      if (input.action === "publish" && typeof obj(result).jobId === "string") setJobId(value(obj(result), "jobId"));
      await refreshExam();
      await marksQuery.refetch();
      await sessionQuery.refetch();
    }
  });

  const updateDraft = (id: string, patch: Partial<Draft>) => setDrafts(current => ({
    ...current,
    [id]: { ...(current[id] || { marks: "", absent: false, remarks: "" }), ...patch }
  }));
  const askTransition = (action: "approve" | "lock" | "publish") => {
    const copy = action === "approve" ? ["Approve submitted marks?", "The backend enforces approval scope and maker-checker rules."]
      : action === "lock" ? ["Lock approved marks?", "The backend requires every eligible candidate to have an approved mark."]
      : ["Publish examination results?", "The backend queues publication only for a locked schedule with approved marks."];
    Alert.alert(copy[0], copy[1], [
      { text: "Cancel", style: "cancel" },
      { text: action === "approve" ? "Approve" : action === "lock" ? "Lock" : "Publish", onPress: () => transition.mutate({ action }) }
    ]);
  };
  const activeSchedule = obj(sheet.schedule);
  const scheduleStatus = value(activeSchedule, "status").toUpperCase();
  const isEditable = canEnterMarks && !["LOCKED", "RESULTS_PUBLISHED", "CANCELLED"].includes(scheduleStatus);
  const hasSubmitted = sheetRows.some(row => row.status === "SUBMITTED");
  const allApproved = sheetRows.length > 0 && sheetRows.every(row => row.status === "APPROVED");
  const error = save.isError ? save.error : transition.isError ? transition.error : null;

  return <View style={styles.root}>
    <View style={styles.header}>
      <Text style={styles.eyebrow}>ACADEMIC ASSESSMENT</Text>
      <Text style={styles.title}>Examinations & results</Text>
      <Text style={styles.subtitle}>Live scoped examination sessions. Student/parent self-results remain in their dedicated portal and do not open staff roster marksheets.</Text>
      {sessionId ? <Pressable accessibilityRole="button" onPress={() => {
        if (scheduleId) { setScheduleId(null); setJobId(null); setDrafts({}); }
        else { setSessionId(null); setJobId(null); setDrafts({}); }
      }}><Text style={styles.back}>{scheduleId ? "‹ Back to schedules" : "‹ All examination sessions"}</Text></Pressable> : null}
    </View>

    {!sessionId ? (sessionsQuery.isLoading ? <Loading label="examination sessions" /> : sessionsQuery.isError ? <RetryState error={sessionsQuery.error} retry={() => { void sessionsQuery.refetch(); }} /> : <FlatList
      data={sessions} keyExtractor={item => value(item,"id")} contentContainerStyle={styles.list}
      refreshControl={<RefreshControl refreshing={sessionsQuery.isRefetching} onRefresh={() => { void sessionsQuery.refetch(); }} tintColor={colors.primary} />}
      renderItem={({item}) => <Pressable accessibilityRole="button" style={styles.card} onPress={() => { setSessionId(value(item,"id")); setScheduleId(null); setJobId(null); }}>
        <View style={styles.cardTop}><Text style={styles.cardTitle}>{label(item,"Examination session")}</Text><Text style={[styles.status,stateStyle(value(item,"status"))]}>{value(item,"status").replace(/_/g," ") || "UNKNOWN"}</Text></View>
        <Text style={styles.detail}>Code: {value(item,"code") || "—"} · Type: {value(item,"examType").replace(/_/g," ") || "—"}</Text>
        <Text style={styles.detail}>Start: {dateValue(item.startDate)} · End: {dateValue(item.endDate)}</Text>
        <Text style={styles.link}>Open session →</Text>
      </Pressable>}
      ListEmptyComponent={<Empty title="No examination sessions" detail="No sessions were returned for the current authorized workspace." />}
      initialNumToRender={12} windowSize={7}
    />) : !scheduleId ? (sessionQuery.isLoading ? <Loading label="session schedules" /> : sessionQuery.isError ? <RetryState error={sessionQuery.error} retry={() => { void sessionQuery.refetch(); }} /> : <FlatList
      data={schedules} keyExtractor={(item,index) => value(item,"id") || "schedule-"+index} contentContainerStyle={styles.list}
      refreshControl={<RefreshControl refreshing={sessionQuery.isRefetching} onRefresh={() => { void sessionQuery.refetch(); }} tintColor={colors.primary} />}
      ListHeaderComponent={<View style={styles.summary}><Text style={styles.cardTitle}>{label(session,"Examination session")}</Text><Text style={styles.detail}>Session status: {value(session,"status").replace(/_/g," ") || "—"}</Text><Text style={styles.detail}>Schedules are filtered by your authorized academic scope.</Text></View>}
      renderItem={({item}) => <Pressable accessibilityRole="button" style={styles.card} onPress={() => { setScheduleId(value(item,"id")); setJobId(null); }}>
        <View style={styles.cardTop}><Text style={styles.cardTitle}>{label(item,"Scheduled examination")}</Text><Text style={[styles.status,stateStyle(value(item,"status"))]}>{value(item,"status").replace(/_/g," ") || "UNKNOWN"}</Text></View>
        <Text style={styles.detail}>Date: {dateValue(item.examDate)} · {value(item,"startTime") || "—"}–{value(item,"endTime") || "—"}</Text>
        <Text style={styles.detail}>Maximum marks: {value(item,"maxMarks") || "—"} · Room: {value(item,"roomName") || "Not assigned"}</Text>
        <Text style={styles.link}>{canReadMarks ? "Open marksheet →" : "View schedule details →"}</Text>
      </Pressable>}
      ListEmptyComponent={<Empty title="No schedules found" detail="This session has no schedules visible in your current scope." />}
      initialNumToRender={12} windowSize={7}
    />) : !canReadMarks ? <View style={styles.content}><Empty title="Staff marksheet unavailable" detail="Use the student/parent self-results portal to view individual results." /></View>
    : marksQuery.isLoading ? <Loading label="marksheet" /> : marksQuery.isError ? <RetryState error={marksQuery.error} retry={() => { void marksQuery.refetch(); }} /> : <ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={marksQuery.isRefetching} onRefresh={() => { void marksQuery.refetch(); }} tintColor={colors.primary} />}>
      <View style={styles.summary}><Text style={styles.cardTitle}>{label(activeSchedule,"Marks sheet")}</Text><Text style={styles.detail}>Status: {scheduleStatus.replace(/_/g," ") || "—"} · Maximum marks: {value(activeSchedule,"maxMarks") || "—"}</Text><Text style={styles.detail}>{sheetRows.length} eligible candidate(s).</Text></View>
      {sheetRows.map(row => {
        const draft = drafts[row.studentId] || { marks: "", absent: false, remarks: "" };
        return <View key={row.studentId} style={styles.card}>
          <View style={styles.cardTop}><Text style={styles.cardTitle}>{[row.firstName,row.lastName].filter(Boolean).join(" ") || "Student"}</Text><Text style={[styles.status,stateStyle(row.status)]}>{row.status.replace(/_/g," ")}</Text></View>
          <Text style={styles.detail}>Attendance: {row.examAttendance || "Not recorded"}</Text>
          {isEditable ? <>
            <TextInput accessibilityLabel="Marks obtained" value={draft.marks} onChangeText={raw => updateDraft(row.studentId,{marks:raw})} keyboardType="decimal-pad" placeholder={"Marks out of "+value(activeSchedule,"maxMarks")} placeholderTextColor={colors.textMuted} style={styles.input} />
            <TextInput accessibilityLabel="Mark remarks" value={draft.remarks} onChangeText={raw => updateDraft(row.studentId,{remarks:raw})} placeholder="Optional remarks" placeholderTextColor={colors.textMuted} style={styles.input} />
            <Pressable accessibilityRole="checkbox" accessibilityState={{checked:draft.absent}} onPress={() => updateDraft(row.studentId,{absent:!draft.absent})} style={styles.absentRow}><View style={[styles.checkbox,draft.absent?styles.checked:null]} /><Text style={styles.detail}>Mark absent</Text></Pressable>
          </> : <Text style={styles.detail}>Marks: {row.isAbsent ? "Absent" : row.marksObtained === null ? "—" : String(row.marksObtained)}</Text>}
        </View>;
      })}
      {!sheetRows.length ? <Empty title="No eligible marks rows" detail="No eligible candidate rows were returned for this schedule." /> : null}
      {isEditable && sheetRows.length ? <View style={styles.card}><View style={styles.actions}>
        <Button label={save.isPending ? "Saving…" : "Save draft"} disabled={save.isPending || transition.isPending} onPress={() => save.mutate({submit:false})} />
        <Button label="Submit marks for approval" disabled={save.isPending || transition.isPending} onPress={() => Alert.alert("Submit marks?", "Every candidate requires marks or an absent status.", [{text:"Cancel",style:"cancel"},{text:"Submit",onPress:() => save.mutate({submit:true})}])} />
      </View></View> : null}
      {canApprove && hasSubmitted ? <View style={styles.card}><Button label="Approve submitted marks" disabled={transition.isPending || save.isPending} onPress={() => askTransition("approve")} /></View> : null}
      {canApprove && allApproved && !["LOCKED","RESULTS_PUBLISHED","CANCELLED"].includes(scheduleStatus) ? <View style={styles.card}><Button label="Lock approved marks" disabled={transition.isPending || save.isPending} onPress={() => askTransition("lock")} /></View> : null}
      {canApprove && scheduleStatus === "LOCKED" ? <View style={styles.card}><Button label="Queue result publication" disabled={transition.isPending || save.isPending} onPress={() => askTransition("publish")} /></View> : null}
      {jobId ? <View style={styles.card}><Text style={styles.cardTitle}>Publication job</Text><Text style={styles.detail}>Job: {jobId}</Text>{jobQuery.isLoading ? <Text style={styles.detail}>Loading job status…</Text> : jobQuery.isError ? <Text style={styles.error}>{jobQuery.error instanceof Error ? jobQuery.error.message : "Could not load job."}</Text> : <Text style={styles.detail}>Status: {value(obj(jobQuery.data),"status") || "—"} · Progress: {value(obj(jobQuery.data),"progress") || "—"} / {value(obj(jobQuery.data),"total") || "—"}</Text>}<Button label="Refresh job status" secondary onPress={() => { void jobQuery.refetch(); void marksQuery.refetch(); void sessionQuery.refetch(); }} /></View> : null}
      {save.isSuccess || transition.isSuccess ? <Text style={styles.success}>The server accepted the action; refresh the schedule to confirm final state.</Text> : null}
      {error ? <Text style={styles.error}>{error instanceof Error ? error.message : "The workflow failed."}</Text> : null}
    </ScrollView>}

    <View style={styles.footer}><Text style={styles.footerText}>Backend permissions, academic scope, candidate eligibility, maker-checker and state transitions are authoritative. Student/parent accounts do not receive the staff roster marksheet.</Text></View>
  </View>;
}

function Loading({label}:{label:string}) {
  return <View style={styles.state}><ActivityIndicator color={colors.primary} size="large" /><Text style={styles.muted}>Loading {label}…</Text></View>;
}
function Empty({title,detail}:{title:string;detail:string}) {
  return <View style={styles.empty}><Text style={styles.cardTitle}>{title}</Text><Text style={styles.muted}>{detail}</Text></View>;
}
function RetryState({error,retry}:{error:unknown;retry:()=>void}) {
  return <View style={styles.state}><Text style={styles.cardTitle}>Could not load examinations</Text><Text style={styles.muted}>{error instanceof ApiError?error.message:error instanceof Error?error.message:"The request failed."}</Text>{error instanceof ApiError && error.requestId?<Text style={styles.muted}>Request reference: {error.requestId}</Text>:null}<Button label="Retry" onPress={retry} /></View>;
}
function Button({label,onPress,disabled,secondary}:{label:string;onPress:()=>void;disabled?:boolean;secondary?:boolean}) {
  return <Pressable accessibilityRole="button" accessibilityLabel={label} disabled={disabled} onPress={onPress} style={[styles.button,secondary?styles.secondaryButton:null,disabled?styles.disabled:null]}><Text style={[styles.buttonText,secondary?styles.secondaryButtonText:null]}>{label}</Text></Pressable>;
}
const styles = StyleSheet.create({
  root:{flex:1,backgroundColor:colors.canvas},header:{padding:spacing.lg,gap:7,backgroundColor:colors.surface,borderBottomWidth:1,borderColor:colors.border},
  eyebrow:{fontSize:10,fontWeight:"900",letterSpacing:1,color:colors.primary},title:{fontSize:23,fontWeight:"900",color:colors.text},subtitle:{fontSize:12,lineHeight:18,color:colors.textMuted},back:{fontSize:12,fontWeight:"900",color:colors.primary,paddingVertical:5},
  list:{padding:spacing.lg,paddingBottom:28},content:{padding:spacing.lg,paddingBottom:32,gap:9},card:{backgroundColor:colors.surface,borderWidth:1,borderColor:colors.border,borderRadius:radius.md,padding:spacing.md,marginBottom:9},
  summary:{backgroundColor:colors.surface,borderWidth:1,borderColor:colors.border,borderRadius:radius.md,padding:spacing.lg,marginBottom:3},cardTop:{flexDirection:"row",justifyContent:"space-between",alignItems:"flex-start",gap:9},cardTitle:{flex:1,fontSize:15,fontWeight:"900",color:colors.text},
  detail:{fontSize:12,lineHeight:18,color:colors.textMuted,marginTop:5},link:{color:colors.primary,fontSize:12,fontWeight:"900",marginTop:10},status:{fontSize:10,fontWeight:"900",textTransform:"uppercase",paddingHorizontal:8,paddingVertical:5,borderRadius:radius.pill,overflow:"hidden"},
  good:{backgroundColor:colors.primarySoft,color:colors.primary},pending:{backgroundColor:colors.surfaceMuted,color:colors.warning},bad:{backgroundColor:colors.dangerSoft,color:colors.danger},input:{backgroundColor:colors.surface,color:colors.text,borderWidth:1,borderColor:colors.border,borderRadius:radius.sm,paddingHorizontal:11,paddingVertical:9,fontSize:13,marginTop:8},
  absentRow:{flexDirection:"row",alignItems:"center",gap:8,marginTop:8},checkbox:{width:18,height:18,borderRadius:4,borderWidth:1,borderColor:colors.border,backgroundColor:colors.surface},checked:{backgroundColor:colors.primary,borderColor:colors.primary},actions:{gap:7},button:{alignSelf:"flex-start",backgroundColor:colors.primary,borderRadius:radius.sm,paddingHorizontal:13,paddingVertical:10,marginTop:8},buttonText:{fontSize:11,fontWeight:"900",color:colors.white},
  secondaryButton:{backgroundColor:colors.surfaceMuted,borderWidth:1,borderColor:colors.border},secondaryButtonText:{color:colors.text},disabled:{opacity:.5},state:{flex:1,justifyContent:"center",alignItems:"center",padding:spacing.xl,gap:10},empty:{alignItems:"center",gap:8,padding:spacing.xl,backgroundColor:colors.surface,borderWidth:1,borderColor:colors.border,borderRadius:radius.md},muted:{fontSize:12,lineHeight:18,color:colors.textMuted,textAlign:"center"},
  footer:{padding:spacing.md,borderTopWidth:1,borderColor:colors.border,backgroundColor:colors.surface},footerText:{fontSize:10,lineHeight:15,textAlign:"center",color:colors.textMuted},error:{fontSize:12,lineHeight:18,color:colors.danger,marginTop:9},success:{fontSize:11,color:colors.success,marginTop:9}
});