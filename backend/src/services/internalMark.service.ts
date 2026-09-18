import { prisma } from "../lib/prisma";
import { AppError } from "../middleware/errorHandler";
import { AuthenticatedUser } from "../types/auth";
import {
  assertOwnsCourseOffering,
  loadCourseOfferingOrThrow,
} from "../utils/courseOfferingAccess";
import { PaginationParams } from "../utils/pagination";
import { getCourseOfferingRosterIds } from "../utils/academicRoster";
import { EnterMarksInput } from "../validators/internalMark.validators";


/**
 * Bulk enter/update one graded component for however many students
 * changed — same "send only what changed" shape as attendance
 * records. Every studentId is checked against the section's real
 * roster, and every mark against the component's own maxMarks.
 */
export async function enterMarks(
  institutionId: string,
  user: AuthenticatedUser,
  input: EnterMarksInput
) {
  const offering = await loadCourseOfferingOrThrow(institutionId, input.courseOfferingId);
  assertOwnsCourseOffering(user, offering.facultyId);

  const rosterIds = await getCourseOfferingRosterIds(institutionId, offering.id);
  const invalidStudents = input.records.filter((r) => !rosterIds.has(r.studentId));
  if (invalidStudents.length > 0) {
    throw new AppError(
      `${invalidStudents.length} student(s) in this submission are not enrolled in this section`,
      400
    );
  }

  const overMax = input.records.filter((r) => r.marksObtained > input.maxMarks);
  if (overMax.length > 0) {
    throw new AppError(
      `${overMax.length} entr(y/ies) exceed this component's maxMarks (${input.maxMarks})`,
      400
    );
  }

  await prisma.$transaction(
    input.records.map((r) =>
      prisma.internalMark.upsert({
        where: {
          courseOfferingId_studentId_component: {
            courseOfferingId: input.courseOfferingId,
            studentId: r.studentId,
            component: input.component,
          },
        },
        update: { marksObtained: r.marksObtained, maxMarks: input.maxMarks },
        create: {
          institutionId,
          courseOfferingId: input.courseOfferingId,
          studentId: r.studentId,
          enteredById: user.id,
          component: input.component,
          marksObtained: r.marksObtained,
          maxMarks: input.maxMarks,
        },
      })
    )
  );

  return prisma.internalMark.findMany({
    where: { courseOfferingId: input.courseOfferingId, component: input.component },
    include: { student: { select: { id: true, firstName: true, lastName: true } } },
  });
}

export interface ListFilters extends PaginationParams {
  courseOfferingId?: string;
  studentId?: string;
  component?: string;
}

export async function listMarks(
  institutionId: string,
  user: AuthenticatedUser,
  filters: ListFilters
) {
  if (filters.courseOfferingId) {
    const offering = await loadCourseOfferingOrThrow(institutionId, filters.courseOfferingId);
    assertOwnsCourseOffering(user, offering.facultyId);
  }

  const where = {
    institutionId,
    ...(filters.courseOfferingId ? { courseOfferingId: filters.courseOfferingId } : {}),
    ...(filters.studentId ? { studentId: filters.studentId } : {}),
    ...(filters.component ? { component: filters.component } : {}),
  };

  const [items, total] = await Promise.all([
    prisma.internalMark.findMany({
      where,
      skip: filters.skip,
      take: filters.take,
      orderBy: [{ component: "asc" }, { student: { firstName: "asc" } }],
      include: { student: { select: { id: true, firstName: true, lastName: true } } },
    }),
    prisma.internalMark.count({ where }),
  ]);

  return { items, total };
}

/** Real data for the student dashboard / self-service marks view. */
export async function getMyMarks(institutionId: string, studentId: string) {
  return prisma.internalMark.findMany({
    where: { institutionId, studentId },
    include: {
      courseOffering: {
        select: { id: true, course: { select: { code: true, name: true } } },
      },
    },
    orderBy: [{ courseOffering: { course: { code: "asc" } } }, { component: "asc" }],
  });
}

/** Average percentage across all of a student's entered internal marks (0 if none yet). */
export async function getMyMarksAveragePercent(
  institutionId: string,
  studentId: string
): Promise<number> {
  const marks = await prisma.internalMark.findMany({
    where: { institutionId, studentId },
    select: { marksObtained: true, maxMarks: true },
  });
  if (marks.length === 0) return 0;

  const totalObtained = marks.reduce((sum, m) => sum + m.marksObtained, 0);
  const totalMax = marks.reduce((sum, m) => sum + m.maxMarks, 0);
  return totalMax > 0 ? Math.round((totalObtained / totalMax) * 100) : 0;
}
