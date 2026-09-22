import { authedFetch } from "./auth";
import { buildQuery, Envelope, PagedEnvelope, PageMeta } from "./httpShared";

export const MOVEMENT_TYPES = [
  "PROMOTION",
  "SECTION_TRANSFER",
  "PROGRAM_TRANSFER",
] as const;
export type MovementType = (typeof MOVEMENT_TYPES)[number];

export const MOVEMENT_STATUSES = ["PENDING", "APPROVED", "REJECTED"] as const;
export type MovementStatus = (typeof MOVEMENT_STATUSES)[number];

interface Named {
  id: string;
  name: string;
}

export interface MovementRequest {
  id: string;
  requestType: MovementType;
  status: MovementStatus;
  reason: string | null;
  decisionNote: string | null;
  decidedAt: string | null;
  createdAt: string;
  student: { id: string; firstName: string; lastName: string; email: string };
  fromEnrollment: {
    id: string;
    rollNumber: string | null;
    status: string;
    program: Named;
    academicYear: Named;
    semester: Named | null;
    section: Named | null;
  } | null;
  targetProgram: Named | null;
  targetAcademicYear: Named | null;
  targetSection: Named | null;
}

export interface PromotionCandidate {
  id: string;
  rollNumber: string | null;
  user: { id: string; firstName: string; lastName: string; email: string };
  program: Named;
  academicYear: Named;
  section: Named | null;
}

export async function listMovementRequests(params: {
  page?: number;
  status?: MovementStatus;
  requestType?: MovementType;
  studentId?: string;
  search?: string;
} = {}): Promise<{
  items: MovementRequest[];
  summary: Record<string, number>;
  meta: PageMeta;
}> {
  const res = await authedFetch<
    PagedEnvelope<MovementRequest> & { summary: Record<string, number> }
  >(`/movements/requests${buildQuery(params as Record<string, string | number | undefined>)}`);
  return { items: res.data, summary: res.summary ?? {}, meta: res.meta };
}

export async function listPromotionCandidates(params: {
  academicYearId?: string;
  programId?: string;
  sectionId?: string;
} = {}): Promise<PromotionCandidate[]> {
  const res = await authedFetch<Envelope<PromotionCandidate[]>>(
    `/movements/candidates${buildQuery(params)}`
  );
  return res.data;
}

export async function createMovementRequest(input: {
  studentId: string;
  requestType: MovementType;
  targetProgramId?: string;
  targetAcademicYearId?: string;
  targetSemesterId?: string;
  targetSectionId?: string;
  reason?: string;
}): Promise<MovementRequest> {
  const res = await authedFetch<Envelope<MovementRequest>>(
    "/movements/requests",
    { method: "POST", body: JSON.stringify(input) }
  );
  return res.data;
}

export async function bulkPromote(input: {
  studentIds: string[];
  targetAcademicYearId: string;
  targetSemesterId?: string;
  targetSectionId?: string;
  reason?: string;
}): Promise<{
  created: number;
  failed: number;
  results: Array<{ studentId: string; ok: boolean; message?: string }>;
}> {
  const res = await authedFetch<
    Envelope<{
      created: number;
      failed: number;
      results: Array<{ studentId: string; ok: boolean; message?: string }>;
    }>
  >("/movements/requests/bulk-promotion", {
    method: "POST",
    body: JSON.stringify(input),
  });
  return res.data;
}

export async function decideMovement(
  id: string,
  decision: "APPROVED" | "REJECTED",
  note?: string
): Promise<MovementRequest> {
  const res = await authedFetch<Envelope<MovementRequest>>(
    `/movements/requests/${id}/decision`,
    { method: "POST", body: JSON.stringify({ decision, note }) }
  );
  return res.data;
}

export async function getStudentMovementHistory(studentId: string): Promise<{
  enrollments: Array<{
    id: string;
    status: string;
    rollNumber: string | null;
    enrolledAt: string;
    program: Named;
    academicYear: Named;
    semester: Named | null;
    section: Named | null;
  }>;
  requests: MovementRequest[];
}> {
  const res = await authedFetch<
    Envelope<{
      enrollments: Array<{
        id: string;
        status: string;
        rollNumber: string | null;
        enrolledAt: string;
        program: Named;
        academicYear: Named;
        semester: Named | null;
        section: Named | null;
      }>;
      requests: MovementRequest[];
    }>
  >(`/movements/students/${studentId}/history`);
  return res.data;
}

export async function listSectionOptions(): Promise<
  Array<{ id: string; name: string; capacity: number | null }>
> {
  const res = await authedFetch<
    PagedEnvelope<{ id: string; name: string; capacity: number | null }>
  >("/sections?pageSize=100");
  return res.data;
}
