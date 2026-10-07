import { authedBlobFetch, authedFetch } from "./auth";
import { buildQuery, Envelope, PagedEnvelope } from "./httpShared";

/**
 * Typed client for the examinations module.
 *
 * Keep all examination HTTP calls in this file so dashboard pages
 * do not duplicate endpoint construction or response handling.
 */

export interface ExamSession {
  id: string;
  name: string;
  code: string;
  examType: string;
  status: string;
  startDate: string;
  endDate: string;
  hallTicketReleaseAt: string | null;
  resultPublishedAt: string | null;
  instructions: string | null;
}

export interface ExamSchedule {
  id: string;
  examSessionId: string;
  courseOfferingId: string;
  examDate: string;
  startTime: string;
  endTime: string;
  maxMarks: number;
  passMarks: number;
  status: string;
  courseCode: string;
  courseName: string;
  sectionName: string | null;
  seatCount: number;
  markCount: number;
}

export interface ExamRoom {
  id: string;
  name: string;
  code: string;
  building: string | null;
  capacity: number;
  isActive: boolean;
}

export interface MarksRow {
  studentId: string;
  firstName: string;
  lastName: string;
  rollNumber: string | null;
  examAttendance: string | null;
  marksObtained: number | null;
  isAbsent: boolean;
  status: string;
  remarks: string | null;
}

export interface HallTicketView {
  session: ExamSession;
  ticket: {
    id: string;
    serialNumber: string;
    status: string;
    blockedReason: string | null;
    issuedAt: string;
  };
  papers: Array<{
    examScheduleId: string;
    examDate: string;
    startTime: string;
    endTime: string;
    seatNumber: string;
    roomName: string;
    building: string | null;
    courseCode: string;
    courseName: string;
  }>;
}

export async function listExamSessions(params: {
  page?: number;
  status?: string;
  search?: string;
}): Promise<{ items: ExamSession[]; total: number }> {
  const res = await authedFetch<PagedEnvelope<ExamSession>>(
    `/examinations/sessions${buildQuery(params)}`,
  );

  return {
    items: res.data,
    total: res.meta.total,
  };
}

export async function createExamSession(
  body: Record<string, unknown>,
): Promise<ExamSession> {
  const res = await authedFetch<Envelope<ExamSession>>(
    "/examinations/sessions",
    {
      method: "POST",
      body: JSON.stringify(body),
    },
  );

  return res.data;
}

export async function getExamSession(
  id: string,
): Promise<ExamSession & { schedules: ExamSchedule[] }> {
  const res = await authedFetch<
    Envelope<ExamSession & { schedules: ExamSchedule[] }>
  >(`/examinations/sessions/${id}`);

  return res.data;
}

export async function setSessionStatus(
  id: string,
  status: string,
): Promise<ExamSession> {
  const res = await authedFetch<Envelope<ExamSession>>(
    `/examinations/sessions/${id}/status`,
    {
      method: "PATCH",
      body: JSON.stringify({ status }),
    },
  );

  return res.data;
}

export async function listExamRooms(): Promise<ExamRoom[]> {
  const res = await authedFetch<Envelope<ExamRoom[]>>(
    "/examinations/rooms",
  );

  return res.data;
}

export async function createExamRoom(
  body: Record<string, unknown>,
): Promise<ExamRoom> {
  const res = await authedFetch<Envelope<ExamRoom>>(
    "/examinations/rooms",
    {
      method: "POST",
      body: JSON.stringify(body),
    },
  );

  return res.data;
}

export async function createExamSchedule(
  body: Record<string, unknown>,
): Promise<ExamSchedule> {
  const res = await authedFetch<Envelope<ExamSchedule>>(
    "/examinations/schedules",
    {
      method: "POST",
      body: JSON.stringify(body),
    },
  );

  return res.data;
}

export async function allocateSeating(
  scheduleId: string,
  roomIds: string[],
): Promise<{ seated: number; rooms: number }> {
  const res = await authedFetch<
    Envelope<{ seated: number; rooms: number }>
  >(`/examinations/schedules/${scheduleId}/seating`, {
    method: "POST",
    body: JSON.stringify({ roomIds }),
  });

  return res.data;
}

