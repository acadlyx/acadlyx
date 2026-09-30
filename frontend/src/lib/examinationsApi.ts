import { authedFetch } from "./auth";
import { buildQuery, Envelope, PagedEnvelope } from "./httpShared";

/**
 * Typed client for the controlled examination workflow.
 *
 * Backend workflow:
 * session: DRAFT -> SCHEDULED -> ONGOING -> COMPLETED -> PUBLISHED
 * schedule: DRAFT -> PUBLISHED -> LOCKED -> RESULTS_PUBLISHED
 * marks: DRAFT -> SUBMITTED -> APPROVED -> PUBLISHED
 */

export type ExamSessionStatus =
  | "DRAFT"
  | "SCHEDULED"
  | "ONGOING"
  | "COMPLETED"
  | "PUBLISHED"
  | "CANCELLED";

export type ExamType =
  | "REGULAR"
  | "SUPPLEMENTARY"
  | "REVALUATION"
  | "IMPROVEMENT";

export type ExamScheduleStatus =
  | "DRAFT"
  | "PUBLISHED"
  | "LOCKED"
  | "RESULTS_PUBLISHED"
  | "CANCELLED";

export interface ExamSession {
  id: string;
  institutionId?: string;
  academicYearId?: string | null;
  semesterId?: string | null;
  name: string;
  code: string;
  examType: ExamType | string;
  status: ExamSessionStatus | string;
  startDate: string;
  endDate: string;
  hallTicketReleaseAt: string | null;
  resultPublishedAt: string | null;
  instructions: string | null;
}

export interface ExamSchedule {
  id: string;
  institutionId?: string;
  examSessionId: string;
  courseOfferingId: string;
  examDate: string;
  startTime: string;
  endTime: string;
  maxMarks: number;
  passMarks: number;
  status: ExamScheduleStatus | string;
  marksLockedAt?: string | null;
  marksLockedById?: string | null;
  resultsPublishedAt?: string | null;
  instructions?: string | null;
  legacyExamId?: string | null;
  createdById?: string;

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
  floor?: string | null;
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

export interface ExamScheduleDetail {
  schedule: ExamSchedule;

  offering: Record<string, unknown>;

  seats: Array<{
    studentId: string;
    seatNumber: string;
    roomName: string;
    firstName: string;
    lastName: string;
  }>;

  invigilators: Array<{
    facultyId: string;
    dutyRole: string;
    roomName: string;
    firstName: string;
    lastName: string;
  }>;

