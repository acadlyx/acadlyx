import React, { useMemo, useState } from "react";
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiError, apiRequest } from "../api/client";
import { displayValue, recordTitle, toCollection } from "../api/payload";
import { useAuth } from "../auth/AuthProvider";
import { useWorkspaceContext } from "../workspace/WorkspaceContextProvider";
import { colors, radius, spacing } from "../ui/theme";

type Row = Record<string, unknown>;
type Option = { id: string; name?: string; code?: string; programId?: string; academicYearId?: string; semesterId?: string; [key: string]: unknown };
type Status = "ACTIVE" | "INACTIVE" | "GRADUATED" | "WITHDRAWN" | "TRANSFERRED";
type EnrollmentStatus = "ACTIVE" | "COMPLETED" | "DROPPED" | "TRANSFERRED";
type Draft = Record<string, string>;
const PAGE_SIZE = 50;
const statuses: Status[] = ["ACTIVE", "INACTIVE", "GRADUATED", "WITHDRAWN", "TRANSFERRED"];
const enrollmentStatuses: EnrollmentStatus[] = ["ACTIVE", "COMPLETED", "DROPPED", "TRANSFERRED"];
const emptyDraft = (): Draft => ({
  email: "", idNumber: "", password: "", firstName: "", lastName: "", admissionNumber: "", phone: "",
  dateOfBirth: "", gender: "", address: "", guardianName: "", guardianPhone: "", status: "ACTIVE",
  programId: "", academicYearId: "", semesterId: "", sectionId: "", rollNumber: "",
});

function object(value: unknown): Row {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Row : {};
}
function idOf(value: Row): string { return typeof value.id === "string" ? value.id : ""; }
function nested(value: Row, key: string): Row { return object(value[key]); }
function text(value: unknown): string { return value === null || value === undefined ? "" : String(value); }
function studentLabel(student: Row): string {
  const name = [text(student.firstName), text(student.lastName)].filter(Boolean).join(" ").trim();
  const profile = nested(student, "profile");
  return name || text(student.email) || text(profile.admissionNumber) || "Student record";
}
function optionLabel(item: Option): string {
  const name = typeof item.name === "string" ? item.name : "";
  const code = typeof item.code === "string" ? item.code : "";
  return [name || code || "Option", name && code ? code : ""].filter(Boolean).join(" · ");
}
function errorText(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  return error instanceof Error ? error.message : "The request failed. Try again.";
}