export async function assignInvigilators(
  scheduleId: string,
  assignments: Array<{
    facultyId: string;
    examRoomId: string;
    dutyRole?: string;
  }>,
): Promise<{ assigned: number }> {
  const res = await authedFetch<Envelope<{ assigned: number }>>(
    `/examinations/schedules/${scheduleId}/invigilators`,
    {
      method: "POST",
      body: JSON.stringify({ assignments }),
    },
  );

  return res.data;
}

export async function getMarksSheet(
  scheduleId: string,
): Promise<{
  schedule: ExamSchedule;
  rows: MarksRow[];
}> {
  const res = await authedFetch<
    Envelope<{
      schedule: ExamSchedule;
      rows: MarksRow[];
    }>
  >(`/examinations/schedules/${scheduleId}/marks`);

  return res.data;
}

export async function saveMarks(
  scheduleId: string,
  entries: Array<{
    studentId: string;
    marksObtained?: number | null;
    isAbsent?: boolean;
    remarks?: string;
  }>,
  submit: boolean,
): Promise<{ saved: number; status: string }> {
  const res = await authedFetch<
    Envelope<{
      saved: number;
      status: string;
    }>
  >(`/examinations/schedules/${scheduleId}/marks`, {
    method: "PUT",
    body: JSON.stringify({
      entries,
      submit,
    }),
  });

  return res.data;
}

export async function approveMarks(
  scheduleId: string,
): Promise<{ approved: number }> {
  const res = await authedFetch<
    Envelope<{ approved: number }>
  >(`/examinations/schedules/${scheduleId}/marks/approve`, {
    method: "POST",
  });

  return res.data;
}

export async function lockSchedule(
  scheduleId: string,
): Promise<ExamSchedule> {
  const res = await authedFetch<Envelope<ExamSchedule>>(
    `/examinations/schedules/${scheduleId}/lock`,
    {
      method: "POST",
    },
  );

  return res.data;
}

export async function publishResults(
  scheduleId: string,
): Promise<{ published: number }> {
  const res = await authedFetch<
    Envelope<{ published: number }>
  >(`/examinations/schedules/${scheduleId}/publish`, {
    method: "POST",
  });

  return res.data;
}

export async function generateHallTickets(
  sessionId: string,
): Promise<{ issued: number; blocked: number }> {
  const res = await authedFetch<
    Envelope<{
      issued: number;
      blocked: number;
    }>
  >(`/examinations/sessions/${sessionId}/hall-tickets`, {
    method: "POST",
  });

  return res.data;
}

export async function listStudentHallTickets(
  studentId: string,
): Promise<HallTicketView[]> {
  const res = await authedFetch<
    Envelope<HallTicketView[]>
  >(`/examinations/students/${studentId}/hall-tickets`);

  return res.data;
}

export async function getHallTicket(
  sessionId: string,
  studentId?: string,
): Promise<HallTicketView> {
  const res = await authedFetch<Envelope<HallTicketView>>(
    `/examinations/sessions/${sessionId}/hall-ticket${buildQuery({
      studentId,
    })}`,
  );

  return res.data;
}

export async function downloadHallTicketPdf(
  sessionId: string,
  studentId?: string,
): Promise<{ blob: Blob; filename: string }> {
  const response = await authedBlobFetch(
    `/examinations/sessions/${sessionId}/hall-ticket.pdf${buildQuery({ studentId })}`,
  );
  const blob = await response.blob();
  if (blob.size === 0) throw new Error("The generated admit card is empty.");
  if (blob.type && blob.type !== "application/pdf") {
    throw new Error("The server returned an invalid admit-card file.");
  }
  const disposition = response.headers.get("Content-Disposition") || "";
  const match = disposition.match(/filename="([^"]+)"/i);
  return { blob, filename: match?.[1] || "ACADLYX_AdmitCard.pdf" };
}

export function printHallTicket() {
  if (typeof window !== "undefined") {
    window.print();
  }
}

export async function recordExamAttendance(
  scheduleId: string,
  entries: Array<{
    studentId: string;
    status: string;
    bookletNumber?: string;
  }>,
): Promise<{ recorded: number }> {
  const res = await authedFetch<
    Envelope<{ recorded: number }>
  >(`/examinations/schedules/${scheduleId}/attendance`, {
    method: "POST",
    body: JSON.stringify({ entries }),
  });

  return res.data;
}

