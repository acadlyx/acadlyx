import { AuthRequiredError } from "@/lib/auth";
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

export type StudentStatus =
  | "ACTIVE"
  | "INACTIVE"
  | "GRADUATED"
  | "WITHDRAWN"
  | "TRANSFERRED";

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
    status: StudentStatus;
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
  status?: StudentStatus;

  programId: string;
  academicYearId: string;
  semesterId: string;
  sectionId?: string;
  rollNumber?: string;
};

export async function getMyDashboard(): Promise<StudentDashboardData> {
  const res = await authedFetch<ApiEnvelope<StudentDashboardData>>(
    "/students/me/dashboard",
  );

  return res.data;
}

export async function getMyTimetable(): Promise<
  StudentTimetableEntry[]
> {
  const res = await authedFetch<
    ApiEnvelope<StudentTimetableEntry[]>
  >("/students/me/timetable");

  return res.data;
}

export async function listManagedStudents(): Promise<ManagedStudent[]> {
  const res = await authedFetch<PaginatedEnvelope<ManagedStudent>>(
    "/students?page=1&pageSize=200",
  );

  return res.data;
}

export async function getManagedStudent(
  id: string,
): Promise<ManagedStudent> {
  const res = await authedFetch<ApiEnvelope<ManagedStudent>>(
    `/students/${id}`,
  );

  return res.data;
}

export async function createManagedStudent(
  input: CreateManagedStudentInput,
): Promise<ManagedStudent> {
  const res = await authedFetch<ApiEnvelope<ManagedStudent>>(
    "/students",
    {
      method: "POST",
      body: JSON.stringify(input),
    },
  );

  return res.data;
}

export async function updateManagedStudent(
  id: string,
  input: Partial<CreateManagedStudentInput>,
): Promise<ManagedStudent> {
  const res = await authedFetch<ApiEnvelope<ManagedStudent>>(
    `/students/${id}`,
    {
      method: "PATCH",
      body: JSON.stringify(input),
    },
  );

  return res.data;
}

export async function setManagedStudentStatus(
  id: string,
  status: StudentStatus,
): Promise<ManagedStudent> {
  const res = await authedFetch<ApiEnvelope<ManagedStudent>>(
    `/students/${id}/status`,
    {
      method: "PATCH",
      body: JSON.stringify({
        status,
      }),
    },
  );

  return res.data;
}
