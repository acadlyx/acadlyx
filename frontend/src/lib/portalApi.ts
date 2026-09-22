import { authedFetch } from "./auth";

interface ApiEnvelope<T> {
  success: boolean;
  data: T;
}

export interface PortalProfile {
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
  admissionDate: string | null;
  status: string;
}

export interface PortalEnrollment {
  id: string;
  program: {
    id: string;
    name: string;
    code: string;
    level?: string | null;
  };
  academicYear: {
    id: string;
    name: string;
    isCurrent: boolean;
    startDate?: string;
    endDate?: string;
  };
  section: {
    id: string;
    name: string;
    semester: {
      id: string;
      name: string;
      number: number;
    };
  } | null;
}

export interface PortalAttendance {
  total: number;
  present: number;
  absent: number;
  late: number;
  percentage: number;
  subjects: Array<{
    courseId: string;
    code: string;
    name: string;
    total: number;
    present: number;
    absent: number;
    late: number;
    percentage: number;
  }>;
}

export interface PortalMarkCourse {
  courseOfferingId: string;
  course: {
    id: string;
    code: string;
    name: string;
    credits: number;
  };
  components: Array<{
    id: string;
    component: string;
    marksObtained: number;
    maxMarks: number;
    percentage: number;
  }>;
  totalObtained: number;
  totalMax: number;
  percentage: number;
}

export interface PortalAssignment {
  id: string;
  title: string;
  description: string | null;
  dueDate: string;
  maxMarks: number;
  status: string;
  overdue: boolean;
  submission: {
    id: string;
    status: string;
    submittedAt: string;
    marksAwarded: number | null;
    feedback: string | null;
  } | null;
  course: {
    code: string;
    name: string;
  };
}

export interface PortalFee {
  id: string;
  title: string;
  amount: number;
  paid: number;
  balance: number;
  dueDate: string | null;
  status: string;
  payments: Array<{
    id: string;
    amount: number;
    reference: string | null;
    paidAt: string;
  }>;
}

export interface PortalExam {
  id: string;
  title: string;
  examDate: string;
  maxMarks: number;
  course: {
    id: string;
    code: string;
    name: string;
  };
  result: {
    id: string;
    marks: number;
    remarks: string | null;
    createdAt: string;
    updatedAt: string;
  } | null;
}

export interface PortalDocument {
  id: string;
  title: string;
  url: string;
  type: string;
  createdAt: string;
}

export interface PortalNotification {
  id: string;
  title: string;
  body: string;
  readAt: string | null;
  createdAt: string;
}

export interface StudentPortalData {
  student: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    phone: string | null;
    profile: PortalProfile | null;
  };
  enrollment: PortalEnrollment | null;
  attendance: PortalAttendance;
  marks: PortalMarkCourse[];
  assignments: PortalAssignment[];
  fees: PortalFee[];
  exams: PortalExam[];
  documents: PortalDocument[];
  notifications: {
    items: PortalNotification[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
    unread: number;
  };
}

export interface ParentChild {
  relationship: string | null;
  linkedAt: string;
  student: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    phone: string | null;
    profile: PortalProfile | null;
    enrollment: PortalEnrollment | null;
  };
}

export interface ParentDashboardData {
  parent: {
    id: string;
    institutionId: string | null;
    firstName: string;
    lastName: string;
    email: string;
    phone: string | null;
  };
  children: StudentPortalData[];
}

export async function getParentChildren(): Promise<ParentChild[]> {
  const response = await authedFetch<ApiEnvelope<ParentChild[]>>(
    "/portal/parent/children"
  );

  return response.data;
}

export async function getParentDashboard(): Promise<ParentDashboardData> {
  const response = await authedFetch<ApiEnvelope<ParentDashboardData>>(
    "/portal/parent/dashboard"
  );

  return response.data;
}

export async function getStudentPortal(
  studentId: string
): Promise<StudentPortalData> {
  const response = await authedFetch<ApiEnvelope<StudentPortalData>>(
    `/portal/students/${studentId}`
  );

  return response.data;
}

export async function getMyStudentPortal(): Promise<StudentPortalData> {
  const response = await authedFetch<ApiEnvelope<StudentPortalData>>("/portal/me");
  return response.data;
}

export async function getMyNotifications(
  page = 1,
  limit = 25,
  unreadOnly = false
) {
  const params = new URLSearchParams({
    page: String(page),
    limit: String(limit),
  });

  if (unreadOnly) {
    params.set("unreadOnly", "true");
  }

  const response = await authedFetch<
    ApiEnvelope<{
      items: PortalNotification[];
      pagination: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
      };
      unread: number;
    }>
  >(`/portal/notifications?${params.toString()}`);

  return response.data;
}

export async function markNotificationRead(
  notificationId: string,
  read = true
) {
  const response = await authedFetch<
    ApiEnvelope<PortalNotification>
  >(`/portal/notifications/${notificationId}`, {
    method: "PATCH",
    body: JSON.stringify({ read }),
  });

  return response.data;
}

export async function markAllNotificationsRead() {
  const response = await authedFetch<
    ApiEnvelope<{ updated: number }>
  >("/portal/notifications/read-all", {
    method: "POST",
  });

  return response.data;
}

export async function getMyDocuments(): Promise<PortalDocument[]> {
  const response = await authedFetch<ApiEnvelope<PortalDocument[]>>(
    "/portal/documents/me"
  );

  return response.data;
}

export async function getStudentDocuments(
  studentId: string
): Promise<PortalDocument[]> {
  const response = await authedFetch<ApiEnvelope<PortalDocument[]>>(
    `/portal/documents/students/${studentId}`
  );

  return response.data;
}
