import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest, ApiError } from "../api/client";
import { toCollection } from "../api/payload";
import { useAuth } from "../auth/AuthProvider";
import { colors, radius, spacing } from "../ui/theme";

type Entry = Record<string, unknown>;
type StudentRow = { studentId: string; firstName: string; lastName: string; rollNumber: string };
function obj(v: unknown): Entry { return typeof v === "object" && v !== null && !Array.isArray(v) ? v as Entry : {}; }
function field(v: Entry, key: string): string { return v[key] === null || v[key] === undefined ? "" : String(v[key]); }
function courseLabel(v: Entry): string {
  const course = obj(v.course), section = obj(v.section), semester = obj(v.semester);
  return [field(course,"code") || field(course,"name") || "Course", field(section,"name") ? "Section " + field(section,"name") : "", field(semester,"name") || field(semester,"number") ? "Semester " + (field(semester,"name") || field(semester,"number")) : ""].filter(Boolean).join(" · ");
}
function studentLabel(v: unknown): string {
  const s = obj(v);
  return [s.firstName,s.lastName].filter(x => typeof x === "string" && x.trim()).join(" ") || "Student";
}

export function InternalMarksScreen() {
  const { user } = useAuth();
  const client = useQueryClient();
  const permissions = user?.permissions ?? [];
  const has = (...p: string[]) => p.some(x => permissions.includes(x));
  const roleOrder = ["CHAIRMAN","DIRECTOR","DEAN","HOD","FACULTY","STUDENT","PARENT","PLACEMENT","SUPER_ADMIN","INSTITUTION_ADMIN","MANAGEMENT","REGISTRAR","ACCOUNTS","HR","ADMISSIONS","EXAMINATION","LIBRARIAN","IT","CMS","CLUB_PRESIDENT"];
  const role = roleOrder.find(r => user?.roles.includes(r)) || "";
  const isFaculty = role === "FACULTY";
  const canRead = has("marks.read");
  const canEnter = isFaculty && has("marks.enter") && has("students.read") && has("course-offerings.read");

  const [selectedOfferingId, setSelectedOfferingId] = useState<string | null>(null);
  const [component, setComponent] = useState("Internal 1");
  const [activeComponent, setActiveComponent] = useState("Internal 1");
  const [maxMarks, setMaxMarks] = useState("50");
  const [marks, setMarks] = useState<Record<string,string>>({});
  const [errorMessage, setErrorMessage] = useState("");

  const offeringsQuery = useQuery({
    queryKey: ["internal-marks",user?.id,"assigned-offerings"],
    queryFn: () => apiRequest<unknown>("/faculty/me/course-offerings"),
    enabled: Boolean(user?.id && isFaculty && canRead),
    staleTime: 0
  });
  const rosterQuery = useQuery({
    queryKey: ["internal-marks",user?.id,"roster",selectedOfferingId],
    queryFn: () => apiRequest<unknown>("/course-offerings/"+encodeURIComponent(selectedOfferingId || "")+"/roster"),
    enabled: Boolean(user?.id && isFaculty && selectedOfferingId && has("students.read")),
    staleTime: 0
  });
  const marksQuery = useQuery({
    queryKey: ["internal-marks",user?.id,"offering",selectedOfferingId,"component",activeComponent],
    queryFn: () => apiRequest<unknown>("/internal-marks?courseOfferingId="+encodeURIComponent(selectedOfferingId || "")+"&component="+encodeURIComponent(activeComponent)+"&page=1&pageSize=100"),
    enabled: Boolean(user?.id && isFaculty && canRead && selectedOfferingId && activeComponent.trim()),
    staleTime: 0
  });
  const readQuery = useQuery({
    queryKey: ["internal-marks",user?.id,"scoped-read"],
    queryFn: () => apiRequest<unknown>("/internal-marks?page=1&pageSize=100"),
    enabled: Boolean(user?.id && canRead && !isFaculty),
    staleTime: 0
  });

  const offerings = useMemo(() => toCollection(offeringsQuery.data).map(obj).filter(x => typeof x.id === "string"), [offeringsQuery.data]);
  const roster = useMemo<StudentRow[]>(() => toCollection(rosterQuery.data).map(obj).filter(x => typeof x.studentId === "string").map(x => ({
    studentId: field(x,"studentId"), firstName: field(x,"firstName"), lastName: field(x,"lastName"), rollNumber: field(x,"rollNumber")
  })), [rosterQuery.data]);
  const existingMarks = useMemo(() => toCollection(marksQuery.data).map(obj).filter(x => typeof x.id === "string"), [marksQuery.data]);
  const readRecords = useMemo(() => toCollection(readQuery.data).map(obj), [readQuery.data]);
  const selectedOffering = offerings.find(x => field(x,"id") === selectedOfferingId) || null;

  useEffect(() => {
    if (!marksQuery.data) return;
    const next: Record<string,string> = {};
    for (const entry of existingMarks) {
      const studentId = field(obj(entry.student),"id");
      if (studentId && entry.marksObtained !== null && entry.marksObtained !== undefined) next[studentId] = String(entry.marksObtained);
    }
    setMarks(next);
    const existing = existingMarks.find(x => x.maxMarks !== undefined && x.maxMarks !== null);
    if (existing) setMaxMarks(field(existing,"maxMarks"));
    setErrorMessage("");
  }, [marksQuery.data]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!canEnter || !selectedOfferingId) throw new Error("Internal-mark entry is available only for your authorized teaching assignment.");
      const maximum = Number(maxMarks);
      if (!Number.isFinite(maximum) || maximum <= 0 || maximum > 1000) throw new Error("Maximum marks must be greater than 0 and at most 1000.");
      if (!activeComponent.trim() || activeComponent.trim().length > 100) throw new Error("Component must contain 1–100 characters.");
      const records: Array<{studentId:string;marksObtained:number}> = [];
      for (const student of roster) {
        const raw = (marks[student.studentId] || "").trim();
        if (!raw) continue;
        const score = Number(raw);
        if (!Number.isFinite(score) || score < 0 || score > maximum) throw new Error("Marks for "+studentLabel({firstName:student.firstName,lastName:student.lastName})+" must be between 0 and "+String(maximum)+".");
        records.push({studentId:student.studentId,marksObtained:score});
      }
      if (!records.length) throw new Error("Enter at least one mark before saving.");
      return apiRequest<unknown>("/internal-marks", {
        method:"POST",
        body:JSON.stringify({courseOfferingId:selectedOfferingId,component:activeComponent.trim(),maxMarks:maximum,records})
      });
    },
    onSuccess: async () => {
      setErrorMessage("");
      await client.invalidateQueries({queryKey:["internal-marks",user?.id]});
      await marksQuery.refetch();
    }
  });

  const selectedCourse = (v: Entry) => {
    setSelectedOfferingId(field(v,"id"));
    setMarks({});
    setErrorMessage("");
  };
  const back = () => { setSelectedOfferingId(null); setMarks({}); setErrorMessage(""); };
  const loadError = isFaculty
    ? offeringsQuery.isError ? offeringsQuery.error : rosterQuery.isError ? rosterQuery.error : marksQuery.isError ? marksQuery.error : null
    : readQuery.isError ? readQuery.error : null;

  return <View style={styles.root}>
    <View style={styles.header}>
      <Text style={styles.eyebrow}>ACADEMIC ASSESSMENT</Text>
      <Text style={styles.title}>Internal marks</Text>
      <Text style={styles.subtitle}>Real marks and assigned rosters from ACADLYX APIs. The backend enforces course ownership, tenant scope, enrollment and mark limits.</Text>
      {selectedOffering ? <Pressable accessibilityRole="button" onPress={back}><Text style={styles.back}>‹ My assigned courses</Text></Pressable> : null}
    </View>

    {!canRead ? <View style={styles.state}><Text style={styles.cardTitle}>Marks access is not granted</Text><Text style={styles.muted}>Your session does not include marks.read.</Text></View>
    : isFaculty ? !selectedOfferingId ? offeringsQuery.isLoading ? <Loading text="assigned courses" /> : offeringsQuery.isError ? <Retry error={offeringsQuery.error} retry={() => {void offeringsQuery.refetch();}} /> : <FlatList
      data={offerings} keyExtractor={x => field(x,"id")} contentContainerStyle={styles.list}
      refreshControl={<RefreshControl refreshing={offeringsQuery.isRefetching} onRefresh={() => {void offeringsQuery.refetch();}} tintColor={colors.primary} />}
      renderItem={({item}) => <Pressable accessibilityRole="button" style={styles.card} onPress={() => selectedCourse(item)}>
        <Text style={styles.cardTitle}>{courseLabel(item)}</Text><Text style={styles.detail}>Open your assigned roster to load and save component marks.</Text><Text style={styles.link}>Open marks →</Text>
      </Pressable>}
      ListEmptyComponent={<Empty title="No assigned courses" detail="No active course offerings were returned for this faculty account." />}
      initialNumToRender={12} windowSize={7}
    /> : rosterQuery.isLoading ? <Loading text="assigned roster" /> : rosterQuery.isError ? <Retry error={rosterQuery.error} retry={() => {void rosterQuery.refetch();}} /> : marksQuery.isLoading ? <Loading text="existing marks" /> : marksQuery.isError ? <Retry error={marksQuery.error} retry={() => {void marksQuery.refetch();}} /> : <ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={marksQuery.isRefetching} onRefresh={() => {void marksQuery.refetch();}} tintColor={colors.primary} />}>
      <View style={styles.summary}><Text style={styles.cardTitle}>{selectedOffering ? courseLabel(selectedOffering) : "Assigned course"}</Text><Text style={styles.detail}>{roster.length} active student(s) in this section.</Text></View>
      <View style={styles.card}>
        <Text style={styles.label}>Assessment component</Text><TextInput value={component} onChangeText={setComponent} maxLength={100} placeholder="e.g. Internal 1" placeholderTextColor={colors.textMuted} style={styles.input} accessibilityLabel="Assessment component" />
        <Button label="Load component" secondary disabled={!component.trim() || component.trim().length > 100} onPress={() => {setActiveComponent(component.trim());setErrorMessage("");}} />
        <Text style={styles.label}>Maximum marks</Text><TextInput editable={canEnter} value={maxMarks} onChangeText={setMaxMarks} keyboardType="decimal-pad" placeholder="50" placeholderTextColor={colors.textMuted} style={styles.input} accessibilityLabel="Maximum marks" />
        <Text style={styles.detail}>Blank entries are left unchanged. Select Load component to switch to another component's saved marks.</Text>
      </View>
      {roster.map(student => <View style={styles.card} key={student.studentId}>
        <View style={styles.row}><View style={styles.studentInfo}><Text style={styles.cardTitle}>{studentLabel({firstName:student.firstName,lastName:student.lastName})}</Text><Text style={styles.detail}>{student.rollNumber || "Roll number not available"}</Text></View>
        <View style={styles.markInputWrap}><TextInput editable={canEnter} value={marks[student.studentId] || ""} onChangeText={raw => setMarks(current => ({...current,[student.studentId]:raw}))} keyboardType="decimal-pad" placeholder="—" placeholderTextColor={colors.textMuted} style={styles.markInput} accessibilityLabel={"Marks for "+studentLabel({firstName:student.firstName,lastName:student.lastName})} /><Text style={styles.maxText}>/ {maxMarks || "—"}</Text></View></View>
      </View>)}
      {!roster.length ? <Empty title="No active students" detail="No students were returned for this assigned course offering." /> : null}
      {errorMessage ? <Text style={styles.error}>{errorMessage}</Text> : null}
      {saveMutation.isError ? <Text style={styles.error}>{saveMutation.error instanceof Error?saveMutation.error.message:"Marks could not be saved."}</Text> : null}
      {saveMutation.isSuccess ? <Text style={styles.success}>Marks were accepted by the backend; refreshing saved records.</Text> : null}
      {canEnter ? <Button label={saveMutation.isPending ? "Saving marks…" : "Save marks"} disabled={saveMutation.isPending || !roster.length || !activeComponent.trim()} onPress={() => {setErrorMessage("");saveMutation.mutate();}} /> : <Text style={styles.muted}>Read-only access: your session does not have marks.enter.</Text>}
    </ScrollView>
    : readQuery.isLoading ? <Loading text="scope-filtered mark records" /> : readQuery.isError ? <Retry error={readQuery.error} retry={() => {void readQuery.refetch();}} /> : <FlatList
      data={readRecords} keyExtractor={(x,i) => field(x,"id") || "mark-"+i} contentContainerStyle={styles.list}
      refreshControl={<RefreshControl refreshing={readQuery.isRefetching} onRefresh={() => {void readQuery.refetch();}} tintColor={colors.primary} />}
      renderItem={({item}) => <View style={styles.card}><Text style={styles.cardTitle}>{studentLabel(item.student)}</Text><Text style={styles.detail}>Component: {field(item,"component") || "—"}</Text><Text style={styles.detail}>Marks: {field(item,"marksObtained") || "0"} / {field(item,"maxMarks") || "—"}</Text></View>}
      ListEmptyComponent={<Empty title="No internal marks" detail="No marks matched your authorized role and workspace scope." />} initialNumToRender={16} windowSize={7}
    />}

    {loadError ? <Text style={styles.errorInline}>{loadError instanceof Error?loadError.message:"Could not load internal marks."}</Text> : null}
    <View style={styles.footer}><Text style={styles.footerText}>UI permission checks improve usability only. Backend role, offering ownership, tenant scope, and student-roster validation remain authoritative.</Text></View>
  </View>;
}

