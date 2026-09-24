import { authedFetch } from "@/lib/auth";

export type AdmissionStatus =
| "SUBMITTED"
| "UNDER_REVIEW"
| "DOCUMENTS_PENDING"
| "SELECTED"
| "ENROLLED"
| "REJECTED"
| "WITHDRAWN";

export const ADMISSION_STATUSES: AdmissionStatus[] = [
"SUBMITTED",
"UNDER_REVIEW",
"DOCUMENTS_PENDING",
"SELECTED",
"ENROLLED",
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

guardianName?: string | null;
guardianPhone?: string | null;

previousInstitution?: string | null;
previousPercentage?: number | null;

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

remarks?: string | null;
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

guardianName?: string;
guardianPhone?: string;

previousInstitution?: string;
previousPercentage?: number;

remarks?: string;

address?: string;
city?: string;
state?: string;
postalCode?: string;

programId: string;
academicYearId: string;
}

export interface ListAdmissionApplicationsParams {
page?: number;
pageSize?: number;
search?: string;
status?: AdmissionStatus;
programId?: string;
academicYearId?: string;
}

export interface AdmissionSummary {
[key: string]: number;
}

export interface AdmissionListResult {
items: AdmissionApplication[];
summary: AdmissionSummary;
page: number;
pageSize: number;
total: number;
totalPages: number;
}

interface ApiEnvelope<T> {
success: boolean;
data: T;
message?: string;
}

interface PaginatedEnvelope<T> {
success: boolean;
data: T[];
summary?: AdmissionSummary;
meta?: {
page?: number;
pageSize?: number;
total?: number;
totalPages?: number;
};
message?: string;
}

function buildQuery(
params: ListAdmissionApplicationsParams = {},
): string {
const searchParams = new URLSearchParams();

if (params.page !== undefined) {
searchParams.set("page", String(params.page));
}

if (params.pageSize !== undefined) {
searchParams.set("pageSize", String(params.pageSize));
}

if (params.search) {
searchParams.set("search", params.search);
}

if (params.status) {
searchParams.set("status", params.status);
}

if (params.programId) {
searchParams.set("programId", params.programId);
}

if (params.academicYearId) {
searchParams.set("academicYearId", params.academicYearId);
}

const query = searchParams.toString();

return query ? `?${query}` : "";
}

export async function listAdmissionApplications(
params: ListAdmissionApplicationsParams = {},
): Promise<AdmissionListResult> {
const page = params.page ?? 1;
const pageSize = params.pageSize ?? 20;

const res = await authedFetch<
PaginatedEnvelope<AdmissionApplication>

> (`/admissions${buildQuery({
>     ...params,
>     page,
>     pageSize,
>   })}`);

const meta = res.meta ?? {};

return {
items: res.data ?? [],
summary: res.summary ?? {},
page: meta.page ?? page,
pageSize: meta.pageSize ?? pageSize,
total: meta.total ?? res.data.length,
totalPages: meta.totalPages ?? 1,
};
}

export async function listProgramOptions(): Promise<ProgramOption[]> {
const res = await authedFetch<
PaginatedEnvelope<ProgramOption>

> ("/programs?page=1&pageSize=100");

return res.data ?? [];
}

export async function listAcademicYearOptions(): Promise<
AcademicYearOption[]

> {
> const res = await authedFetch<
> PaginatedEnvelope<AcademicYearOption>
> ("/academic-years?page=1&pageSize=100");

return res.data ?? [];
}

export async function createAdmissionApplication(
input: CreateAdmissionApplicationInput,
): Promise<AdmissionApplication> {
const res = await authedFetch<ApiEnvelope<AdmissionApplication>>(
"/admissions",
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
remarks?: string,
): Promise<AdmissionApplication> {
const res = await authedFetch<ApiEnvelope<AdmissionApplication>>(
`/admissions/${id}/status`,
{
method: "POST",
body: JSON.stringify({
status,
...(remarks ? { remarks } : {}),
}),
},
);

return res.data;
}