export function StudentsScreen() {
  const { user } = useAuth();
  const { context } = useWorkspaceContext();
  const workspaceKey = JSON.stringify(context?.scope ?? {});
  const client = useQueryClient();
  const permissions = user?.permissions ?? [];
  const canRead = permissions.includes("students.read");
  const canCreate = permissions.includes("students.create");
  const canUpdate = permissions.includes("students.update");
  const canEnroll = canCreate || canUpdate;
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<Status | "ALL">("ALL");
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState("");
  const [editingId, setEditingId] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [showEnrollmentForm, setShowEnrollmentForm] = useState(false);
  const [draft, setDraft] = useState<Draft>(emptyDraft());
  const [enrollmentDraft, setEnrollmentDraft] = useState<Draft>({ programId: "", academicYearId: "", semesterId: "", sectionId: "", rollNumber: "", status: "ACTIVE" });
  const [formError, setFormError] = useState("");
  const [notice, setNotice] = useState("");

  const listQuery = useQuery({
    queryKey: ["students", user?.id, workspaceKey, page, search, status],
    queryFn: () => apiRequest<unknown>("/students?page=" + page + "&pageSize=" + PAGE_SIZE + (search.trim() ? "&search=" + encodeURIComponent(search.trim()) : "") + (status !== "ALL" ? "&status=" + status : "")),
    enabled: Boolean(user?.id && canRead),
    staleTime: 0,
  });
  const detailQuery = useQuery({
    queryKey: ["student", user?.id, workspaceKey, selectedId],
    queryFn: () => apiRequest<unknown>("/students/" + encodeURIComponent(selectedId)),
    enabled: Boolean(user?.id && canRead && selectedId),
    staleTime: 0,
  });
  const enrollmentsQuery = useQuery({
    queryKey: ["student-enrollments", user?.id, workspaceKey, selectedId],
    queryFn: () => apiRequest<unknown>("/students/" + encodeURIComponent(selectedId) + "/enrollments"),
    enabled: Boolean(user?.id && canRead && selectedId),
    staleTime: 0,
  });
  const showOptions = Boolean(user?.id && ((showForm && canCreate && !editingId) || showEnrollmentForm));
  const programsQuery = useQuery({ queryKey: ["student-options", user?.id, workspaceKey, "programs"], queryFn: () => apiRequest<unknown>("/programs?page=1&pageSize=100"), enabled: showOptions && permissions.includes("programs.read"), staleTime: 0 });
  const yearsQuery = useQuery({ queryKey: ["student-options", user?.id, workspaceKey, "years"], queryFn: () => apiRequest<unknown>("/academic-years?page=1&pageSize=100"), enabled: showOptions && permissions.includes("academic-years.read"), staleTime: 0 });
  const semestersQuery = useQuery({ queryKey: ["student-options", user?.id, workspaceKey, "semesters"], queryFn: () => apiRequest<unknown>("/semesters?page=1&pageSize=100"), enabled: showOptions && permissions.includes("semesters.read"), staleTime: 0 });
  const sectionsQuery = useQuery({ queryKey: ["student-options", user?.id, workspaceKey, "sections"], queryFn: () => apiRequest<unknown>("/sections?page=1&pageSize=100"), enabled: showOptions && permissions.includes("sections.read"), staleTime: 0 });

  const list = useMemo(() => toCollection(listQuery.data).map(object), [listQuery.data]);
  const currentStudent = useMemo(() => {
    const detail = object(detailQuery.data);
    return idOf(detail) ? detail : list.find((row) => idOf(row) === selectedId) ?? null;
  }, [detailQuery.data, list, selectedId]);
  const programs = useMemo(() => toCollection(programsQuery.data).map(object).filter((item) => typeof item.id === "string") as Option[], [programsQuery.data]);
  const years = useMemo(() => toCollection(yearsQuery.data).map(object).filter((item) => typeof item.id === "string") as Option[], [yearsQuery.data]);
  const semesters = useMemo(() => toCollection(semestersQuery.data).map(object).filter((item) => typeof item.id === "string") as Option[], [semestersQuery.data]);
  const sections = useMemo(() => toCollection(sectionsQuery.data).map(object).filter((item) => typeof item.id === "string") as Option[], [sectionsQuery.data]);
  const enrollments = useMemo(() => toCollection(enrollmentsQuery.data).map(object), [enrollmentsQuery.data]);

  const invalidate = async () => {
    await Promise.all([
      client.invalidateQueries({ queryKey: ["students", user?.id] }),
      client.invalidateQueries({ queryKey: ["student", user?.id] }),
      client.invalidateQueries({ queryKey: ["student-enrollments", user?.id] }),
      client.invalidateQueries({ queryKey: ["student-options", user?.id] }),
      client.invalidateQueries({ queryKey: ["my-work", user?.id] }),
      client.invalidateQueries({ queryKey: ["dashboard-work", user?.id] }),
    ]);
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const requiredPermission = editingId ? "students.update" : "students.create";
      if (!user || !permissions.includes(requiredPermission)) throw new Error("Your session does not permit this student operation.");
      const profileFields = ["phone", "dateOfBirth", "gender", "address", "guardianName", "guardianPhone"];
      const optional: Row = {};
      for (const key of profileFields) if (draft[key]?.trim()) optional[key] = draft[key].trim();
      const statusValue = (draft.status || "ACTIVE") as Status;
      if (editingId) {
        const payload = {
          email: draft.email.trim(), idNumber: draft.idNumber.trim(), firstName: draft.firstName.trim(),
          lastName: draft.lastName.trim(), admissionNumber: draft.admissionNumber.trim(), status: statusValue, ...optional,
        };
        if (!payload.email || !payload.idNumber || !payload.firstName || !payload.lastName || !payload.admissionNumber) throw new Error("Email, ID number, first name, last name and admission number are required.");
        return apiRequest<unknown>("/students/" + encodeURIComponent(editingId), { method: "PATCH", body: JSON.stringify(payload) });
      }
      if (!draft.password || draft.password.length < 8) throw new Error("Initial password must contain at least 8 characters.");
      for (const key of ["email", "idNumber", "firstName", "lastName", "admissionNumber", "programId", "academicYearId", "semesterId"]) {
        if (!draft[key]?.trim()) throw new Error(key + " is required.");
      }
      const payload = {
        ...optional, email: draft.email.trim(), idNumber: draft.idNumber.trim(), password: draft.password,
        firstName: draft.firstName.trim(), lastName: draft.lastName.trim(), admissionNumber: draft.admissionNumber.trim(),
        status: statusValue, programId: draft.programId, academicYearId: draft.academicYearId,
        semesterId: draft.semesterId, ...(draft.sectionId ? { sectionId: draft.sectionId } : {}),
        ...(draft.rollNumber.trim() ? { rollNumber: draft.rollNumber.trim() } : {}),
      };
      return apiRequest<unknown>("/students", { method: "POST", body: JSON.stringify(payload) });
    },
    onSuccess: async (result) => {
      const saved = object(result);
      if (idOf(saved)) setSelectedId(idOf(saved));
      setFormError(""); setNotice(editingId ? "Student record updated." : "Student account and initial enrollment created.");
      setShowForm(false); setEditingId(""); setDraft(emptyDraft());
      await invalidate();
    },
    onError: (error: unknown) => setFormError(errorText(error)),
  });

  const enrollmentMutation = useMutation({
    mutationFn: async () => {
      if (!user || !selectedId || !canEnroll) throw new Error("Enrollment permission is not granted.");
      for (const key of ["programId", "academicYearId", "semesterId"]) if (!enrollmentDraft[key]?.trim()) throw new Error(key + " is required.");
      const payload = {
        programId: enrollmentDraft.programId, academicYearId: enrollmentDraft.academicYearId,
        semesterId: enrollmentDraft.semesterId, ...(enrollmentDraft.sectionId ? { sectionId: enrollmentDraft.sectionId } : {}),
        ...(enrollmentDraft.rollNumber.trim() ? { rollNumber: enrollmentDraft.rollNumber.trim() } : {}),
        status: enrollmentDraft.status as EnrollmentStatus,
      };
      return apiRequest<unknown>("/students/" + encodeURIComponent(selectedId) + "/enrollments", { method: "POST", body: JSON.stringify(payload) });
    },
    onSuccess: async () => {
      setFormError(""); setNotice("Academic enrollment saved."); setShowEnrollmentForm(false);
      setEnrollmentDraft({ programId: "", academicYearId: "", semesterId: "", sectionId: "", rollNumber: "", status: "ACTIVE" });
      await invalidate();
    },
    onError: (error: unknown) => setFormError(errorText(error)),
  });

  const startCreate = () => {
    setEditingId(""); setDraft(emptyDraft()); setFormError(""); setNotice(""); setShowForm(true); setShowEnrollmentForm(false);
  };
  const startEdit = (row: Row) => {
    const profile = nested(row, "profile");
    setEditingId(idOf(row));
    setDraft({
      ...emptyDraft(), email: text(row.email), idNumber: text(row.idNumber), firstName: text(row.firstName),
      lastName: text(row.lastName), admissionNumber: text(profile.admissionNumber), phone: text(row.phone),
      dateOfBirth: text(profile.dateOfBirth).slice(0, 10), gender: text(profile.gender), address: text(profile.address),
      guardianName: text(profile.guardianName), guardianPhone: text(profile.guardianPhone),
      status: statuses.includes(text(profile.status) as Status) ? text(profile.status) : "ACTIVE",
    });
    setFormError(""); setNotice(""); setShowForm(true); setShowEnrollmentForm(false);
  };
  const startEnrollment = () => {
    setEnrollmentDraft({ programId: "", academicYearId: "", semesterId: "", sectionId: "", rollNumber: "", status: "ACTIVE" });
    setFormError(""); setNotice(""); setShowEnrollmentForm(true); setShowForm(false);
  };

  const renderChoices = (label: string, key: string, options: Option[], draftValue: Draft, setDraftValue: React.Dispatch<React.SetStateAction<Draft>>, required: boolean, loading: boolean, failed: boolean) => (
    <View style={styles.field}>
      <Text style={styles.label}>{label}{required ? " *" : ""}</Text>
      {loading ? <Text style={styles.muted}>Loading authorized choices…</Text> : failed ? <Text style={styles.errorText}>Could not load choices. Retry the option request before saving.</Text> : options.length ? <View style={styles.choices}>{options.map((option) => {
        const selected = draftValue[key] === option.id;
        return <Pressable key={option.id} accessibilityRole="button" accessibilityState={{ selected }} onPress={() => setDraftValue((previous) => ({ ...previous, [key]: option.id }))} style={[styles.choice, selected ? styles.choiceSelected : null]}><Text style={[styles.choiceText, selected ? styles.choiceSelectedText : null]}>{optionLabel(option)}</Text></Pressable>;
      })}</View> : <Text style={styles.muted}>No authorized choices are available; record IDs cannot be entered manually.</Text>}
    </View>
  );

  const textField = (key: string, label: string, required = false, secure = false) => (
    <View key={key} style={styles.field}><Text style={styles.label}>{label}{required ? " *" : ""}</Text><TextInput accessibilityLabel={label} value={draft[key] ?? ""} onChangeText={(value) => setDraft((previous) => ({ ...previous, [key]: value }))} style={styles.input} placeholder={label} placeholderTextColor={colors.textMuted} secureTextEntry={secure} autoCapitalize={key === "email" ? "none" : key === "idNumber" ? "characters" : "words"} keyboardType={key === "email" ? "email-address" : "default"} editable={!saveMutation.isPending} /></View>
  );

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" refreshControl={<RefreshControl refreshing={listQuery.isRefetching} onRefresh={() => { void listQuery.refetch(); if (selectedId) { void detailQuery.refetch(); void enrollmentsQuery.refetch(); } }} tintColor={colors.primary} />}>
        <View style={styles.header}>
          <Text style={styles.eyebrow}>STUDENT ADMINISTRATION</Text>
          <Text style={styles.title}>Student records</Text>
          <Text style={styles.muted}>Student accounts, master profiles and academic enrollments are persisted through the existing tenant-scoped ACADLYX API.</Text>
          <TextInput value={search} onChangeText={(value) => { setSearch(value); setPage(1); }} style={styles.input} placeholder="Search name, email or admission number" placeholderTextColor={colors.textMuted} accessibilityLabel="Search students" />
          <View style={styles.choices}>{(["ALL", ...statuses] as const).map((value) => <Pressable key={value} accessibilityRole="button" accessibilityState={{ selected: status === value }} onPress={() => { setStatus(value); setPage(1); }} style={[styles.choice, status === value ? styles.choiceSelected : null]}><Text style={[styles.choiceText, status === value ? styles.choiceSelectedText : null]}>{value === "ALL" ? "All statuses" : value}</Text></Pressable>)}</View>
          {canCreate ? <Pressable accessibilityRole="button" onPress={startCreate} style={styles.primary}><Text style={styles.primaryText}>Create student + enrollment</Text></Pressable> : null}
        </View>

        {notice ? <Text style={styles.success}>{notice}</Text> : null}
        {formError ? <View accessibilityRole="alert" style={styles.errorBox}><Text style={styles.errorText}>{formError}</Text></View> : null}
        {!canRead ? <View style={styles.state}><Text style={styles.sectionTitle}>Read access not granted</Text><Text style={styles.muted}>The current session does not include students.read.</Text></View> : null}
        {canRead && listQuery.isLoading ? <View style={styles.state}><ActivityIndicator color={colors.primary}/><Text style={styles.muted}>Loading authorized student records…</Text></View> : null}
        {canRead && listQuery.isError ? <View style={styles.state}><Text style={styles.sectionTitle}>{listQuery.error instanceof ApiError && listQuery.error.status === 403 ? "Access not granted" : "Student records unavailable"}</Text><Text style={styles.muted}>{errorText(listQuery.error)}</Text><Pressable onPress={() => { void listQuery.refetch(); }} style={styles.secondary}><Text style={styles.secondaryText}>Retry</Text></Pressable></View> : null}

        {showForm ? <View style={styles.form}>
          <Text style={styles.formTitle}>{editingId ? "Edit student profile" : "Create student account and first enrollment"}</Text>
          {textField("firstName", "First name", true)}
          {textField("lastName", "Last name", true)}
          {textField("email", "Email", true)}
          {textField("idNumber", "Institution ID number", true)}
          {!editingId ? textField("password", "Initial password (minimum 8 characters)", true, true) : null}
          {textField("admissionNumber", "Admission number", true)}
          {textField("phone", "Phone")}
          {textField("dateOfBirth", "Date of birth (YYYY-MM-DD)")}
          {textField("gender", "Gender")}
          {textField("address", "Address")}
          {textField("guardianName", "Guardian name")}
          {textField("guardianPhone", "Guardian phone")}
          <Text style={styles.label}>Student status</Text>
          <View style={styles.choices}>{statuses.map((value) => <Pressable key={value} accessibilityRole="button" accessibilityState={{ selected: draft.status === value }} onPress={() => setDraft((previous) => ({ ...previous, status: value }))} style={[styles.choice, draft.status === value ? styles.choiceSelected : null]}><Text style={[styles.choiceText, draft.status === value ? styles.choiceSelectedText : null]}>{value}</Text></Pressable>)}</View>
          {!editingId ? <>
            {renderChoices("Programme", "programId", programs, draft, setDraft, true, programsQuery.isLoading, programsQuery.isError)}
            {renderChoices("Academic year", "academicYearId", years, draft, setDraft, true, yearsQuery.isLoading, yearsQuery.isError)}
            {renderChoices("Semester", "semesterId", semesters, draft, setDraft, true, semestersQuery.isLoading, semestersQuery.isError)}
            {renderChoices("Section (optional)", "sectionId", sections, draft, setDraft, false, sectionsQuery.isLoading, sectionsQuery.isError)}
            {textField("rollNumber", "Roll number")}
          </> : null}
          <View style={styles.actions}><Pressable accessibilityRole="button" disabled={saveMutation.isPending} onPress={() => saveMutation.mutate()} style={[styles.primary, saveMutation.isPending ? styles.disabled : null]}><Text style={styles.primaryText}>{saveMutation.isPending ? "Saving…" : editingId ? "Save student changes" : "Create student"}</Text></Pressable><Pressable accessibilityRole="button" disabled={saveMutation.isPending} onPress={() => { setShowForm(false); setEditingId(""); setFormError(""); }} style={styles.secondary}><Text style={styles.secondaryText}>Cancel</Text></Pressable></View>
        </View> : null}

        {canRead && currentStudent ? <View style={styles.detail}>
          <View style={styles.detailHeader}><View style={{flex:1}}><Text style={styles.sectionTitle}>{studentLabel(currentStudent)}</Text><Text style={styles.muted}>{text(currentStudent.email)} · {text(nested(currentStudent, "profile").admissionNumber)}</Text></View><Pressable accessibilityRole="button" onPress={() => setSelectedId("")} style={styles.secondary}><Text style={styles.secondaryText}>Close</Text></Pressable></View>
          {detailQuery.isLoading ? <ActivityIndicator color={colors.primary}/> : detailQuery.isError ? <Text style={styles.errorText}>{errorText(detailQuery.error)}</Text> : <View style={styles.detailFields}>{Object.entries(currentStudent).filter(([key,value]) => !["passwordHash","userRoles","roles","enrollments","studentEnrollments","profile","currentEnrollment"].includes(key) && value !== null && typeof value !== "object").slice(0,12).map(([key,value]) => <View key={key} style={styles.detailField}><Text style={styles.detailLabel}>{key.replace(/([A-Z])/g," $1")}</Text><Text style={styles.detailValue}>{displayValue(value)}</Text></View>)}{Object.entries(nested(currentStudent,"profile")).filter(([key,value])=>key!=="id"&&key!=="institutionId"&&value!==null&&typeof value!=="object").slice(0,14).map(([key,value])=><View key={key} style={styles.detailField}><Text style={styles.detailLabel}>Profile · {key.replace(/([A-Z])/g," $1")}</Text><Text style={styles.detailValue}>{displayValue(value)}</Text></View>)}</View>}
          {canUpdate ? <Pressable accessibilityRole="button" onPress={() => startEdit(currentStudent)} style={styles.secondary}><Text style={styles.secondaryText}>Edit profile</Text></Pressable> : null}
          {canEnroll ? <Pressable accessibilityRole="button" onPress={startEnrollment} style={styles.primary}><Text style={styles.primaryText}>Add / update academic enrollment</Text></Pressable> : null}
          <Text style={styles.formTitle}>Enrollment history</Text>
          {enrollmentsQuery.isLoading ? <ActivityIndicator color={colors.primary}/> : enrollmentsQuery.isError ? <Text style={styles.errorText}>{errorText(enrollmentsQuery.error)}</Text> : enrollments.length ? enrollments.map((enrollment,index) => <View key={idOf(enrollment)||String(index)} style={styles.enrollment}><Text style={styles.enrollmentTitle}>{text(nested(enrollment,"program").name)||"Programme"} · {text(nested(enrollment,"academicYear").name)||"Academic year"}</Text><Text style={styles.muted}>{text(nested(enrollment,"semester").name)||"Semester"} · {text(nested(enrollment,"section").name)||"No section"} · {text(enrollment.status)}</Text></View>) : <Text style={styles.muted}>No authorized enrollment history returned.</Text>}
          {showEnrollmentForm ? <View style={styles.form}>
            <Text style={styles.formTitle}>Add / update enrollment</Text>
            {renderChoices("Programme","programId",programs,enrollmentDraft,setEnrollmentDraft,true,programsQuery.isLoading,programsQuery.isError)}
            {renderChoices("Academic year","academicYearId",years,enrollmentDraft,setEnrollmentDraft,true,yearsQuery.isLoading,yearsQuery.isError)}
            {renderChoices("Semester","semesterId",semesters,enrollmentDraft,setEnrollmentDraft,true,semestersQuery.isLoading,semestersQuery.isError)}
            {renderChoices("Section (optional)","sectionId",sections,enrollmentDraft,setEnrollmentDraft,false,sectionsQuery.isLoading,sectionsQuery.isError)}
            <View style={styles.field}><Text style={styles.label}>Roll number</Text><TextInput accessibilityLabel="Enrollment roll number" value={enrollmentDraft.rollNumber} onChangeText={(value)=>setEnrollmentDraft((previous)=>({...previous,rollNumber:value}))} style={styles.input} placeholder="Roll number" placeholderTextColor={colors.textMuted}/></View>
            <View style={styles.choices}>{enrollmentStatuses.map((value)=> <Pressable key={value} accessibilityRole="button" accessibilityState={{selected:enrollmentDraft.status===value}} onPress={()=>setEnrollmentDraft((previous)=>({...previous,status:value}))} style={[styles.choice,enrollmentDraft.status===value?styles.choiceSelected:null]}><Text style={[styles.choiceText,enrollmentDraft.status===value?styles.choiceSelectedText:null]}>{value}</Text></Pressable>)}</View>
            <View style={styles.actions}><Pressable accessibilityRole="button" disabled={enrollmentMutation.isPending} onPress={()=>enrollmentMutation.mutate()} style={[styles.primary,enrollmentMutation.isPending?styles.disabled:null]}><Text style={styles.primaryText}>{enrollmentMutation.isPending?"Saving…":"Save enrollment"}</Text></Pressable><Pressable accessibilityRole="button" onPress={()=>setShowEnrollmentForm(false)} style={styles.secondary}><Text style={styles.secondaryText}>Cancel</Text></Pressable></View>
          </View> : null}
        </View> : null}

        {canRead && !listQuery.isLoading && !listQuery.isError && !list.length ? <View style={styles.state}><Text style={styles.sectionTitle}>No students found</Text><Text style={styles.muted}>No student records matched these filters in the authorized scope.</Text>{canCreate ? <Pressable onPress={startCreate} style={styles.primary}><Text style={styles.primaryText}>Create first student</Text></Pressable> : null}</View> : null}
        {canRead ? list.map((student,index) => {
          const profile = nested(student,"profile");
          const currentEnrollment = nested(student,"currentEnrollment");
          const selected = idOf(student) === selectedId;
          return <Pressable key={idOf(student)||String(index)} onPress={() => { setSelectedId(idOf(student)); setShowForm(false); setShowEnrollmentForm(false); setFormError(""); }} style={[styles.studentCard,selected?styles.studentSelected:null]}>
            <View style={{flex:1}}><Text style={styles.studentTitle}>{studentLabel(student)}</Text><Text style={styles.muted}>{text(student.email)} · Admission {text(profile.admissionNumber)||"—"}</Text><Text style={styles.muted}>{text(nested(currentEnrollment,"program").name)||"No current programme"} · {text(nested(currentEnrollment,"academicYear").name)||text(student.enrollmentState)||"Enrollment not set"}</Text></View>
            <Text style={[styles.status, profile.status==="ACTIVE"?styles.statusActive:styles.statusOther]}>{text(profile.status)||"UNKNOWN"}</Text>
          </Pressable>;
        }) : null}
        {canRead && !listQuery.isLoading && !listQuery.isError ? <View style={styles.pagination}><Pressable accessibilityRole="button" disabled={page<=1} onPress={()=>setPage((value)=>Math.max(1,value-1))} style={[styles.secondary,page<=1?styles.disabled:null]}><Text style={styles.secondaryText}>Previous</Text></Pressable><Text style={styles.muted}>Page {page}</Text><Pressable accessibilityRole="button" disabled={list.length<PAGE_SIZE} onPress={()=>setPage((value)=>value+1)} style={[styles.secondary,list.length<PAGE_SIZE?styles.disabled:null]}><Text style={styles.secondaryText}>Next</Text></Pressable></View> : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles=StyleSheet.create({
  root:{flex:1,backgroundColor:colors.canvas},content:{paddingBottom:spacing.xl},header:{paddingHorizontal:spacing.lg,paddingTop:spacing.lg,paddingBottom:spacing.md,gap:10},eyebrow:{fontSize:10,fontWeight:"900",letterSpacing:1.4,color:colors.primary},title:{fontSize:24,fontWeight:"900",color:colors.text},muted:{fontSize:12,lineHeight:18,color:colors.textMuted},input:{borderWidth:1,borderColor:colors.border,borderRadius:radius.md,paddingHorizontal:11,paddingVertical:10,color:colors.text,backgroundColor:colors.surface,fontSize:13},choices:{flexDirection:"row",flexWrap:"wrap",gap:6},choice:{borderWidth:1,borderColor:colors.border,borderRadius:radius.md,paddingHorizontal:9,paddingVertical:8},choiceSelected:{borderColor:colors.primary,backgroundColor:colors.primarySoft},choiceText:{fontSize:10,fontWeight:"800",color:colors.textMuted},choiceSelectedText:{color:colors.primary},primary:{backgroundColor:colors.primary,borderRadius:radius.md,paddingHorizontal:13,paddingVertical:10,alignItems:"center",justifyContent:"center"},primaryText:{fontSize:12,fontWeight:"900",color:colors.white},secondary:{borderWidth:1,borderColor:colors.border,borderRadius:radius.md,paddingHorizontal:11,paddingVertical:9,alignItems:"center",justifyContent:"center"},secondaryText:{fontSize:11,fontWeight:"800",color:colors.text},disabled:{opacity:.45},field:{gap:6,marginBottom:5},label:{fontSize:12,fontWeight:"800",color:colors.text},state:{padding:spacing.xl,alignItems:"center",gap:9},sectionTitle:{fontSize:16,fontWeight:"900",color:colors.text},form:{marginHorizontal:spacing.lg,marginBottom:spacing.lg,padding:spacing.md,backgroundColor:colors.surface,borderRadius:radius.lg,borderWidth:1,borderColor:colors.border,gap:10},formTitle:{fontSize:17,fontWeight:"900",color:colors.text,marginTop:4},actions:{flexDirection:"row",flexWrap:"wrap",gap:8},errorBox:{marginHorizontal:spacing.lg,padding:spacing.md,borderWidth:1,borderColor:colors.danger,borderRadius:radius.md,marginBottom:spacing.md},errorText:{fontSize:12,color:colors.danger,lineHeight:17},success:{marginHorizontal:spacing.lg,color:colors.success,fontSize:12,fontWeight:"800",marginBottom:spacing.md},studentCard:{marginHorizontal:spacing.lg,marginBottom:9,padding:spacing.md,borderWidth:1,borderColor:colors.border,borderRadius:radius.md,backgroundColor:colors.surface,flexDirection:"row",alignItems:"flex-start",gap:10},studentSelected:{borderColor:colors.primary},studentTitle:{fontSize:14,fontWeight:"900",color:colors.text,marginBottom:4},status:{fontSize:9,fontWeight:"900",paddingHorizontal:8,paddingVertical:4,borderRadius:radius.pill,overflow:"hidden"},statusActive:{backgroundColor:colors.primarySoft,color:colors.primary},statusOther:{backgroundColor:colors.surfaceMuted,color:colors.textMuted},detail:{marginHorizontal:spacing.lg,marginBottom:spacing.lg,padding:spacing.md,borderWidth:1,borderColor:colors.border,borderRadius:radius.lg,backgroundColor:colors.surface,gap:10},detailHeader:{flexDirection:"row",justifyContent:"space-between",gap:10,alignItems:"flex-start"},detailFields:{gap:5},detailField:{borderTopWidth:1,borderTopColor:colors.surfaceMuted,paddingTop:6},detailLabel:{fontSize:10,fontWeight:"900",color:colors.textMuted,textTransform:"uppercase"},detailValue:{fontSize:12,color:colors.text,lineHeight:17,marginTop:2},enrollment:{borderTopWidth:1,borderTopColor:colors.surfaceMuted,paddingTop:8,gap:3},enrollmentTitle:{fontSize:12,fontWeight:"800",color:colors.text},pagination:{flexDirection:"row",justifyContent:"center",alignItems:"center",gap:14,padding:spacing.md}
});
