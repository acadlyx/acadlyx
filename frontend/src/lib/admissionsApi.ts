import { authedFetch } from "./auth";

export const ADMISSION_STATUSES = [
  "APPLIED",
  "UNDER_REVIEW",
  "SHORTLISTED",
  "ACCEPTED",
  "REJECTED",
  "WITHDRAWN",
] as const;

export type AdmissionStatus =
  (typeof ADMISSION_STATUSES)[number];

export interface AdmissionApplication {
  id: string;
  institutionId: string;
  applicationNumber?: string | null;

  firstName: string;
  lastName: string;
  email: string;
  phone?: string | null;

  dateOfBirth?: string | null;
  gender?: string | null;
  address?: string | null;

  programId?: string | null;
  academicYearId?: string | null;

  status: AdmissionStatus | string;

  createdAt?: string;
  updatedAt?: string;

  program?: {
    id: string;
    name: string;
    code?: string | null;
  } | null;

  academicYear?: {
    id: string;
    name: string;
  } | null;
}

export interface ProgramOption {
  id: string;
  name: string;
  code?: string | null;
}

export interface AcademicYearOption {
  id: string;
  name: string;
  startDate?: string | null;
  endDate?: string | null;
}

interface ApiEnvelope<T> {
  success: boolean;
  data: T;
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
}

export interface CreateAdmissionApplicationInput {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  dateOfBirth?: string;
  gender?: string;
  address?: string;
  programId: string;
  academicYearId: string;
}

export interface ChangeAdmissionStatusInput {
  status: AdmissionStatus;
}

function unwrapList<T>(
  response: PaginatedEnvelope<T> | ApiEnvelope<T[]>,
): T[] {
  return response.data ?? [];
}

export async function listAdmissionApplications(): Promise<
  AdmissionApplication[]
> {
  const response = await authedFetch<
    PaginatedEnvelope<AdmissionApplication>
  >("/admissions?page=1&pageSize=200");

  return response.data ?? [];
}

export async function listProgramOptions(): Promise<
  ProgramOption[]
> {
  const response = await authedFetch<
    PaginatedEnvelope<ProgramOption> | ApiEnvelope<ProgramOption[]>
  >("/programs?page=1&pageSize=200");

  return unwrapList(response);
}

export async function listAcademicYearOptions(): Promise<
  AcademicYearOption[]
> {
  const response = await authedFetch<
    PaginatedEnvelope<AcademicYearOption> |
      ApiEnvelope<AcademicYearOption[]>
  >("/academic-years?page=1&pageSize=200");

  return unwrapList(response);
}

export async function createAdmissionApplication(
  input: CreateAdmissionApplicationInput,
): Promise<AdmissionApplication> {
  const response = await authedFetch<
    ApiEnvelope<AdmissionApplication>
  >("/admissions", {
    method: "POST",
    body: JSON.stringify(input),
  });

  return response.data;
}

export async function changeAdmissionStatus(
  id: string,
  status: AdmissionStatus,
): Promise<AdmissionApplication> {
  const response = await authedFetch<
    ApiEnvelope<AdmissionApplication>
  >(`/admissions/${id}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });

  return response.data;
}
