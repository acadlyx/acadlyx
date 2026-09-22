import { prisma } from "../lib/prisma";
import { AppError } from "../middleware/errorHandler";
import { AuthenticatedUser } from "../types/auth";
import { round2 } from "../utils/http";
import {
  assertCanViewStudent,
  getManagedDepartmentIds,
  isInstitutionWide,
} from "./accessScope.service";

/**
 * Grading model.
 *
 * A course's final percentage is the weighted combination of the
 * internal-assessment components and the end-semester examinations
 * recorded for that offering. Weights are institution-wide constants
 * here rather than per-course configuration, so every transcript in a
 * tenant is computed the same way.
 */
export const INTERNAL_WEIGHT = 0.4;
export const EXAM_WEIGHT = 0.6;
export const PASS_PERCENTAGE = 40;

export interface GradeBand {
  letter: string;
  points: number;
  min: number;
}

/** 10-point scale, highest band first so lookup is a simple scan. */
export const GRADE_BANDS: GradeBand[] = [
  { letter: "O", points: 10, min: 90 },
  { letter: "A+", points: 9, min: 80 },
  { letter: "A", points: 8, min: 70 },
  { letter: "B+", points: 7, min: 60 },
  { letter: "B", points: 6, min: 50 },
  { letter: "C", points: 5, min: 45 },
  { letter: "P", points: 4, min: PASS_PERCENTAGE },
  { letter: "F", points: 0, min: 0 },
];

export function bandFor(percentage: number): GradeBand {
  return (
    GRADE_BANDS.find((band) => percentage >= band.min) ??
    GRADE_BANDS[GRADE_BANDS.length - 1]
  );
}

export interface CourseGrade {
  courseOfferingId: string;
  courseId: string;
  courseCode: string;
  courseName: string;
  credits: number;
  semesterId: string;
  semesterName: string;
  semesterNumber: number;
  academicYearId: string;
  academicYearName: string;
  internalPercentage: number | null;
  examPercentage: number | null;
  /** Null when neither internals nor exams have been recorded yet. */
  percentage: number | null;
  letter: string | null;
  gradePoints: number | null;
  passed: boolean | null;
  components: Array<{
    kind: "INTERNAL" | "EXAM";
    name: string;
    marksObtained: number;
    maxMarks: number;
  }>;
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
  /** Percentage equivalent commonly printed alongside a 10-point CGPA. */
  percentageEquivalent: number | null;
}

function percentage(obtained: number, max: number): number | null {
  if (max <= 0) return null;
  return round2((obtained / max) * 100);
}

/**
 * Weighted average of internals and exams. When only one side has been
 * recorded, that side carries the whole weight — a course graded only
 * on internals so far must not look like a half-failed course.
 */
function combine(
  internal: number | null,
  exam: number | null
): number | null {
  if (internal === null && exam === null) return null;
  if (internal === null) return exam;
  if (exam === null) return internal;
  return round2(internal * INTERNAL_WEIGHT + exam * EXAM_WEIGHT);
}

/**
 * Builds the per-course grade rows for one student from the offerings
 * they are actually attached to: section roster enrollments plus
 * approved course registrations.
 */
