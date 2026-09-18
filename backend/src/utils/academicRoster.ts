import { prisma } from "../lib/prisma";
import { AppError } from "../middleware/errorHandler";

/**
 * Returns the authoritative student roster for a concrete CourseOffering.
 *
 * A student is eligible only when their ACTIVE enrollment matches the
 * offering's exact semester and section. This prevents a student who
 * happens to be in the same section under another academic period from
 * leaking into attendance, marks, or assignments.
 */
export async function getCourseOfferingRoster(
  institutionId: string,
  courseOfferingId: string
) {
  const offering = await prisma.courseOffering.findFirst({
    where: { id: courseOfferingId, institutionId },
    select: {
      id: true,
      semesterId: true,
      sectionId: true,
      semester: {
        select: {
          programId: true,
          academicYearId: true,
        },
      },
    },
  });

  if (!offering) {
    throw new AppError("Course offering not found", 404);
  }

  const enrollments = await prisma.studentEnrollment.findMany({
    where: {
      institutionId,
      status: "ACTIVE",
      sectionId: offering.sectionId,
      semesterId: offering.semesterId,
      programId: offering.semester.programId,
      academicYearId: offering.semester.academicYearId,
    },
    include: {
      user: { select: { id: true, firstName: true, lastName: true } },
    },
    orderBy: { user: { firstName: "asc" } },
  });

  return enrollments.map((enrollment) => ({
    studentId: enrollment.userId,
    firstName: enrollment.user.firstName,
    lastName: enrollment.user.lastName,
    rollNumber: enrollment.rollNumber,
  }));
}

export async function getCourseOfferingRosterIds(
  institutionId: string,
  courseOfferingId: string
): Promise<Set<string>> {
  const roster = await getCourseOfferingRoster(institutionId, courseOfferingId);
  return new Set(roster.map((student) => student.studentId));
}

/**
 * Resolves all concrete course offerings a student is enrolled in
 * for their ACTIVE semester/section enrollments.
 */
export async function getStudentCourseOfferingIds(
  institutionId: string,
  studentId: string
): Promise<string[]> {
  const enrollments = await prisma.studentEnrollment.findMany({
    where: {
      institutionId,
      userId: studentId,
      status: "ACTIVE",
      semesterId: { not: null },
      sectionId: { not: null },
    },
    select: {
      semesterId: true,
      sectionId: true,
      semester: {
        select: {
          id: true,
          programId: true,
          academicYearId: true,
        },
      },
    },
  });

  if (enrollments.length === 0) return [];

  const pairs = enrollments
    .filter(
      (enrollment): enrollment is typeof enrollment & {
        semesterId: string;
        sectionId: string;
      } => Boolean(enrollment.semesterId && enrollment.sectionId)
    )
    .map((enrollment) => ({
      semesterId: enrollment.semesterId,
      sectionId: enrollment.sectionId,
    }));

  if (pairs.length === 0) return [];

  const offerings = await prisma.courseOffering.findMany({
    where: {
      institutionId,
      isActive: true,
      OR: pairs,
    },
    select: { id: true },
  });

  return offerings.map((offering) => offering.id);
}

/**
 * Validates a student's membership in a specific course offering.
 * Use this at every student-facing read/write boundary.
 */
export async function assertStudentEnrolledInCourseOffering(
  institutionId: string,
  studentId: string,
  courseOfferingId: string
): Promise<void> {
  const ids = await getCourseOfferingRosterIds(institutionId, courseOfferingId);
  if (!ids.has(studentId)) {
    throw new AppError(
      "You are not enrolled in this course offering",
      403
    );
  }
}
