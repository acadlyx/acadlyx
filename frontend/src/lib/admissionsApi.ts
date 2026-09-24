import { authedFetch } from "@/lib/auth";

export type AdmissionStatus =
  | "SUBMITTED"
  | "UNDER_REVIEW"
  | "DOCUMENTS_PENDING"
  | "SELECTED"
  | "ENROLLED"
  | "APPLIED"
  | "SHORTLISTED"
  | "ACCEPTED"
  | "REJECTED"
  | "WITHDRAWN";

export const ADMISSION_STATUSES: AdmissionStatus[] = [
  "SUBMITTED",
  "UNDER_REVIEW",
  "DOCUMENTS_PENDING",
  "SELECTED",
  "ENROLLED",
  "APPLIED",
  "SHORTLISTED",
  "ACCEPTED",
  "REJECTED",
  "WITHDRAWN",
];

export interface AdmissionApplication {
  id: string;
  institutionId?: string | null;

  applicationNumber?: string | null;

  firstName: string;
  lastName: string;
  email: string;
  phone?: string | null;

  dateOfBirth?: string | null;
  gender?: string | null;

  address?: string | null;
  city?: string | null;
  state?: string | null;
  postalCode?: string | null;

  programId?: string | null;
  academicYearId?: string | null;

  program?: {
    id: string;
    name: string;
    code?: string | null;
  } | null;

  academicYear?: {
    id: string;
    name: string;
  } | null;

  status: AdmissionStatus;

  notes?: string | null;

  createdAt?: string;
  updatedAt?: string;
}

export interface ProgramOption {
  id: string;
  name: string;
  code?: string | null;
}

export interface AcademicYearOption {
  id: string;
  name: string;
}

export interface CreateAdmissionApplicationInput {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;

  dateOfBirth?: string;
  gender?: string;

  address?: string;
  city?: string;
  state?: string;
  postalCode?: string;

  programId: string;
  academicYearId: string;

  notes?: string;
}

interface ApiEnvelope<T> {
  success: boolean;
  data: T;
  message?: string;
}

interface PaginatedEnvelope<T> {
  success: boolean;
  data: T[];
  meta?: {
    page?: number;
    pageSize?: number;
    total?: number;
    totalPages?: number;
  };
  message?: string;
}

export async function listAdmissionApplications(): Promise<
  AdmissionApplication[]
> {
  const res = await authedFetch<
    PaginatedEnvelope<AdmissionApplication>
  >("/admissions/applications?page=1&pageSize=200");

  return res.data;
}

export async function listProgramOptions(): Promise<ProgramOption[]> {
  const res = await authedFetch<
    ApiEnvelope<ProgramOption[]> | PaginatedEnvelope<ProgramOption>
  >("/admissions/programs");

  return res.data;
}

export async function listAcademicYearOptions(): Promise<
  AcademicYearOption[]
> {
  const res = await authedFetch<
    ApiEnvelope<AcademicYearOption[]> | PaginatedEnvelope<AcademicYearOption>
  >("/admissions/academic-years");

  return res.data;
}

export async function createAdmissionApplication(
  input: CreateAdmissionApplicationInput,
): Promise<AdmissionApplication> {
  const res = await authedFetch<ApiEnvelope<AdmissionApplication>>(
    "/admissions/applications",
    {
      method: "POST",
      body: JSON.stringify(input),
    },
  );

  return res.data;
}

export async function changeAdmissionStatus(
  id: string,
  status: AdmissionStatus,
): Promise<AdmissionApplication> {
  const res = await authedFetch<ApiEnvelope<AdmissionApplication>>(
    `/admissions/applications/${id}/status`,
    {
      method: "PATCH",
      body: JSON.stringify({ status }),
    },
  );

  return res.data;
}
