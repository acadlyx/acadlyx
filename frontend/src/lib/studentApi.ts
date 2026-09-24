import { authedFetch } from "./auth";
import { StudentDashboardData } from "@/types/dashboard";

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

export type StudentTimetableEntry = {
id: string;
dayOfWeek: number;
startTime: string;
endTime: string;
room: string | null;
course: {
code: string;
name: string;
};
faculty: string | null;
};

export type ManagedStudent = {
id: string;
institutionId: string | null;
email: string;
firstName: string;
lastName: string;
phone: string | null;
isActive: boolean;
createdAt?: string;

roles: Array<{
id: string;
name: string;
description?: string | null;
}>;

profile: {
admissionNumber: string;
dateOfBirth: string | null;
gender: string | null;
bloodGroup: string | null;
nationality: string | null;
address: string | null;
city: string | null;
state: string | null;
postalCode: string | null;
guardianName: string | null;
guardianPhone: string | null;
guardianEmail: string | null;
emergencyContactName: string | null;
emergencyContactPhone: string | null;
admissionDate: string | null;
status:
| "ACTIVE"
| "INACTIVE"
| "GRADUATED"
| "WITHDRAWN"
| "TRANSFERRED";
} | null;

enrollments: Array<{
id: string;
status: string;
rollNumber: string | null;
academicYearId: string;
programId: string;
semesterId: string;
sectionId: string | null;
}>;

currentEnrollment: {
id: string;
status: string;
rollNumber: string | null;
academicYearId: string;
programId: string;
semesterId: string;
sectionId: string | null;
} | null;
};

export type CreateManagedStudentInput = {
email: string;
firstName: string;
lastName: string;
phone?: string;
password: string;

admissionNumber: string;
dateOfBirth?: string;
gender?: string;
bloodGroup?: string;
nationality?: string;
address?: string;
city?: string;
state?: string;
postalCode?: string;

guardianName?: string;
guardianPhone?: string;
guardianEmail?: string;

emergencyContactName?: string;
emergencyContactPhone?: string;

admissionDate?: string;

status?:
| "ACTIVE"
| "INACTIVE"
| "GRADUATED"
| "WITHDRAWN"
| "TRANSFERRED";

programId: string;
academicYearId: string;
semesterId: string;
sectionId?: string;
rollNumber?: string;
};

export async function getMyDashboard(): Promise<StudentDashboardData> {
const res =
await authedFetch<ApiEnvelope<StudentDashboardData>>(
"/students/me/dashboard",
);

return res.data;
}

export async function getMyTimetable(): Promise<
StudentTimetableEntry[]

> {
> const res =
> await authedFetch<
> ApiEnvelope<StudentTimetableEntry[]>
> >("/students/me/timetable");

return res.data;
}

/**

* Institution-scoped student administration.
*
* The backend derives institutionId from the authenticated user.
* Never send institutionId from the browser.
  */
  export async function listManagedStudents(
  params: {
  search?: string;
  status?: string;
  academicYearId?: string;
  programId?: string;
  semesterId?: string;
  sectionId?: string;
  page?: number;
  pageSize?: number;
  } = {},
  ): Promise<{
  items: ManagedStudent[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  }> {
  const query = new URLSearchParams();

query.set(
"page",
String(params.page || 1),
);

query.set(
"pageSize",
String(params.pageSize || 100),
);

if (params.search?.trim()) {
query.set(
"search",
params.search.trim(),
);
}

if (params.status) {
query.set(
"status",
params.status,
);
}

if (params.academicYearId) {
query.set(
"academicYearId",
params.academicYearId,
);
}

if (params.programId) {
query.set(
"programId",
params.programId,
);
}

if (params.semesterId) {
query.set(
"semesterId",
params.semesterId,
);
}

if (params.sectionId) {
query.set(
"sectionId",
params.sectionId,
);
}

const res =
await authedFetch<
PaginatedEnvelope<ManagedStudent>
>(`/students?${query.toString()}`);

const meta = res.meta || {};

const page = Number(
meta.page ||
params.page ||
1,
);

const pageSize = Number(
meta.pageSize ||
params.pageSize ||
100,
);

const total = Number(
meta.total ||
res.data.length,
);

const totalPages = Number(
meta.totalPages ||
Math.max(
1,
Math.ceil(
total / pageSize,
),
),
);

return {
items: res.data,
total,
page,
pageSize,
totalPages,
};
}

export async function getManagedStudent(
id: string,
): Promise<ManagedStudent> {
const res =
await authedFetch<
ApiEnvelope<ManagedStudent>
>(`/students/${id}`);

return res.data;
}

export async function createManagedStudent(
input: CreateManagedStudentInput,
): Promise<ManagedStudent> {
const res =
await authedFetch<
ApiEnvelope<ManagedStudent>
>("/students", {
method: "POST",
body: JSON.stringify({
...input,
status:
input.status || "ACTIVE",
}),
});

return res.data;
}

export async function updateManagedStudent(
id: string,
input: Partial<
Omit<
CreateManagedStudentInput,
| "password"
| "programId"
| "academicYearId"
| "semesterId"
| "sectionId"
>

> ,
> ): Promise<ManagedStudent> {
> const res =
> await authedFetch<
> ApiEnvelope<ManagedStudent>
> >(`/students/${id}`, {
> method: "PATCH",
> body: JSON.stringify(input),
> });

return res.data;
}

export async function enrollManagedStudent(
id: string,
input: {
academicYearId: string;
programId: string;
semesterId: string;
sectionId?: string;
rollNumber?: string;
status?:
| "ACTIVE"
| "COMPLETED"
| "DROPPED"
| "TRANSFERRED";
},
) {
const res =
await authedFetch<
ApiEnvelope<unknown>
>(`/students/${id}/enrollments`, {
method: "POST",
body: JSON.stringify({
...input,
status:
input.status || "ACTIVE",
}),
});

return res.data;
}
