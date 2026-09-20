import { authedFetch } from "./auth";

interface ApiEnvelope<T> {
  success: boolean;
  data: T;
}

interface PaginatedEnvelope<T> {
  success: boolean;
  data: T[];
  summary: Record<string, number>;
  meta: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

export const ADMISSION_STATUSES = [
  "SUBMITTED",
  "UNDER_REVIEW",
  "DOCUMENTS_PENDING",
  "SELECTED",
  "REJECTED",
  "ENROLLED",
  "WITHDRAWN",
] as const;

export type AdmissionStatus = (typeof ADMISSION_STATUSES)[number];

export interface AdmissionApplication {
  id: string;
  applicationNumber: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  dateOfBirth: string | null;
  gender: string | null;
  guardianName: string | null;
  guardianPhone: string | null;
  previousInstitution: string | null;
  previousPercentage: number | null;
  remarks: string | null;
  status: AdmissionStatus;
  programId: string;
  academicYearId: string;
  program: { id: string; name: string; code: string };
  academicYear: { id: string; name: string };
  createdAt: string;
}

export interface CreateAdmissionInput {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  dateOfBirth?: string;
  gender?: string;
  guardianName?: string;
  guardianPhone?: string;
  previousInstitution?: string;
  previousPercentage?: number;
  remarks?: string;
  programId: string;
  academicYearId: string;
}

export interface AdmissionListParams {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: AdmissionStatus;
  programId?: string;
  academicYearId?: string;
}

export interface AdmissionListResult {
  items: AdmissionApplication[];
  total: number;
  totalPages: number;
  page: number;
  pageSize: number;
  summary: Record<string, number>;
}

function buildQuery(params: Record<string, string | number | undefined>): string {
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") qs.set(key, String(value));
  }
  const s = qs.toString();
  return s ? `?${s}` : "";
}

export async function listAdmissionApplications(
  params: AdmissionListParams = {}
): Promise<AdmissionListResult> {
  const query = buildQuery({
    page: params.page,
    pageSize: params.pageSize,
    search: params.search,
    status: params.status,
    programId: params.programId,
    academicYearId: params.academicYearId,
  });
  const res = await authedFetch<PaginatedEnvelope<AdmissionApplication>>(
    `/admissions${query}`
  );
  return {
    items: res.data,
    total: res.meta.total,
    totalPages: res.meta.totalPages,
    page: res.meta.page,
    pageSize: res.meta.pageSize,
    summary: res.summary,
  };
}

export async function getAdmissionApplication(id: string): Promise<AdmissionApplication> {
  const res = await authedFetch<ApiEnvelope<AdmissionApplication>>(`/admissions/${id}`);
  return res.data;
}

export async function createAdmissionApplication(
  input: CreateAdmissionInput
): Promise<AdmissionApplication> {
  const res = await authedFetch<ApiEnvelope<AdmissionApplication>>("/admissions", {
    method: "POST",
    body: JSON.stringify(input),
  });
  return res.data;
}

export async function updateAdmissionApplication(
  id: string,
  input: Partial<CreateAdmissionInput>
): Promise<AdmissionApplication> {
  const res = await authedFetch<ApiEnvelope<AdmissionApplication>>(`/admissions/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
  return res.data;
}

export async function changeAdmissionStatus(
  id: string,
  status: AdmissionStatus,
  remarks?: string
): Promise<AdmissionApplication> {
  const res = await authedFetch<ApiEnvelope<AdmissionApplication>>(
    `/admissions/${id}/status`,
    {
      method: "POST",
      body: JSON.stringify({ status, remarks }),
    }
  );
  return res.data;
}

export async function enrollAdmissionApplicant(
  id: string,
  input: {
    admissionNumber: string;
    password: string;
    semesterId: string;
    sectionId?: string;
    rollNumber?: string;
  }
): Promise<AdmissionApplication> {
  const res = await authedFetch<ApiEnvelope<AdmissionApplication>>(
    `/admissions/${id}/enroll`,
    {
      method: "POST",
      body: JSON.stringify(input),
    }
  );
  return res.data;
}

// ---------- Lightweight lookups for the create/edit form ----------

export interface ProgramOption {
  id: string;
  name: string;
  code: string;
}

export interface AcademicYearOption {
  id: string;
  name: string;
  isCurrent?: boolean;
}

export async function listProgramOptions(): Promise<ProgramOption[]> {
  const res = await authedFetch<PaginatedEnvelope<ProgramOption>>(
    "/programs?pageSize=100&isActive=true"
  );
  return res.data;
}

export async function listAcademicYearOptions(): Promise<AcademicYearOption[]> {
  const res = await authedFetch<PaginatedEnvelope<AcademicYearOption>>(
    "/academic-years?pageSize=100"
  );
  return res.data;
}