function Loading({text}:{text:string}) { return <View style={styles.state}><ActivityIndicator size="large" color={colors.primary}/><Text style={styles.muted}>Loading {text}…</Text></View>; }
function Retry({error,retry}:{error:unknown;retry:()=>void}) { return <View style={styles.state}><Text style={styles.cardTitle}>Could not load internal marks</Text><Text style={styles.muted}>{error instanceof ApiError?error.message:error instanceof Error?error.message:"The request failed."}</Text>{error instanceof ApiError&&error.requestId?<Text style={styles.muted}>Request reference: {error.requestId}</Text>:null}<Button label="Retry" onPress={retry}/></View>; }
function Empty({title,detail}:{title:string;detail:string}) { return <View style={styles.empty}><Text style={styles.cardTitle}>{title}</Text><Text style={styles.muted}>{detail}</Text></View>; }
function Button({label,onPress,disabled,secondary}:{label:string;onPress:()=>void;disabled?:boolean;secondary?:boolean}) { return <Pressable accessibilityRole="button" accessibilityLabel={label} disabled={disabled} onPress={onPress} style={[styles.button,secondary?styles.secondary:null,disabled?styles.disabled:null]}><Text style={[styles.buttonText,secondary?styles.secondaryText:null]}>{label}</Text></Pressable>; }

