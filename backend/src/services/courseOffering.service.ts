import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { AppError } from "../middleware/errorHandler";
import { AuthenticatedUser } from "../types/auth";
import { assertOwnsCourseOffering } from "../utils/courseOfferingAccess";
import { PaginationParams } from "../utils/pagination";
import {
  CreateCourseOfferingInput,
  UpdateCourseOfferingInput,
} from "../validators/courseOffering.validators";

export interface ListFilters extends PaginationParams {
  courseId?: string;
  semesterId?: string;
  sectionId?: string;
  facultyId?: string;
  isActive?: boolean;
}

async function assertCourseInInstitution(institutionId: string, courseId: string) {
  const course = await prisma.course.findFirst({
    where: { id: courseId, institutionId },
  });
  if (!course) {
    throw new AppError("courseId does not belong to this institution", 400);
  }
}

async function assertSectionMatchesSemester(
  institutionId: string,
  sectionId: string,
  semesterId: string
) {
  const section = await prisma.section.findFirst({
    where: { id: sectionId, institutionId },
  });
  if (!section) {
    throw new AppError("sectionId does not belong to this institution", 400);
  }
  if (section.semesterId !== semesterId) {
    throw new AppError(
      "sectionId does not belong to the specified semesterId",
      400
    );
  }
}

/** Faculty must be an active user of this institution holding the FACULTY role. */
async function assertFacultyEligible(institutionId: string, facultyId: string) {
  const faculty = await prisma.user.findFirst({
    where: { id: facultyId, institutionId, isActive: true },
    include: { userRoles: { include: { role: true } } },
  });
  if (!faculty) {
    throw new AppError(
      "facultyId does not reference an active user of this institution",
      400
    );
  }
  const hasFacultyRole = faculty.userRoles.some(
    (ur) => ur.role.name === "FACULTY"
  );
  if (!hasFacultyRole) {
    throw new AppError(
      "facultyId does not reference a user with the FACULTY role",
      400
    );
  }
}

const include = {
  course: { select: { id: true, code: true, name: true, credits: true } },
  section: { select: { id: true, name: true } },
  semester: {
    select: {
      id: true,
      number: true,
      name: true,
      program: { select: { id: true, name: true, code: true } },
      academicYear: { select: { id: true, name: true } },
    },
  },
  faculty: { select: { id: true, firstName: true, lastName: true, email: true } },
} satisfies Prisma.CourseOfferingInclude;

export async function listCourseOfferings(
  institutionId: string,
  filters: ListFilters
) {
  const where: Prisma.CourseOfferingWhereInput = {
    institutionId,
    ...(filters.courseId ? { courseId: filters.courseId } : {}),
    ...(filters.semesterId ? { semesterId: filters.semesterId } : {}),
    ...(filters.sectionId ? { sectionId: filters.sectionId } : {}),
    ...(filters.facultyId ? { facultyId: filters.facultyId } : {}),
    ...(filters.isActive !== undefined ? { isActive: filters.isActive } : {}),
  };

  const [items, total] = await Promise.all([
    prisma.courseOffering.findMany({
      where,
      skip: filters.skip,
      take: filters.take,
      orderBy: { createdAt: "desc" },
      include,
    }),
    prisma.courseOffering.count({ where }),
  ]);

  return { items, total };
}

export async function getCourseOfferingById(institutionId: string, id: string) {
  const offering = await prisma.courseOffering.findFirst({
    where: { id, institutionId },
    include,
  });
  if (!offering) {
    throw new AppError("Course offering not found", 404);
  }
  return offering;
}

/**
 * Roster for this offering's section, for faculty-facing bulk entry
 * screens (marks, and reused by attendance/assignments internally).
 * Ownership-gated: the calling faculty must actually be assigned to
 * this offering, or be an institution/platform admin.
 */
export async function getRoster(
  institutionId: string,
  user: AuthenticatedUser,
  id: string
) {
  const offering = await getCourseOfferingById(institutionId, id);
  assertOwnsCourseOffering(user, offering.facultyId);

  const enrollments = await prisma.studentEnrollment.findMany({
    where: { institutionId, sectionId: offering.sectionId, status: "ACTIVE" },
    include: { user: { select: { id: true, firstName: true, lastName: true } } },
    orderBy: { user: { firstName: "asc" } },
  });

  return enrollments.map((e) => ({
    studentId: e.userId,
    firstName: e.user.firstName,
    lastName: e.user.lastName,
    rollNumber: e.rollNumber,
  }));
}

export async function createCourseOffering(
  institutionId: string,
  input: CreateCourseOfferingInput
) {
  await assertCourseInInstitution(institutionId, input.courseId);
  await assertSectionMatchesSemester(
    institutionId,
    input.sectionId,
    input.semesterId
  );
  if (input.facultyId) {
    await assertFacultyEligible(institutionId, input.facultyId);
  }

  const existing = await prisma.courseOffering.findFirst({
    where: {
      courseId: input.courseId,
      semesterId: input.semesterId,
      sectionId: input.sectionId,
    },
  });
  if (existing) {
    throw new AppError(
      "This course is already offered in this semester/section",
      409
    );
  }

  return prisma.courseOffering.create({
    data: { institutionId, ...input },
    include,
  });
}

export async function updateCourseOffering(
  institutionId: string,
  id: string,
  input: UpdateCourseOfferingInput
) {
  await getCourseOfferingById(institutionId, id);

  if (input.facultyId) {
    await assertFacultyEligible(institutionId, input.facultyId);
  }

  return prisma.courseOffering.update({
    where: { id },
    data: input,
    include,
  });
}

/** Soft delete — closes the offering without erasing the historical record. */
export async function deactivateCourseOffering(
  institutionId: string,
  id: string
) {
  await getCourseOfferingById(institutionId, id);
  return prisma.courseOffering.update({
    where: { id },
    data: { isActive: false },
  });
}
