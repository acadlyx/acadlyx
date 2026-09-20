import { authedFetch } from "./auth";
import { Envelope } from "./httpShared";

interface Named {
  id: string;
  name: string;
}

export interface StudentEnrollmentRecord {
  id: string;
  rollNumber: string | null;
  status: string;
  enrolledAt: string;
  program: Named & { code: string; level: string };
  academicYear: Named & { isCurrent: boolean };
  semester: (Named & { number: number }) | null;
  section: (Named & { capacity: number | null }) | null;
}

export interface StudentRecord {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  isActive: boolean;
  roles: Array<{ id: string; name: string }>;
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
    status: string;
  } | null;
  currentEnrollment: StudentEnrollmentRecord | null;
  enrollments: StudentEnrollmentRecord[];
}

export async function getStudent(id: string): Promise<StudentRecord> {
  const res = await authedFetch<Envelope<StudentRecord>>(`/students/${id}`);
  return res.data;
}

export async function getStudentEnrollments(
  id: string
): Promise<StudentEnrollmentRecord[]> {
  const res = await authedFetch<Envelope<StudentEnrollmentRecord[]>>(
    `/students/${id}/enrollments`
  );
  return res.data;
}