async function courseGradesFor(
  institutionId: string,
  studentId: string
): Promise<CourseGrade[]> {
  const [enrollments, registrations] = await Promise.all([
    prisma.studentEnrollment.findMany({
      where: { institutionId, userId: studentId },
      select: { sectionId: true, semesterId: true },
    }),
    prisma.courseRegistration.findMany({
      where: { institutionId, studentId, status: "APPROVED" },
      select: { courseOfferingId: true },
    }),
  ]);

  const sectionIds = enrollments
    .map((row) => row.sectionId)
    .filter((id): id is string => Boolean(id));
  const registeredIds = registrations.map((row) => row.courseOfferingId);

  if (sectionIds.length === 0 && registeredIds.length === 0) return [];

  const offerings = await prisma.courseOffering.findMany({
    where: {
      institutionId,
      OR: [
        ...(sectionIds.length ? [{ sectionId: { in: sectionIds } }] : []),
        ...(registeredIds.length ? [{ id: { in: registeredIds } }] : []),
      ],
    },
    select: {
      id: true,
      course: { select: { id: true, code: true, name: true, credits: true } },
      semester: {
        select: {
          id: true,
          name: true,
          number: true,
          academicYear: { select: { id: true, name: true } },
        },
      },
    },
  });

  if (offerings.length === 0) return [];
  const offeringIds = offerings.map((offering) => offering.id);

  const [internals, results] = await Promise.all([
    prisma.internalMark.findMany({
      where: {
        institutionId,
        studentId,
        courseOfferingId: { in: offeringIds },
      },
      select: {
        courseOfferingId: true,
        component: true,
        marksObtained: true,
        maxMarks: true,
      },
    }),
    prisma.examResult.findMany({
      where: {
        institutionId,
        studentId,
        exam: { courseOfferingId: { in: offeringIds } },
      },
      select: {
        marks: true,
        exam: {
          select: { title: true, maxMarks: true, courseOfferingId: true },
        },
      },
    }),
  ]);

  const internalsByOffering = new Map<string, typeof internals>();
  for (const row of internals) {
    const list = internalsByOffering.get(row.courseOfferingId) ?? [];
    list.push(row);
    internalsByOffering.set(row.courseOfferingId, list);
  }

  const resultsByOffering = new Map<string, typeof results>();
  for (const row of results) {
    const key = row.exam.courseOfferingId;
    const list = resultsByOffering.get(key) ?? [];
    list.push(row);
    resultsByOffering.set(key, list);
  }

  return offerings.map((offering) => {
    const internalRows = internalsByOffering.get(offering.id) ?? [];
    const examRows = resultsByOffering.get(offering.id) ?? [];

    const internalPercentage = percentage(
      internalRows.reduce((sum, row) => sum + row.marksObtained, 0),
      internalRows.reduce((sum, row) => sum + row.maxMarks, 0)
    );
    const examPercentage = percentage(
      examRows.reduce((sum, row) => sum + row.marks, 0),
      examRows.reduce((sum, row) => sum + row.exam.maxMarks, 0)
    );

    const finalPercentage = combine(internalPercentage, examPercentage);
    const band = finalPercentage === null ? null : bandFor(finalPercentage);

    return {
      courseOfferingId: offering.id,
      courseId: offering.course.id,
      courseCode: offering.course.code,
      courseName: offering.course.name,
      credits: offering.course.credits,
      semesterId: offering.semester.id,
      semesterName: offering.semester.name,
      semesterNumber: offering.semester.number,
      academicYearId: offering.semester.academicYear.id,
      academicYearName: offering.semester.academicYear.name,
      internalPercentage,
      examPercentage,
      percentage: finalPercentage,
      letter: band?.letter ?? null,
      gradePoints: band?.points ?? null,
      passed:
        finalPercentage === null ? null : finalPercentage >= PASS_PERCENTAGE,
      components: [
        ...internalRows.map((row) => ({
          kind: "INTERNAL" as const,
          name: row.component,
          marksObtained: row.marksObtained,
          maxMarks: row.maxMarks,
        })),
        ...examRows.map((row) => ({
          kind: "EXAM" as const,
          name: row.exam.title,
          marksObtained: row.marks,
          maxMarks: row.exam.maxMarks,
        })),
      ],
    };
  });
}

/** Credit-weighted grade point average over graded courses only. */
function gpa(courses: CourseGrade[]): { value: number | null; credits: number; earned: number } {
  const graded = courses.filter((course) => course.gradePoints !== null);
  const credits = graded.reduce((sum, course) => sum + course.credits, 0);
  const earned = graded
    .filter((course) => course.passed)
    .reduce((sum, course) => sum + course.credits, 0);

  if (credits === 0) return { value: null, credits: 0, earned: 0 };

  const weighted = graded.reduce(
    (sum, course) => sum + (course.gradePoints ?? 0) * course.credits,
    0
  );
  return { value: round2(weighted / credits), credits, earned };
}