export async function listRevaluations(params: {
  status?: string;
  mine?: boolean;
  page?: number;
}): Promise<{
  items: Array<Record<string, unknown>>;
  total: number;
}> {
  const res = await authedFetch<
    PagedEnvelope<Record<string, unknown>>
  >(`/examinations/revaluations${buildQuery(params)}`);

  return {
    items: res.data,
    total: res.meta.total,
  };
}

export async function requestRevaluation(
  body: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const res = await authedFetch<
    Envelope<Record<string, unknown>>
  >("/examinations/revaluations", {
    method: "POST",
    body: JSON.stringify(body),
  });

  return res.data;
}

export async function decideRevaluation(
  id: string,
  body: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const res = await authedFetch<
    Envelope<Record<string, unknown>>
  >(`/examinations/revaluations/${id}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });

  return res.data;
}

export async function listIncidents(params: {
  status?: string;
  page?: number;
}): Promise<{
  items: Array<Record<string, unknown>>;
  total: number;
}> {
  const res = await authedFetch<
    PagedEnvelope<Record<string, unknown>>
  >(`/examinations/incidents${buildQuery(params)}`);

  return {
    items: res.data,
    total: res.meta.total,
  };
}

export async function reportIncident(
  body: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const res = await authedFetch<
    Envelope<Record<string, unknown>>
  >("/examinations/incidents", {
    method: "POST",
    body: JSON.stringify(body),
  });

  return res.data;
}

export async function decideIncident(
  id: string,
  body: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const res = await authedFetch<
    Envelope<Record<string, unknown>>
  >(`/examinations/incidents/${id}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });

  return res.data;
}

export async function getStudentExaminations(
  studentId: string,
): Promise<{
  upcoming: Array<Record<string, unknown>>;
  results: Array<Record<string, unknown>>;
}> {
  const res = await authedFetch<
    Envelope<{
      upcoming: Array<Record<string, unknown>>;
      results: Array<Record<string, unknown>>;
    }>
  >(`/examinations/students/${studentId}`);

  return res.data;
}

export async function listMyInvigilation(): Promise<
  Array<Record<string, unknown>>
> {
  const res = await authedFetch<
    Envelope<Array<Record<string, unknown>>>
  >("/examinations/my/invigilation");

  return res.data;
}


export async function listMyExamEligibility(): Promise<Array<{
  session: ExamSession & { registrationRequired: boolean; registrationStart: string | null; registrationEnd: string | null; examFee: number; registrationStatus: string };
  eligibility: { status: string; reasons: string[]; context: Record<string, unknown> };
  registration: { status: string; feeStatus: string; feeInvoiceId: string | null } | null;
}>> {
  const user = await (await import("./auth")).getCurrentUser();
  const res = await authedFetch<Envelope<Array<{
    session: ExamSession & { registrationRequired: boolean; registrationStart: string | null; registrationEnd: string | null; examFee: number; registrationStatus: string };
    eligibility: { status: string; reasons: string[]; context: Record<string, unknown> };
    registration: { status: string; feeStatus: string; feeInvoiceId: string | null } | null;
  }>>>(`/examinations/students/${user.id}/eligibility`);
  return res.data;
}

export async function registerForExam(sessionId: string) {
  const res = await authedFetch<Envelope<{
    id: string; examSessionId: string; studentId: string; status: string; feeStatus: string; feeInvoiceId: string | null;
  }>>(`/examinations/sessions/${sessionId}/registration`, { method: "POST" });
  return res.data;
}

export async function getMyExamPerformance() {
  const user = await (await import("./auth")).getCurrentUser();
  const res = await authedFetch<Envelope<Array<Record<string, unknown>>>>(
    `/examinations/students/${user.id}/performance`
  );
  return res.data;
}

export async function getMyPublishedExamResults() {
  const user = await (await import("./auth")).getCurrentUser();
  const res = await authedFetch<Envelope<Array<Record<string, unknown>>>>(
    `/examinations/students/${user.id}/results`
  );
  return res.data;
}
