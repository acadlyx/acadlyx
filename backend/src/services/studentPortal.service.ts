import { prisma } from "../lib/prisma";
import { AppError } from "../middleware/errorHandler";

/**
 * REAL data access for the student portal — no placeholders here.
 * Everything in this file comes straight from the database, scoped
 * to the institution embedded in the caller's access token.
 *
 * What "current enrollment" means: the StudentEnrollment row for the
 * institution's current academic year (Institution -> AcademicYear
 * where isCurrent = true). If the student has no enrollment for the
 * current year, we fall back to their most recent one so the portal
 * still shows something meaningful instead of an empty screen.
 */

const enrollmentInclude = {
  program: { select: { id: true, name: true, code: true, level: true } },
  academicYear: { select: { id: true, name: true, isCurrent: true } },
  section: {
    select: {
      id: true,
      name: true,
      semester: {
        select: { id: true, number: true, name: true },
      },
    },
  },
} as const;

export async function getCurrentEnrollment(
  institutionId: string,
  userId: string
) {
  const currentYear = await prisma.academicYear.findFirst({
    where: { institutionId, isCurrent: true },
  });

  if (currentYear) {
    const enrollment = await prisma.studentEnrollment.findFirst({
      where: { institutionId, userId, academicYearId: currentYear.id },
      include: enrollmentInclude,
    });
    if (enrollment) return enrollment;
  }

  // Fall back to the most recent enrollment on record.
  return prisma.studentEnrollment.findFirst({
    where: { institutionId, userId },
    include: enrollmentInclude,
    orderBy: { academicYear: { startDate: "desc" } },
  });
}

export async function getMyProfile(institutionId: string, userId: string) {
  const user = await prisma.user.findFirst({
    where: { id: userId, institutionId },
    select: { id: true, firstName: true, lastName: true, email: true },
  });
  if (!user) {
    throw new AppError("User not found", 404);
  }

  const enrollment = await getCurrentEnrollment(institutionId, userId);

  return { user, enrollment };
}

/** Real course offerings for the student's current section. */
export async function getSectionCourseOfferings(
  institutionId: string,
  sectionId: string
) {
  return prisma.courseOffering.findMany({
    where: { institutionId, sectionId, isActive: true },
    include: {
      course: { select: { id: true, code: true, name: true, credits: true } },
      faculty: { select: { id: true, firstName: true, lastName: true } },
    },
    orderBy: { course: { code: "asc" } },
  });
}

export async function getInstitutionBranding(institutionId: string) {
  const institution = await prisma.institution.findUnique({
    where: { id: institutionId },
    select: {
      name: true,
      logoUrl: true,
      primaryColor: true,
      secondaryColor: true,
    },
  });
  if (!institution) {
    throw new AppError("Institution not found", 404);
  }
  return institution;
}
