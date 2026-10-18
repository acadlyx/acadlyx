import React, { useMemo, useState } from "react";
import { ActivityIndicator, Alert, FlatList, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest, ApiError } from "../api/client";
import { toCollection, displayValue } from "../api/payload";
import { useAuth } from "../auth/AuthProvider";
import { useWorkspaceContext } from "../workspace/WorkspaceContextProvider";
import { colors, radius, spacing } from "../ui/theme";

type Assignment = {
  id: string;
  title: string;
  description?: string;
  dueDate?: string;
  maxMarks?: number;
  status?: "DRAFT" | "PUBLISHED" | string;
  courseOfferingId?: string;
  courseOffering?: { course?: { name?: string; code?: string }; section?: { name?: string } };
  mySubmission?: Submission | null;
};
type Submission = {
  id?: string;
  content?: string;
  status?: string;
  marksAwarded?: number | null;
  feedback?: string | null;
  submittedAt?: string;
};
type RosterEntry = {
  studentId: string;
  firstName?: string;
  lastName?: string;
  rollNumber?: string;
  submission?: Submission | null;
};
type Offering = { id: string; course?: { name?: string; code?: string }; section?: { name?: string }; [key: string]: unknown };

function labelOffering(offering: Offering): string {
  const parts = [offering.course?.code, offering.course?.name, offering.section?.name ? "Section " + offering.section.name : null].filter(Boolean);
  return parts.join(" · ") || "Course offering";
}
function listData<T>(value: unknown): T[] {
  return toCollection(value) as T[];
}
function friendlyDate(value?: string): string {
  if (!value) return "No due date";
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? value : date.toLocaleDateString();
}
function recordIsReopened(submission?: Submission | null): boolean {
  return submission?.status === "REOPENED";
}

