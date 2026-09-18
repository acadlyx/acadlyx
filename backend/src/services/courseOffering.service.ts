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

async function loadCourseForInstitution(institutionId: string, courseId: string) {
  const course = await prisma.course.findFirst({
    where: { id: courseId, institutionId },
    select: {
      id: true,
      departmentId: true,
      isActive: true,
    },
  });

  if (!course) {
    throw new AppError("courseId does not belong to this institution", 400);
  }

  if (!course.isActive) {
    throw new AppError("Cannot create an offering for an inactive course", 400);
  }

  return course;
}

async function loadSemesterForInstitution(
  institutionId: string,
  semesterId: string
) {
  const semester = await prisma.semester.findFirst({
    where: { id: semesterId, institutionId },
    select: {
      id: true,
      programId: true,
      academicYearId: true,
      isActive: true,
      program: { select: { departmentId: true, isActive: true } },
      academicYear: { select: { isCurrent: true } },
    },
  });

  if (!semester) {
    throw new AppError("semesterId does not belong to this institution", 400);
  }

  if (!semester.isActive) {
    throw new AppError("Cannot create an offering for an inactive semester", 400);
  }

  if (!semester.program.isActive) {
    throw new AppError("Cannot create an offering for an inactive program", 400);
  }

  return semester;
}

async function loadSectionForInstitution(
  institutionId: string,
  sectionId: string
) {
  const section = await prisma.section.findFirst({
    where: { id: sectionId, institutionId },
    select: {
      id: true,
      semesterId: true,
      isActive: true,
      semester: {
        select: {
          programId: true,
          academicYearId: true,
        },
      },
    },
  });

  if (!section) {
    throw new AppError("sectionId does not belong to this institution", 400);
  }

  if (!section.isActive) {
    throw new AppError("Cannot create an offering for an inactive section", 400);
  }

  return section;
}

async function assertOfferingAcademicIntegrity(
  institutionId: string,
  courseId: string,
  semesterId: string,
  sectionId: string
) {
  const [course, semester, section] = await Promise.all([
    loadCourseForInstitution(institutionId, courseId),
    loadSemesterForInstitution(institutionId, semesterId),
    loadSectionForInstitution(institutionId, sectionId),
  ]);

  if (section.semesterId !== semester.id) {
    throw new AppError(
      "sectionId does not belong to the specified semesterId",
      400
    );
  }

  if (section.semester.programId !== semester.programId) {
    throw new AppError(
      "sectionId belongs to a different program than the specified semester",
      400
    );
  }

  if (section.semester.academicYearId !== semester.academicYearId) {
    throw new AppError(
      "sectionId belongs to a different academic year than the specified semester",
      400
    );
  }

  if (course.departmentId !== semester.program.departmentId) {
    throw new AppError(
      "course department does not match the semester's program department",
      400
    );
  }

  return { course, semester, section };
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
    where: {
      institutionId,
      programId: offering.semester.program.id,
      academicYearId: offering.semester.academicYear.id,
      semesterId: offering.semester.id,
      sectionId: offering.sectionId,
      status: "ACTIVE",
      user: {
        isActive: true,
        studentProfile: {
          institutionId,
          status: "ACTIVE",
        },
      },
    },
    include: {
      user: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          studentProfile: {
            select: {
              admissionNumber: true,
            },
          },
        },
      },
    },
    orderBy: [{ user: { firstName: "asc" } }, { user: { lastName: "asc" } }],
  });

  return enrollments.map((e) => ({
    studentId: e.userId,
    firstName: e.user.firstName,
    lastName: e.user.lastName,
    rollNumber: e.rollNumber,
    admissionNumber: e.user.studentProfile?.admissionNumber ?? null,
  }));
}

export async function createCourseOffering(
  institutionId: string,
  input: CreateCourseOfferingInput
) {
  await assertOfferingAcademicIntegrity(
    institutionId,
    input.courseId,
    input.semesterId,
    input.sectionId
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
  const existing = await getCourseOfferingById(institutionId, id);

  const courseId = input.courseId ?? existing.course.id;
  const semesterId = input.semesterId ?? existing.semester.id;
  const sectionId = input.sectionId ?? existing.section.id;

  await assertOfferingAcademicIntegrity(
    institutionId,
    courseId,
    semesterId,
    sectionId
  );

  if (input.facultyId) {
    await assertFacultyEligible(institutionId, input.facultyId);
  }

  const duplicate = await prisma.courseOffering.findFirst({
    where: {
      institutionId,
      courseId,
      semesterId,
      sectionId,
      NOT: { id },
    },
    select: { id: true },
  });

  if (duplicate) {
    throw new AppError(
      "This course is already offered in this semester/section",
      409
    );
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
