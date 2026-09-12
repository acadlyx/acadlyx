/**
 * Mirrors backend/src/controllers/student.controller.ts's
 * GET /students/me/dashboard response shape.
 */

export interface InstitutionBranding {
  name: string;
  logoUrl: string | null;
  primaryColor: string | null;
  secondaryColor: string | null;
}

export interface StudentSummary {
  firstName: string;
  lastName: string;
  email: string;
  rollNumber: string | null;
}

export interface ProgramSummary {
  id: string;
  name: string;
  code: string;
  level: string;
}

export interface AcademicYearSummary {
  id: string;
  name: string;
  isCurrent: boolean;
}

export interface SemesterSummary {
  id: string;
  number: number;
  name: string;
}

export interface SectionSummary {
  id: string;
  name: string;
  semester: SemesterSummary;
}

export interface CourseSummary {
  id: string;
  code: string;
  name: string;
  credits: number;
}

export interface FacultySummary {
  id: string;
  firstName: string;
  lastName: string;
}

export interface CourseOfferingSummary {
  id: string;
  course: CourseSummary;
  faculty: FacultySummary | null;
}

/** time/room are placeholders until Phase 7 (Timetable) ships. */
export interface TodayClassSlot {
  time: string;
  courseCode: string;
  courseName: string;
  location: string;
  isDemoSchedule: true;
}

export interface AssignmentItem {
  id: string;
  courseCode: string;
  title: string;
  dueLabel: string;
  status: "pending" | "submitted" | "overdue";
}

export interface AnnouncementItem {
  id: string;
  title: string;
  postedLabel: string;
}

export interface UpcomingEventItem {
  id: string;
  title: string;
  whenLabel: string;
}

export interface AcademicHealth {
  attendance: number;
  assignments: number;
  internalMarks: number;
  engagement: number;
}

export type AcademicRisk = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export interface SubjectAttendance {
  courseOfferingId: string;
  courseCode: string;
  courseName: string;
  present: number;
  total: number;
  percentage: number;
}

export interface StudentDashboardData {
  institution: InstitutionBranding;
  student: StudentSummary;
  program: ProgramSummary | null;
  academicYear: AcademicYearSummary | null;
  section: SectionSummary | null;
  courseOfferings: CourseOfferingSummary[];

  attendancePercentage: number;
  subjectAttendance: SubjectAttendance[];
  todaysClasses: TodayClassSlot[];
  assignments: AssignmentItem[];
  announcements: AnnouncementItem[];
  upcomingEvents: UpcomingEventItem[];
  academicHealth: AcademicHealth;
  academicRisk: AcademicRisk;
  recommendations: string[];
}