export function AssignmentsScreen() {
  const { user } = useAuth();
  const { context } = useWorkspaceContext();
  const workspaceKey = JSON.stringify(context?.scope ?? {});
  const client = useQueryClient();
  const canCreate = Boolean(user?.permissions.includes("assignments.create"));
  const canUpdate = Boolean(user?.permissions.includes("assignments.update"));
  const canSubmit = Boolean(user?.permissions.includes("assignments.submit"));
  const canReview = Boolean(user?.permissions.includes("assignments.review"));
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [search, setSearch] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [maxMarks, setMaxMarks] = useState("100");
  const [offeringId, setOfferingId] = useState<string | null>(null);
  const [submissionContent, setSubmissionContent] = useState("");
  const [reviewStudentId, setReviewStudentId] = useState<string | null>(null);
  const [marks, setMarks] = useState("");
  const [feedback, setFeedback] = useState("");

  const assignments = useQuery({
    queryKey: ["assignments", user?.id, workspaceKey, search],
    queryFn: () => apiRequest<unknown>("/assignments?page=1&pageSize=50&search=" + encodeURIComponent(search)),
    enabled: Boolean(user?.id),
    staleTime: 0
  });
  const offerings = useQuery({
    queryKey: ["course-offerings-for-assignment", user?.id],
    queryFn: () => apiRequest<unknown>("/course-offerings?page=1&pageSize=100"),
    enabled: Boolean(user?.id && canCreate && showCreate),
    staleTime: 15000
  });
  const detail = useQuery({
    queryKey: ["assignment", user?.id, workspaceKey, selectedId],
    queryFn: () => apiRequest<Assignment>("/assignments/" + encodeURIComponent(selectedId as string)),
    enabled: Boolean(user?.id && selectedId),
    staleTime: 0
  });
  const roster = useQuery({
    queryKey: ["assignment-submissions", user?.id, workspaceKey, selectedId],
    queryFn: () => apiRequest<unknown>("/assignments/" + encodeURIComponent(selectedId as string) + "/submissions"),
    enabled: Boolean(user?.id && selectedId && canReview),
    staleTime: 0
  });
  const courseOptions = useMemo(() => listData<Offering>(offerings.data).filter((item) => typeof item.id === "string"), [offerings.data]);
  const rosterRows = useMemo(() => listData<RosterEntry>(roster.data).filter((row) => typeof row.studentId === "string"), [roster.data]);

  const invalidateAssignments = async (id?: string) => {
    await client.invalidateQueries({ queryKey: ["assignments", user?.id] });
    if (id) {
      await client.invalidateQueries({ queryKey: ["assignment", user?.id] });
      await client.invalidateQueries({ queryKey: ["assignment-submissions", user?.id] });
    }
    await client.invalidateQueries({ queryKey: ["my-work", user?.id] });
    await client.invalidateQueries({ queryKey: ["module", user?.id] });
  };

  const createAssignment = useMutation({
    mutationFn: async () => {
      if (!offeringId) throw new Error("Choose a course offering.");
      if (title.trim().length < 2) throw new Error("Assignment title must contain at least 2 characters.");
      if (!/^\d{4}-\d{2}-\d{2}$/.test(dueDate) || Number.isNaN(new Date(dueDate + "T12:00:00").valueOf())) {
        throw new Error("Enter a valid due date using YYYY-MM-DD.");
      }
      const score = Number(maxMarks);
      if (!Number.isInteger(score) || score < 1 || score > 1000) throw new Error("Maximum marks must be a whole number from 1 to 1000.");
      return apiRequest<Assignment>("/assignments", {
        method: "POST",
        body: JSON.stringify({
          courseOfferingId: offeringId,
          title: title.trim(),
          description: description.trim() || undefined,
          dueDate: new Date(dueDate + "T12:00:00").toISOString(),
          maxMarks: score,
          status: "DRAFT"
        })
      });
    },
    onSuccess: async (created) => {
      await invalidateAssignments();
      setShowCreate(false);
      setTitle(""); setDescription(""); setDueDate(""); setMaxMarks("100"); setOfferingId(null);
      if (created?.id) setSelectedId(created.id);
    }
  });

  const updateAssignment = useMutation({
    mutationFn: (body: { title?: string; status?: "DRAFT" | "PUBLISHED" }) =>
      apiRequest<Assignment>("/assignments/" + encodeURIComponent(selectedId as string), {
        method: "PATCH", body: JSON.stringify(body)
      }),
    onSuccess: async () => { await invalidateAssignments(selectedId || undefined); }
  });

  const submit = useMutation({
    mutationFn: () => {
      if (!selectedId) throw new Error("Choose an assignment first.");
      if (!submissionContent.trim()) throw new Error("Submission content is required.");
      if (submissionContent.trim().length > 20000) throw new Error("Submission content cannot exceed 20,000 characters.");
      return apiRequest<Submission>("/assignments/" + encodeURIComponent(selectedId) + "/submit", {
        method: "POST", body: JSON.stringify({ content: submissionContent.trim() })
      });
    },
    onSuccess: async () => { setSubmissionContent(""); await invalidateAssignments(selectedId || undefined); }
  });

  const review = useMutation({
    mutationFn: async () => {
      if (!selectedId || !reviewStudentId) throw new Error("Choose a student submission to review.");
      const score = Number(marks);
      const max = Number(detail.data?.maxMarks);
      if (!Number.isInteger(score) || score < 0) throw new Error("Marks awarded must be a non-negative whole number.");
      if (Number.isFinite(max) && score > max) throw new Error("Marks cannot exceed this assignment's maximum.");
      if (feedback.trim().length > 5000) throw new Error("Feedback cannot exceed 5,000 characters.");
      return apiRequest<Submission>("/assignments/" + encodeURIComponent(selectedId) + "/submissions/" + encodeURIComponent(reviewStudentId), {
        method: "PATCH", body: JSON.stringify({ marksAwarded: score, feedback: feedback.trim() || undefined })
      });
    },
    onSuccess: async () => { setReviewStudentId(null); setMarks(""); setFeedback(""); await invalidateAssignments(selectedId || undefined); }
  });

  const reopen = useMutation({
    mutationFn: (studentId: string) => apiRequest<Submission>("/assignments/" + encodeURIComponent(selectedId as string) + "/submissions/" + encodeURIComponent(studentId) + "/reopen", { method: "POST" }),
    onSuccess: async () => { await invalidateAssignments(selectedId || undefined); }
  });

  const errors = [createAssignment.error, updateAssignment.error, submit.error, review.error, reopen.error].filter(Boolean);
  const errorMessage = errors.length ? (errors[0] instanceof ApiError || errors[0] instanceof Error ? (errors[0] as Error).message : "The action failed.") : "";

  if (selectedId) {
    const assignment = detail.data;
    return <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <Pressable onPress={() => { setSelectedId(null); setReviewStudentId(null); }} style={styles.back}><Text style={styles.backText}>‹ All assignments</Text></Pressable>
      {detail.isLoading ? <View style={styles.state}><ActivityIndicator color={colors.primary} /><Text style={styles.muted}>Loading assignment…</Text></View> :
        detail.isError ? <View style={styles.state}><Text style={styles.heading}>Assignment unavailable</Text><Text style={styles.muted}>{detail.error instanceof Error ? detail.error.message : "Try again."}</Text><Pressable onPress={() => { void detail.refetch(); }} style={styles.primaryButton}><Text style={styles.buttonText}>Retry</Text></Pressable></View> :
        assignment ? <>
          <View style={styles.card}>
            <Text style={styles.kicker}>ASSIGNMENT</Text>
            <Text style={styles.title}>{assignment.title}</Text>
            <Text style={styles.muted}>{labelOffering({ id: assignment.courseOfferingId || "", course: assignment.courseOffering?.course, section: assignment.courseOffering?.section })}</Text>
            <View style={styles.inline}><Text style={styles.pill}>{assignment.status || "Status unavailable"}</Text><Text style={styles.meta}>{String(assignment.maxMarks ?? "—")} marks · Due {friendlyDate(assignment.dueDate)}</Text></View>
            {assignment.description ? <Text style={styles.body}>{assignment.description}</Text> : null}
          </View>
          {canUpdate ? <View style={styles.card}>
            <Text style={styles.sectionTitle}>Publication</Text>
            <Text style={styles.muted}>The existing API only permits DRAFT and PUBLISHED states here.</Text>
            <Pressable disabled={updateAssignment.isPending} onPress={() => updateAssignment.mutate({ status: assignment.status === "PUBLISHED" ? "DRAFT" : "PUBLISHED" })} style={styles.primaryButton}>
              <Text style={styles.buttonText}>{updateAssignment.isPending ? "Saving…" : assignment.status === "PUBLISHED" ? "Move back to draft" : "Publish assignment"}</Text>
            </Pressable>
          </View> : null}
          {canSubmit && assignment.status === "PUBLISHED" ? <View style={styles.card}>
            <Text style={styles.sectionTitle}>My submission</Text>
            {assignment.mySubmission && !recordIsReopened(assignment.mySubmission) ?
              <View style={styles.submissionStatus}><Text style={styles.statusTitle}>Already submitted</Text><Text style={styles.muted}>Status: {assignment.mySubmission.status || "Submitted"}{assignment.mySubmission.marksAwarded != null ? " · Marks: " + String(assignment.mySubmission.marksAwarded) : ""}</Text>{assignment.mySubmission.feedback ? <Text style={styles.body}>Feedback: {assignment.mySubmission.feedback}</Text> : null}<Text style={styles.muted}>A resubmission is accepted only after an authorized reviewer explicitly reopens it.</Text></View> :
              <>
                {assignment.mySubmission?.status === "REOPENED" ? <Text style={styles.warning}>Your submission was reopened. Submit the updated work below.</Text> : null}
                <TextInput value={submissionContent} onChangeText={setSubmissionContent} multiline textAlignVertical="top" maxLength={20000} placeholder="Write or paste your assignment submission" placeholderTextColor={colors.textMuted} style={[styles.input, styles.textArea]} accessibilityLabel="Assignment submission content" />
                <Text style={styles.meta}>{submissionContent.length}/20000 characters</Text>
                <Pressable disabled={submit.isPending} onPress={() => Alert.alert("Submit assignment", "Submit this work to the existing assignment workflow?", [
                  { text: "Cancel", style: "cancel" }, { text: "Submit", onPress: () => submit.mutate() }
                ])} style={styles.primaryButton}><Text style={styles.buttonText}>{submit.isPending ? "Submitting…" : "Submit assignment"}</Text></Pressable>
              </>}
          </View> : null}
          {canReview ? <View style={styles.card}>
            <Text style={styles.sectionTitle}>Section submissions</Text>
            <Text style={styles.muted}>The backend returns the full authorized course roster, including students who have not submitted.</Text>
            {roster.isLoading ? <ActivityIndicator color={colors.primary} /> : roster.isError ? <Text style={styles.error}>{roster.error instanceof Error ? roster.error.message : "Could not load submissions."}</Text> :
              rosterRows.map((row) => {
                const studentName = [row.firstName, row.lastName].filter(Boolean).join(" ") || "Student";
                const submission = row.submission;
                return <View key={row.studentId} style={styles.rosterRow}>
                  <Text style={styles.rosterName}>{studentName}</Text>
                  <Text style={styles.meta}>{row.rollNumber ? "Roll " + row.rollNumber + " · " : ""}{submission?.status || "Not submitted"}</Text>
                  {submission ? <>
                    {submission.content ? <Text style={styles.body}>{submission.content}</Text> : null}
                    {submission.marksAwarded != null ? <Text style={styles.meta}>Marks awarded: {String(submission.marksAwarded)}</Text> : null}
                    {submission.feedback ? <Text style={styles.body}>Feedback: {submission.feedback}</Text> : null}
                    <View style={styles.actionRow}>
                      <Pressable onPress={() => { setReviewStudentId(row.studentId); setMarks(String(submission.marksAwarded ?? "")); setFeedback(submission.feedback || ""); }} style={styles.secondaryButton}><Text style={styles.secondaryText}>Review / grade</Text></Pressable>
                      {submission.status !== "REOPENED" ? <Pressable disabled={reopen.isPending} onPress={() => Alert.alert("Reopen submission", "Allow this student to submit again? The backend clears the previous mark and feedback.", [
                        { text: "Cancel", style: "cancel" }, { text: "Reopen", style: "destructive", onPress: () => reopen.mutate(row.studentId) }
                      ])} style={styles.secondaryButton}><Text style={styles.secondaryText}>Reopen</Text></Pressable> : null}
                    </View>
                    {reviewStudentId === row.studentId ? <>
                      <Text style={styles.label}>Marks awarded (0–{String(assignment.maxMarks ?? "max")})</Text>
                      <TextInput value={marks} onChangeText={setMarks} keyboardType="number-pad" style={styles.input} placeholder="Marks" placeholderTextColor={colors.textMuted} />
                      <Text style={styles.label}>Feedback</Text>
                      <TextInput value={feedback} onChangeText={setFeedback} multiline maxLength={5000} textAlignVertical="top" style={[styles.input, styles.textAreaSmall]} placeholder="Optional feedback" placeholderTextColor={colors.textMuted} />
                      <Pressable disabled={review.isPending} onPress={() => review.mutate()} style={styles.primaryButton}><Text style={styles.buttonText}>{review.isPending ? "Saving review…" : "Save review"}</Text></Pressable>
                    </> : null}
                  </> : null}
                </View>;
              })}
          </View> : null}
          {errorMessage ? <Text accessibilityRole="alert" style={styles.error}>{errorMessage}</Text> : null}
        </> : null}
    </ScrollView>;
  }

  const rows = listData<Assignment>(assignments.data);
  return <View style={styles.root}>
    <View style={styles.listHeader}>
      <Text style={styles.title}>Assignments</Text>
      <Text style={styles.muted}>Real assignments from the existing API. Available actions depend on backend permissions.</Text>
      <TextInput value={search} onChangeText={setSearch} placeholder="Search assignment titles" placeholderTextColor={colors.textMuted} style={styles.input} accessibilityLabel="Search assignments" />
      {canCreate ? <Pressable onPress={() => setShowCreate((value) => !value)} style={styles.primaryButton}><Text style={styles.buttonText}>{showCreate ? "Hide create form" : "Create assignment"}</Text></Pressable> : null}
    </View>
    {showCreate && canCreate ? <ScrollView style={styles.createBox} contentContainerStyle={styles.createContent} keyboardShouldPersistTaps="handled">
      <Text style={styles.sectionTitle}>New assignment</Text>
      <Text style={styles.label}>Course offering</Text>
      {offerings.isLoading ? <ActivityIndicator color={colors.primary} /> : offerings.isError ? <Text style={styles.error}>Course offerings could not be loaded. You must have access to an offering to create an assignment.</Text> :
        courseOptions.length ? courseOptions.map((item) => <Pressable key={item.id} onPress={() => setOfferingId(item.id)} style={[styles.offering, offeringId === item.id ? styles.offeringSelected : null]}>
          <Text style={styles.offeringText}>{labelOffering(item)}</Text>{offeringId === item.id ? <Text style={styles.selectedMark}>Selected</Text> : null}
        </Pressable>) : <Text style={styles.muted}>No course offerings were returned. No ID is accepted as free-form input.</Text>}
      <Text style={styles.label}>Title</Text><TextInput value={title} onChangeText={setTitle} maxLength={200} style={styles.input} placeholder="Assignment title" placeholderTextColor={colors.textMuted} />
      <Text style={styles.label}>Description (optional)</Text><TextInput value={description} onChangeText={setDescription} multiline maxLength={5000} textAlignVertical="top" style={[styles.input, styles.textAreaSmall]} placeholder="Instructions" placeholderTextColor={colors.textMuted} />
      <Text style={styles.label}>Due date (YYYY-MM-DD)</Text><TextInput value={dueDate} onChangeText={setDueDate} maxLength={10} style={styles.input} placeholder="2026-11-15" placeholderTextColor={colors.textMuted} />
      <Text style={styles.label}>Maximum marks (1–1000)</Text><TextInput value={maxMarks} onChangeText={setMaxMarks} keyboardType="number-pad" style={styles.input} placeholder="100" placeholderTextColor={colors.textMuted} />
      <Text style={styles.muted}>New assignments start in DRAFT. Publishing is a separate action and requires assignments.update.</Text>
      {createAssignment.isError ? <Text style={styles.error}>{createAssignment.error instanceof Error ? createAssignment.error.message : "Create failed."}</Text> : null}
      <Pressable disabled={createAssignment.isPending || !courseOptions.length} onPress={() => createAssignment.mutate()} style={styles.primaryButton}>
        {createAssignment.isPending ? <ActivityIndicator color={colors.white} /> : <Text style={styles.buttonText}>Save draft</Text>}
      </Pressable>
    </ScrollView> : null}
    {assignments.isLoading ? <View style={styles.state}><ActivityIndicator color={colors.primary} /><Text style={styles.muted}>Loading assignments…</Text></View> :
      assignments.isError ? <View style={styles.state}><Text style={styles.heading}>Assignments unavailable</Text><Text style={styles.muted}>{assignments.error instanceof Error ? assignments.error.message : "Try again."}</Text><Pressable onPress={() => { void assignments.refetch(); }} style={styles.primaryButton}><Text style={styles.buttonText}>Retry</Text></Pressable></View> :
      <FlatList data={rows} keyExtractor={(item) => item.id} contentContainerStyle={styles.list} keyboardShouldPersistTaps="handled"
        renderItem={({ item }) => <Pressable onPress={() => { setSelectedId(item.id); setShowCreate(false); }} style={styles.assignmentCard}>
          <View style={styles.assignmentHeader}><Text style={styles.assignmentTitle}>{item.title}</Text><Text style={styles.pill}>{item.status || "Unknown"}</Text></View>
          <Text style={styles.meta}>{item.courseOffering?.course?.code || ""}{item.courseOffering?.course?.name ? " · " + item.courseOffering.course.name : ""}</Text>
          <Text style={styles.meta}>Due {friendlyDate(item.dueDate)} · {String(item.maxMarks ?? "—")} marks</Text>
          {item.description ? <Text numberOfLines={2} style={styles.muted}>{item.description}</Text> : null}
        </Pressable>}
        ListEmptyComponent={<View style={styles.state}><Text style={styles.heading}>No assignments found</Text><Text style={styles.muted}>The backend returned no assignments for this account and query.</Text></View>}
        initialNumToRender={12} windowSize={7} />}
  </View>;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.canvas },
  content: { padding: spacing.lg, paddingBottom: 32, gap: 12 }, listHeader: { padding: spacing.lg, gap: 9, backgroundColor: colors.surface, borderBottomWidth: 1, borderColor: colors.border },
  title: { color: colors.text, fontWeight: "900", fontSize: 23 }, heading: { color: colors.text, fontSize: 18, fontWeight: "800" },
  kicker: { color: colors.primary, fontWeight: "900", fontSize: 10, letterSpacing: 1 },
  sectionTitle: { color: colors.text, fontWeight: "900", fontSize: 17 }, muted: { color: colors.textMuted, fontSize: 12, lineHeight: 18, marginTop: 4 },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, backgroundColor: colors.surface, color: colors.text, paddingHorizontal: 12, paddingVertical: 11, fontSize: 14 },
  textArea: { minHeight: 140, marginTop: 10 }, textAreaSmall: { minHeight: 84 },
  label: { color: colors.text, fontSize: 12, fontWeight: "800", marginTop: 12, marginBottom: 6 },
  primaryButton: { borderRadius: radius.md, backgroundColor: colors.primary, paddingHorizontal: 14, paddingVertical: 12, alignItems: "center", justifyContent: "center", marginTop: 6, minHeight: 43 },
  buttonText: { color: colors.white, fontWeight: "800", fontSize: 13 }, secondaryButton: { borderRadius: radius.sm, backgroundColor: colors.primarySoft, paddingHorizontal: 12, paddingVertical: 9, marginTop: 7, alignSelf: "flex-start" },
  secondaryText: { color: colors.primary, fontWeight: "800", fontSize: 11 }, back: { alignSelf: "flex-start", paddingVertical: 4 }, backText: { color: colors.primary, fontWeight: "800" },
  card: { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: radius.lg, padding: spacing.lg, gap: 7 },
  inline: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 9, marginTop: 7 },
  pill: { alignSelf: "flex-start", backgroundColor: colors.primarySoft, color: colors.primary, fontSize: 10, fontWeight: "900", overflow: "hidden", paddingHorizontal: 9, paddingVertical: 5, borderRadius: radius.pill },
  meta: { color: colors.textMuted, fontSize: 11, lineHeight: 17, marginTop: 3 }, body: { color: colors.text, fontSize: 13, lineHeight: 20, marginTop: 7 },
  submissionStatus: { backgroundColor: colors.surfaceMuted, borderRadius: radius.md, padding: spacing.md, marginTop: 9, gap: 5 },
  statusTitle: { color: colors.text, fontWeight: "800", fontSize: 14 }, warning: { color: colors.warning, backgroundColor: "#F7EBD0", padding: 10, borderRadius: radius.sm, marginTop: 8 },
  rosterRow: { borderTopColor: colors.border, borderTopWidth: 1, paddingTop: 11, marginTop: 11 },
  rosterName: { color: colors.text, fontWeight: "800", fontSize: 14 }, actionRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  error: { color: colors.danger, fontSize: 12, lineHeight: 17, marginTop: 8 },
  list: { padding: spacing.lg, paddingBottom: 28 }, assignmentCard: { marginBottom: 10, padding: spacing.lg, backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border },
  assignmentHeader: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }, assignmentTitle: { flex: 1, color: colors.text, fontWeight: "800", fontSize: 15 },
  state: { alignItems: "center", justifyContent: "center", padding: spacing.xl, gap: 10 }, createBox: { maxHeight: 440, borderBottomWidth: 1, borderColor: colors.border, backgroundColor: colors.surface }, createContent: { padding: spacing.lg, paddingBottom: spacing.xl },
  offering: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: 11, marginBottom: 6, backgroundColor: colors.surface },
  offeringSelected: { borderColor: colors.primary, backgroundColor: colors.primarySoft }, offeringText: { color: colors.text, fontWeight: "700" }, selectedMark: { color: colors.primary, fontSize: 10, fontWeight: "900", marginTop: 3 }
});