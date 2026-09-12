/** Mirrors assignment/internal-mark backend response shapes (Phase 5). */

export type AssignmentStatus = "DRAFT" | "PUBLISHED";
export type SubmissionStatus = "SUBMITTED" | "LATE" | "REVIEWED";

export interface AssignmentSubmissionData {
  id: string;
  studentId: string;
  content: string | null;
  status: SubmissionStatus;
  submittedAt: string;
  marksAwarded: number | null;
  feedback: string | null;
  reviewedAt: string | null;
}

export interface AssignmentCourseOfferingRef {
  id: string;
  course: { id: string; code: string; name: string };
  section: { id: string; name: string };
}

export interface AssignmentData {
  id: string;
  title: string;
  description: string | null;
  dueDate: string;
  maxMarks: number;
  status: AssignmentStatus;
  courseOffering: AssignmentCourseOfferingRef;
  mySubmission?: AssignmentSubmissionData | null;
}

export interface RosterSubmissionRow {
  studentId: string;
  firstName: string;
  lastName: string;
  rollNumber: string | null;
  submission: AssignmentSubmissionData | null;
}

export interface InternalMarkEntry {
  id: string;
  component: string;
  marksObtained: number;
  maxMarks: number;
  courseOffering?: { id: string; course: { code: string; name: string } };
  student?: { id: string; firstName: string; lastName: string };
}

export interface SubjectAttendanceDetail {
  courseOfferingId: string;
  courseCode: string;
  courseName: string;
  present: number;
  total: number;
  percentage: number;
}

export interface AttendanceSummaryData {
  overallPercentage: number;
  totalSessions: number;
  totalPresent: number;
  subjects: SubjectAttendanceDetail[];
}
