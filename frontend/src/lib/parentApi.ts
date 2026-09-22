import { authedFetch } from "./auth";
import { Envelope } from "./httpShared";

/**
 * Parent portal client. Every call carries the child's id and the
 * backend re-verifies the parent-child link on each request.
 */

export interface ChildSummary {
  studentId: string;
  name: string;
  email: string;
  isActive: boolean;
  relationship: string | null;
  enrollment: {
    rollNumber: string | null;
    program: { name: string; code: string } | null;
    section: { name: string } | null;
    semester: { name: string; number: number } | null;
  } | null;
  attendance: {
    percentage: number | null;
    level: string;
    requiredPercentage: number;
  };
  outstandingFees: number;
}

export async function listMyChildren(): Promise<ChildSummary[]> {
  const res = await authedFetch<Envelope<ChildSummary[]>>("/parent/children");
  return res.data;
}

export async function getChildOverview(studentId: string) {
  const res = await authedFetch<Envelope<Record<string, unknown>>>(
    `/parent/children/${studentId}`
  );
  return res.data;
}

export async function getChildAttendance(studentId: string) {
  const res = await authedFetch<Envelope<Record<string, unknown>>>(
    `/parent/children/${studentId}/attendance`
  );
  return res.data;
}

export async function getChildResults(studentId: string) {
  const res = await authedFetch<Envelope<Record<string, unknown>>>(
    `/parent/children/${studentId}/results`
  );
  return res.data;
}

export async function getChildFees(studentId: string) {
  const res = await authedFetch<Envelope<Record<string, unknown>>>(
    `/parent/children/${studentId}/fees`
  );
  return res.data;
}

export async function getChildCoursework(studentId: string) {
  const res = await authedFetch<Envelope<Record<string, unknown>>>(
    `/parent/children/${studentId}/coursework`
  );
  return res.data;
}

export async function getChildCalendar(studentId: string) {
  const res = await authedFetch<Envelope<Record<string, unknown>>>(
    `/parent/children/${studentId}/calendar`
  );
  return res.data;
}

export async function getChildNotices(studentId: string) {
  const res = await authedFetch<Envelope<Record<string, unknown>>>(
    `/parent/children/${studentId}/notices`
  );
  return res.data;
}

export async function acknowledgeAlert(alertId: string) {
  const res = await authedFetch<Envelope<{ acknowledged: boolean }>>(
    `/parent/alerts/${alertId}/acknowledge`,
    { method: "POST" }
  );
  return res.data;
}