  attendance: Array<{
    studentId: string;
    status: string;
    bookletNumber: string | null;
  }>;
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

export async function listExamSessions(
  params: {
    page?: number;
    pageSize?: number;
    status?: string;
    examType?: string;
    search?: string;
  } = {},
): Promise<{
  items: ExamSession[];
  total: number;
}> {
  const res = await authedFetch<PagedEnvelope<ExamSession>>(
    `/examinations/sessions${buildQuery(params)}`,
  );

  return {
    items: res.data,
    total: res.meta.total,
  };
}

export async function createExamSession(body: {
  name: string;
  code: string;
  examType: ExamType;
  startDate: string;
  endDate: string;
  academicYearId?: string;
  semesterId?: string;
  hallTicketReleaseAt?: string;
  instructions?: string;
}): Promise<ExamSession> {
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

export async function updateExamSession(
  id: string,
  body: Partial<
    Pick<
      ExamSession,
      | "name"
      | "startDate"
      | "endDate"
      | "hallTicketReleaseAt"
      | "instructions"
    >
  >,
): Promise<ExamSession> {
  const res = await authedFetch<Envelope<ExamSession>>(
    `/examinations/sessions/${id}`,
    {
      method: "PATCH",
      body: JSON.stringify(body),
    },
  );

  return res.data;
}

export async function setSessionStatus(
  id: string,
  status: ExamSessionStatus,
): Promise<ExamSession> {
  const res = await authedFetch<Envelope<ExamSession>>(
    `/examinations/sessions/${id}/status`,
    {
      method: "PATCH",
      body: JSON.stringify({
        status,
      }),
    },
  );

  return res.data;
}

export async function listExamRooms(
  params: {
    includeInactive?: boolean;
    search?: string;
  } = {},
): Promise<ExamRoom[]> {
  const res = await authedFetch<Envelope<ExamRoom[]>>(
    `/examinations/rooms${buildQuery(params)}`,
  );

  return res.data;
}

export async function createExamRoom(body: {
  name: string;
  code: string;
  capacity: number;
  building?: string;
  floor?: string;
  rowCount?: number;
  columnCount?: number;
}): Promise<ExamRoom> {
  const res = await authedFetch<Envelope<ExamRoom>>(
    "/examinations/rooms",
    {
      method: "POST",
      body: JSON.stringify(body),
    },
  );

  return res.data;
}

export async function createExamSchedule(body: {
  examSessionId: string;
  courseOfferingId: string;
  examDate: string;
  startTime: string;
  endTime: string;
  maxMarks: number;
  passMarks: number;
  instructions?: string;
}): Promise<ExamSchedule> {
  const res = await authedFetch<Envelope<ExamSchedule>>(
    "/examinations/schedules",
    {
      method: "POST",
      body: JSON.stringify(body),
    },
  );

  return res.data;
}

export async function getExamScheduleDetail(
  scheduleId: string,
): Promise<ExamScheduleDetail> {
  const res = await authedFetch<Envelope<ExamScheduleDetail>>(
    `/examinations/schedules/${scheduleId}`,
  );

  return res.data;
}

export async function allocateSeating(
  scheduleId: string,
  roomIds: string[],
): Promise<{
  seated: number;
  rooms: number;
}> {
  const res = await authedFetch<
    Envelope<{
      seated: number;
      rooms: number;
    }>
  >(`/examinations/schedules/${scheduleId}/seating`, {
    method: "POST",
    body: JSON.stringify({
      roomIds,
    }),
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
): Promise<{
  assigned: number;
}> {
  const res = await authedFetch<
    Envelope<{
      assigned: number;
    }>
  >(`/examinations/schedules/${scheduleId}/invigilators`, {
    method: "POST",
    body: JSON.stringify({
      assignments,
    }),
  });

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
): Promise<{
  saved: number;
  status: string;
}> {
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
): Promise<{
  approved: number;
}> {
  const res = await authedFetch<
    Envelope<{
      approved: number;
    }>
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
): Promise<{
  published: number;
}> {
  const res = await authedFetch<
    Envelope<{
      published: number;
    }>
  >(`/examinations/schedules/${scheduleId}/publish`, {
    method: "POST",
  });

  return res.data;
}

export async function generateHallTickets(
  sessionId: string,
): Promise<{
  issued: number;
  blocked: number;
}> {
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

export async function recordExamAttendance(
  scheduleId: string,
  entries: Array<{
    studentId: string;
    status: string;
    bookletNumber?: string;
  }>,
): Promise<{
  recorded: number;
}> {
  const res = await authedFetch<
    Envelope<{
      recorded: number;
    }>
  >(`/examinations/schedules/${scheduleId}/attendance`, {
    method: "POST",
    body: JSON.stringify({
      entries,
    }),
  });

  return res.data;
}

export async function listRevaluations(
  params: {
    status?: string;
    mine?: boolean;
    page?: number;
  } = {},
): Promise<{
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
) {
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
) {
  const res = await authedFetch<
    Envelope<Record<string, unknown>>
  >(`/examinations/revaluations/${id}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });

  return res.data;
}

export async function listIncidents(
  params: {
    status?: string;
    page?: number;
  } = {},
): Promise<{
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
) {
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
) {
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
) {
  const res = await authedFetch<
    Envelope<{
      upcoming: Array<Record<string, unknown>>;
      results: Array<Record<string, unknown>>;
    }>
  >(`/examinations/students/${studentId}`);

  return res.data;
}

export async function listMyInvigilation() {
  const res = await authedFetch<
    Envelope<Array<Record<string, unknown>>>
  >("/examinations/my/invigilation");

  return res.data;
}
