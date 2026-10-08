import { authedFetch } from "./auth";

export type EnrollmentRequestStatus = "PENDING" | "APPROVED" | "REJECTED" | "NEEDS_CORRECTION" | "CANCELLED";

export interface EnrollmentContext {
  program: { id: string; name: string; code: string; department: { id: string; name: string; code: string } };
  academicYear: { id: string; name: string };
  semester: { id: string; name: string; number: number };
  sections: Array<{ id: string; name: string; capacity: number | null }>;
}

export interface EnrollmentSummary {\n  id: string;\n  program: { id: string; name: string; code: string; department: { id: string; name: string; code: string } };\n  academicYear: { id: string; name: string; isCurrent: boolean };\n  semester: { id: string; name: string; number: number };\n  section: { id: string; name: string } | null;\n}\n\nexport interface EnrollmentRequest {
  id: string;
  status: EnrollmentRequestStatus;
  createdAt: string;
  updatedAt: string;
  rejectionReason: string | null;
  correctionNote: string | null;
  program: { id: string; name: string; code: string; department: { id: string; name: string; code: string } };
  academicYear: { id: string; name: string; isCurrent: boolean };
  semester: { id: string; name: string; number: number };
  section: { id: string; name: string; capacity: number | null } | null;
  student?: { id: string; firstName: string; lastName: string; email: string; profile?: { admissionNumber: string; status: string } | null };
  decidedBy?: { id: string; firstName: string; lastName: string } | null;
}

export async function getMyEnrollmentWorkflow() {
  const res = await authedFetch<{ success: boolean; data: { state: string; enrollment: unknown; request: EnrollmentRequest | null; eligibleContexts?: EnrollmentContext[] } }>("/enrollment-requests/mine");
  return res.data;
}

export async function submitEnrollmentRequest(input: {
  programId: string; academicYearId: string; semesterId: string; sectionId?: string;
}) {
  const res = await authedFetch<{ success: boolean; data: EnrollmentRequest }>("/enrollment-requests", {
    method: "POST", body: JSON.stringify(input),
  });
  return res.data;
}

export async function listEnrollmentRequests(params: {
  status?: EnrollmentRequestStatus; search?: string; programId?: string; academicYearId?: string; semesterId?: string; sectionId?: string;
} = {}) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key,value]) => { if (value) query.set(key,value); });
  const res = await authedFetch<{ success: boolean; data: EnrollmentRequest[]; meta?: { total?: number } }>(`/enrollment-requests?${query.toString()}`);
  return { items: res.data ?? [], total: res.meta?.total ?? res.data?.length ?? 0 };
}

export async function decideEnrollmentRequest(id: string, decision: "APPROVED" | "REJECTED" | "NEEDS_CORRECTION", reason?: string) {
  const res = await authedFetch<{ success: boolean; data: EnrollmentRequest }>(`/enrollment-requests/${id}/decision`, {
    method: "POST", body: JSON.stringify({ decision, reason }),
  });
  return res.data;
}

export async function bulkDecideEnrollmentRequests(requestIds: string[], decision: "APPROVED" | "REJECTED" | "NEEDS_CORRECTION", reason?: string) {
  const res = await authedFetch<{ success: boolean; data: { requested: number; processed: number; skipped: number; results: Array<{ id: string; status: string; reason?: string }> } }>("/enrollment-requests/bulk-decision", {
    method: "POST", body: JSON.stringify({ requestIds, decision, reason }),
  });
  return res.data;
}
