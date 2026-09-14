/**
 * Mirrors backend/src/controllers/faculty.controller.ts and
 * attendanceSession.controller.ts response shapes.
 */
import { CourseSummary } from "./dashboard";

export interface FacultyProgramSummary {
  id: string;
  name: string;
  code: string;
}

export interface FacultyAcademicYearSummary {
  id: string;
  name: string;
  isCurrent: boolean;
}

export interface FacultySemesterSummary {
  id: string;
  number: number;
  name: string;
  program: FacultyProgramSummary;
  academicYear: FacultyAcademicYearSummary;
}

export interface FacultySectionSummary {
  id: string;
  name: string;
}

export interface FacultyCourseOffering {
  id: string;
  course: CourseSummary;
  section: FacultySectionSummary;
  semester: FacultySemesterSummary;
}

export interface FacultyTodayClassSlot {
  time: string;
  courseCode: string;
  courseName: string;
  sectionName: string;
}

export interface AttendanceOverviewItem {
  courseOfferingId: string;
  courseCode: string;
  sectionName: string;
  rosterSize: number;
  presentCount: number;
  sessionId: string | null;
  isStarted: boolean;
  isSubmitted: boolean;
}

export interface PendingCounts {
  attendanceSessions: number;
  assignmentsToReview: number;
}

export interface AtRiskStudent {
  studentId: string;
  name: string;
  percentage: number;
}

export interface AssignmentSubmissionGap {
  courseCode: string;
  assignmentTitle: string;
  missingCount: number;
}

export interface SmartInsights {
  studentsBelowAttendanceThreshold: {
    count: number;
    students: AtRiskStudent[];
  };
  assignmentSubmissionGaps: AssignmentSubmissionGap[];
}

export interface FacultyDashboardData {
  faculty: { firstName: string; lastName: string; email: string };
  assignedCourseOfferings: FacultyCourseOffering[];
  attendanceOverview: AttendanceOverviewItem[];
  pending: PendingCounts;
  smartInsights: SmartInsights;
  todaysClassCount: number;
  todaysClasses: FacultyTodayClassSlot[];
}

export type AttendanceStatus = "PRESENT" | "ABSENT" | "LATE";

export interface RosterEntry {
  studentId: string;
  firstName: string;
  lastName: string;
  rollNumber: string | null;
  status: AttendanceStatus | null;
}

export interface AttendanceSessionData {
  id: string;
  sessionDate: string;
  isSubmitted: boolean;
  submittedAt: string | null;
  courseOffering: {
    id: string;
    course: { id: string; code: string; name: string };
    section: { id: string; name: string };
  };
  roster: RosterEntry[];
}