const styles = StyleSheet.create({
 root:{flex:1,backgroundColor:colors.canvas},header:{padding:spacing.lg,gap:7,backgroundColor:colors.surface,borderBottomWidth:1,borderColor:colors.border},eyebrow:{fontSize:10,fontWeight:"900",letterSpacing:1,color:colors.primary},title:{fontSize:23,fontWeight:"900",color:colors.text},subtitle:{fontSize:12,lineHeight:18,color:colors.textMuted},back:{fontSize:12,fontWeight:"900",color:colors.primary,paddingVertical:5},
 list:{padding:spacing.lg,paddingBottom:28},content:{padding:spacing.lg,paddingBottom:32,gap:9},card:{backgroundColor:colors.surface,borderWidth:1,borderColor:colors.border,borderRadius:radius.md,padding:spacing.md,marginBottom:9},summary:{backgroundColor:colors.surface,borderWidth:1,borderColor:colors.border,borderRadius:radius.md,padding:spacing.lg,marginBottom:3},cardTitle:{flex:1,fontSize:14,fontWeight:"900",color:colors.text},detail:{fontSize:12,lineHeight:18,color:colors.textMuted,marginTop:5},link:{color:colors.primary,fontSize:12,fontWeight:"900",marginTop:10},
 label:{fontSize:11,fontWeight:"900",color:colors.text,marginTop:10},input:{backgroundColor:colors.surface,color:colors.text,borderWidth:1,borderColor:colors.border,borderRadius:radius.sm,paddingHorizontal:11,paddingVertical:9,fontSize:13,marginTop:6},row:{flexDirection:"row",alignItems:"center",justifyContent:"space-between",gap:8},studentInfo:{flex:1},markInputWrap:{flexDirection:"row",alignItems:"center",gap:3},markInput:{width:78,textAlign:"right",borderWidth:1,borderColor:colors.border,borderRadius:radius.sm,paddingHorizontal:8,paddingVertical:9,color:colors.text,backgroundColor:colors.surface,fontSize:14},maxText:{fontSize:11,color:colors.textMuted},
 button:{alignSelf:"flex-start",backgroundColor:colors.primary,borderRadius:radius.sm,paddingHorizontal:14,paddingVertical:10,marginTop:10},buttonText:{color:colors.white,fontSize:12,fontWeight:"900"},secondary:{backgroundColor:colors.surfaceMuted,borderWidth:1,borderColor:colors.border},secondaryText:{color:colors.text},disabled:{opacity:.5},state:{flex:1,alignItems:"center",justifyContent:"center",padding:spacing.xl,gap:10},empty:{alignItems:"center",gap:8,padding:spacing.xl,backgroundColor:colors.surface,borderWidth:1,borderColor:colors.border,borderRadius:radius.md},muted:{fontSize:12,lineHeight:18,color:colors.textMuted,textAlign:"center"},error:{fontSize:12,lineHeight:18,color:colors.danger,marginTop:8},success:{fontSize:11,color:colors.success,marginTop:8},errorInline:{fontSize:11,color:colors.danger,marginHorizontal:spacing.lg,marginTop:5},footer:{padding:spacing.md,borderTopWidth:1,borderColor:colors.border,backgroundColor:colors.surface},footerText:{fontSize:10,lineHeight:15,textAlign:"center",color:colors.textMuted}
});