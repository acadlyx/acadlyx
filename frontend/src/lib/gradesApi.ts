import { authedFetch } from "./auth";
import { Envelope } from "./httpShared";

export interface GradeComponent {
  kind: "INTERNAL" | "EXAM";
  name: string;
  marksObtained: number;
  maxMarks: number;
}

export interface CourseGrade {
  courseOfferingId: string;
  courseCode: string;
  courseName: string;
  credits: number;
  semesterName: string;
  semesterNumber: number;
  academicYearName: string;
  internalPercentage: number | null;
  examPercentage: number | null;
  percentage: number | null;
  letter: string | null;
  gradePoints: number | null;
  passed: boolean | null;
  components: GradeComponent[];
}

export interface SemesterResult {
  semesterId: string;
  semesterName: string;
  semesterNumber: number;
  academicYearName: string;
  credits: number;
  creditsEarned: number;
  sgpa: number | null;
  courses: CourseGrade[];
}

export interface Transcript {
  studentId: string;
  semesters: SemesterResult[];
  totalCredits: number;
  creditsEarned: number;
  cgpa: number | null;
  percentageEquivalent: number | null;
}

export interface GradeSheetRow {
  studentId: string;
  name: string;
  email: string;
  rollNumber: string | null;
  internalPercentage: number | null;
  examPercentage: number | null;
  percentage: number | null;
  letter: string | null;
  gradePoints: number | null;
  passed: boolean | null;
}

export interface GradeSheet {
  offering: {
    id: string;
    course: { code: string; name: string; credits: number };
    section: { name: string };
    semester: { name: string };
  };
  rows: GradeSheetRow[];
  distribution: Record<string, number>;
  classAverage: number | null;
}

export interface GradeScale {
  bands: Array<{ letter: string; points: number; min: number }>;
  internalWeight: number;
  examWeight: number;
  passPercentage: number;
}

export async function getMyTranscript(): Promise<Transcript> {
  const res = await authedFetch<Envelope<Transcript>>("/grades/me");
  return res.data;
}

export async function getStudentTranscript(
  studentId: string
): Promise<Transcript> {
  const res = await authedFetch<Envelope<Transcript>>(
    `/grades/students/${studentId}`
  );
  return res.data;
}

export async function getCourseGradeSheet(
  courseOfferingId: string
): Promise<GradeSheet> {
  const res = await authedFetch<Envelope<GradeSheet>>(
    `/grades/course-offerings/${courseOfferingId}`
  );
  return res.data;
}

export async function getGradeScale(): Promise<GradeScale> {
  const res = await authedFetch<Envelope<GradeScale>>("/grades/scale");
  return res.data;
}