export async function getTranscript(
  institutionId: string,
  actor: AuthenticatedUser,
  studentId: string
): Promise<Transcript> {
  if (studentId !== actor.id) {
    await assertCanViewStudent(institutionId, actor, studentId);
  }

  const courses = await courseGradesFor(institutionId, studentId);

  const bySemester = new Map<string, CourseGrade[]>();
  for (const course of courses) {
    const list = bySemester.get(course.semesterId) ?? [];
    list.push(course);
    bySemester.set(course.semesterId, list);
  }

  const semesters: SemesterResult[] = [...bySemester.values()]
    .map((list) => {
      const summary = gpa(list);
      return {
        semesterId: list[0].semesterId,
        semesterName: list[0].semesterName,
        semesterNumber: list[0].semesterNumber,
        academicYearName: list[0].academicYearName,
        credits: summary.credits,
        creditsEarned: summary.earned,
        sgpa: summary.value,
        courses: list.sort((a, b) => a.courseCode.localeCompare(b.courseCode)),
      };
    })
    .sort((a, b) => a.semesterNumber - b.semesterNumber);

  const overall = gpa(courses);

  return {
    studentId,
    semesters,
    totalCredits: overall.credits,
    creditsEarned: overall.earned,
    cgpa: overall.value,
    /* The conventional CGPA-to-percentage conversion on a 10-point scale. */
    percentageEquivalent:
      overall.value === null ? null : round2(overall.value * 9.5),
  };
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

/**
 * Who may read a whole class's grades: institution-wide roles, the
 * assigned faculty member, and the HOD of the owning department.
 */
async function assertCanReadGradeSheet(
  institutionId: string,
  actor: AuthenticatedUser,
  courseOfferingId: string
): Promise<void> {
  if (isInstitutionWide(actor)) return;

  const offering = await prisma.courseOffering.findFirst({
    where: { id: courseOfferingId, institutionId },
    select: { facultyId: true, course: { select: { departmentId: true } } },
  });
  if (!offering) throw new AppError("Course offering not found", 404);

  if (offering.facultyId && offering.facultyId === actor.id) return;

  if (actor.roles.includes("HOD")) {
    const managed = await getManagedDepartmentIds(institutionId, actor.id);
    if (managed.includes(offering.course.departmentId)) return;
  }

  throw new AppError("This course offering is outside your scope", 403);
}

/**
 * Class grade sheet for one offering: every student on the roster with
 * their computed grade, plus the distribution used for moderation.
 */
export async function getCourseGradeSheet(
  institutionId: string,
  actor: AuthenticatedUser,
  courseOfferingId: string
) {
  const offering = await prisma.courseOffering.findFirst({
    where: { id: courseOfferingId, institutionId },
    select: {
      id: true,
      sectionId: true,
      semesterId: true,
      course: { select: { code: true, name: true, credits: true } },
      section: { select: { name: true } },
      semester: { select: { name: true } },
    },
  });
  if (!offering) throw new AppError("Course offering not found", 404);
  await assertCanReadGradeSheet(institutionId, actor, courseOfferingId);

  const [rosterEnrollments, registrations] = await Promise.all([
    prisma.studentEnrollment.findMany({
      where: { institutionId, sectionId: offering.sectionId },
      select: {
        rollNumber: true,
        user: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
      },
    }),
    prisma.courseRegistration.findMany({
      where: { institutionId, courseOfferingId, status: "APPROVED" },
      select: {
        student: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
      },
    }),
  ]);

  const students = new Map<
    string,
    { id: string; firstName: string; lastName: string; email: string; rollNumber: string | null }
  >();
  for (const row of rosterEnrollments) {
    students.set(row.user.id, { ...row.user, rollNumber: row.rollNumber });
  }
  for (const row of registrations) {
    if (!students.has(row.student.id)) {
      students.set(row.student.id, { ...row.student, rollNumber: null });
    }
  }

  const studentIds = [...students.keys()];
  if (studentIds.length === 0) {
    return { offering, rows: [], distribution: {}, classAverage: null };
  }

  const [internals, results] = await Promise.all([
    prisma.internalMark.findMany({
      where: { institutionId, courseOfferingId, studentId: { in: studentIds } },
      select: { studentId: true, marksObtained: true, maxMarks: true },
    }),
    prisma.examResult.findMany({
      where: {
        institutionId,
        studentId: { in: studentIds },
        exam: { courseOfferingId },
      },
      select: { studentId: true, marks: true, exam: { select: { maxMarks: true } } },
    }),
  ]);

  const rows: GradeSheetRow[] = studentIds.map((studentId) => {
    const own = students.get(studentId)!;
    const internalRows = internals.filter((row) => row.studentId === studentId);
    const examRows = results.filter((row) => row.studentId === studentId);

    const internalPercentage = percentage(
      internalRows.reduce((sum, row) => sum + row.marksObtained, 0),
      internalRows.reduce((sum, row) => sum + row.maxMarks, 0)
    );
    const examPercentage = percentage(
      examRows.reduce((sum, row) => sum + row.marks, 0),
      examRows.reduce((sum, row) => sum + row.exam.maxMarks, 0)
    );
    const final = combine(internalPercentage, examPercentage);
    const band = final === null ? null : bandFor(final);

    return {
      studentId,
      name: `${own.firstName} ${own.lastName}`,
      email: own.email,
      rollNumber: own.rollNumber,
      internalPercentage,
      examPercentage,
      percentage: final,
      letter: band?.letter ?? null,
      gradePoints: band?.points ?? null,
      passed: final === null ? null : final >= PASS_PERCENTAGE,
    };
  });

  const graded = rows.filter((row) => row.percentage !== null);
  const distribution: Record<string, number> = {};
  for (const row of graded) {
    if (!row.letter) continue;
    distribution[row.letter] = (distribution[row.letter] ?? 0) + 1;
  }

  return {
    offering,
    rows: rows.sort((a, b) =>
      (a.rollNumber ?? a.name).localeCompare(b.rollNumber ?? b.name)
    ),
    distribution,
    classAverage: graded.length
      ? round2(
          graded.reduce((sum, row) => sum + (row.percentage ?? 0), 0) /
            graded.length
        )
      : null,
  };
}

export function getGradeScale() {
  return {
    bands: GRADE_BANDS,
    internalWeight: INTERNAL_WEIGHT,
    examWeight: EXAM_WEIGHT,
    passPercentage: PASS_PERCENTAGE,
  };
}
