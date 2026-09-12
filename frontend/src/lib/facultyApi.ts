import { authedFetch } from "./auth";
import {
  AttendanceSessionData,
  AttendanceStatus,
  FacultyCourseOffering,
  FacultyDashboardData,
} from "@/types/faculty";

interface ApiEnvelope<T> {
  success: boolean;
  data: T;
}

export async function getMyFacultyDashboard(): Promise<FacultyDashboardData> {
  const res = await authedFetch<ApiEnvelope<FacultyDashboardData>>(
    "/faculty/me/dashboard"
  );
  return res.data;
}

export async function getMyFacultyCourseOfferings(): Promise<FacultyCourseOffering[]> {
  const res = await authedFetch<ApiEnvelope<FacultyCourseOffering[]>>(
    "/faculty/me/course-offerings"
  );
  return res.data;
}

/** Get-or-create today's (or a given date's) attendance session + roster. */
export async function openAttendanceSession(
  courseOfferingId: string,
  sessionDate: string // YYYY-MM-DD
): Promise<AttendanceSessionData> {
  const res = await authedFetch<ApiEnvelope<AttendanceSessionData>>(
    "/attendance-sessions",
    {
      method: "POST",
      body: JSON.stringify({ courseOfferingId, sessionDate }),
    }
  );
  return res.data;
}

export async function getAttendanceSession(
  sessionId: string
): Promise<AttendanceSessionData> {
  const res = await authedFetch<ApiEnvelope<AttendanceSessionData>>(
    `/attendance-sessions/${sessionId}`
  );
  return res.data;
}

export async function submitAttendanceRecords(
  sessionId: string,
  records: { studentId: string; status: AttendanceStatus }[],
  submit: boolean
): Promise<AttendanceSessionData> {
  const res = await authedFetch<ApiEnvelope<AttendanceSessionData>>(
    `/attendance-sessions/${sessionId}/records`,
    {
      method: "PATCH",
      body: JSON.stringify({ records, submit }),
    }
  );
  return res.data;
}
