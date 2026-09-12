import { authedFetch } from "./auth";
import {
  AssignmentData,
  AttendanceSummaryData,
  InternalMarkEntry,
  RosterSubmissionRow,
} from "@/types/academics";

interface ApiEnvelope<T> {
  success: boolean;
  data: T;
}

// ---------- Student self-service ----------

export async function getMyAttendance(): Promise<AttendanceSummaryData> {
  const res = await authedFetch<ApiEnvelope<AttendanceSummaryData>>(
    "/students/me/attendance"
  );
  return res.data;
}

export async function getMyMarks(): Promise<InternalMarkEntry[]> {
  const res = await authedFetch<ApiEnvelope<InternalMarkEntry[]>>(
    "/students/me/marks"
  );
  return res.data;
}

export async function getMyAssignments(): Promise<AssignmentData[]> {
  const res = await authedFetch<ApiEnvelope<AssignmentData[]>>(
    "/students/me/assignments"
  );
  return res.data;
}

// ---------- Assignments (shared surface, role-scoped server-side) ----------

export async function listAssignments(params: {
  courseOfferingId?: string;
  status?: string;
}): Promise<AssignmentData[]> {
  const qs = new URLSearchParams();
  if (params.courseOfferingId) qs.set("courseOfferingId", params.courseOfferingId);
  if (params.status) qs.set("status", params.status);
  const res = await authedFetch<ApiEnvelope<AssignmentData[]>>(
    `/assignments?${qs.toString()}`
  );
  return res.data;
}

export async function getAssignment(id: string): Promise<AssignmentData> {
  const res = await authedFetch<ApiEnvelope<AssignmentData>>(`/assignments/${id}`);
  return res.data;
}

export async function createAssignment(input: {
  courseOfferingId: string;
  title: string;
  description?: string;
  dueDate: string;
  maxMarks: number;
  status?: "DRAFT" | "PUBLISHED";
}): Promise<AssignmentData> {
  const res = await authedFetch<ApiEnvelope<AssignmentData>>("/assignments", {
    method: "POST",
    body: JSON.stringify(input),
  });
  return res.data;
}

export async function updateAssignment(
  id: string,
  input: Partial<{ status: "DRAFT" | "PUBLISHED"; title: string; dueDate: string; maxMarks: number }>
): Promise<AssignmentData> {
  const res = await authedFetch<ApiEnvelope<AssignmentData>>(`/assignments/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
  return res.data;
}

export async function getAssignmentSubmissions(
  assignmentId: string
): Promise<RosterSubmissionRow[]> {
  const res = await authedFetch<ApiEnvelope<RosterSubmissionRow[]>>(
    `/assignments/${assignmentId}/submissions`
  );
  return res.data;
}

export async function submitMyAssignment(
  assignmentId: string,
  content: string
) {
  const res = await authedFetch<ApiEnvelope<unknown>>(
    `/assignments/${assignmentId}/submit`,
    { method: "POST", body: JSON.stringify({ content }) }
  );
  return res.data;
}

export async function reviewSubmission(
  assignmentId: string,
  studentId: string,
  input: { marksAwarded: number; feedback?: string }
) {
  const res = await authedFetch<ApiEnvelope<unknown>>(
    `/assignments/${assignmentId}/submissions/${studentId}`,
    { method: "PATCH", body: JSON.stringify(input) }
  );
  return res.data;
}

interface RosterMember {
  studentId: string;
  firstName: string;
  lastName: string;
  rollNumber: string | null;
}

export async function getCourseOfferingRoster(
  courseOfferingId: string
): Promise<RosterMember[]> {
  const res = await authedFetch<ApiEnvelope<RosterMember[]>>(
    `/course-offerings/${courseOfferingId}/roster`
  );
  return res.data;
}

// ---------- Internal marks ----------

export async function enterMarks(input: {
  courseOfferingId: string;
  component: string;
  maxMarks: number;
  records: { studentId: string; marksObtained: number }[];
}): Promise<InternalMarkEntry[]> {
  const res = await authedFetch<ApiEnvelope<InternalMarkEntry[]>>("/internal-marks", {
    method: "POST",
    body: JSON.stringify(input),
  });
  return res.data;
}

export async function listMarksForOffering(
  courseOfferingId: string
): Promise<InternalMarkEntry[]> {
  const res = await authedFetch<ApiEnvelope<InternalMarkEntry[]>>(
    `/internal-marks?courseOfferingId=${courseOfferingId}`
  );
  return res.data;
}
