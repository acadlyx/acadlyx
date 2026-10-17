import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { AuthenticatedUser } from "../types/auth";
import {
  assertAcademicYearInScope,
  assertCampusInScope,
  assertDepartmentInScope,
  assertProgramInScope,
  assertSectionInScope,
  assertSemesterInScope,
  getEffectiveWorkspaceRole,
} from "../services/accessScope.service";
import { AppError } from "../middleware/errorHandler";

export interface WorkspaceContextFilterInput {
  campusId?: string;
  departmentId?: string;
  programId?: string;
  academicYearId?: string;
  batchId?: string;
  semesterId?: string;
  sectionId?: string;
}

const CONTEXT_KEYS = [
  "campusId", "departmentId", "programId", "academicYearId", "batchId", "semesterId", "sectionId",
] as const;

export function readWorkspaceContextFilters(query: Record<string, unknown>): WorkspaceContextFilterInput {
  const filters: WorkspaceContextFilterInput = {};
  for (const key of CONTEXT_KEYS) {
    const value = query[key];
    if (typeof value === "string" && value.trim()) filters[key] = value.trim();
  }
  return filters;
}

export function hasWorkspaceContextFilters(filters: WorkspaceContextFilterInput): boolean {
  return CONTEXT_KEYS.some((key) => typeof filters[key] === "string" && Boolean(filters[key]?.trim()));
}

/**
 * Validate explicit selector IDs before a list query runs. Empty result sets
 * are appropriate for valid scope filters with no matching records; they must
 * not be used to disguise a foreign/unauthorized selected resource.
 */
export async function assertWorkspaceContextFilters(
  institutionId: string,
  actor: AuthenticatedUser,
  filters: WorkspaceContextFilterInput,
): Promise<void> {
  if (!hasWorkspaceContextFilters(filters)) return;

  const [campus, department, program, year, semester, section, batch] = await Promise.all([
    filters.campusId
      ? prisma.campus.findFirst({
          where: { id: filters.campusId, institutionId, isActive: true },
          select: { id: true },
        })
      : null,
    filters.departmentId
      ? prisma.department.findFirst({
          where: { id: filters.departmentId, institutionId, isActive: true },
          select: { id: true, campusId: true },
        })
      : null,
    filters.programId
      ? prisma.program.findFirst({
          where: { id: filters.programId, institutionId, isActive: true },
          select: { id: true, departmentId: true, department: { select: { campusId: true } } },
        })
      : null,
    filters.academicYearId
      ? prisma.academicYear.findFirst({
          where: { id: filters.academicYearId, institutionId },
          select: { id: true },
        })
      : null,
    filters.semesterId
      ? prisma.semester.findFirst({
          where: { id: filters.semesterId, institutionId, isActive: true },
          select: { id: true, programId: true, academicYearId: true, program: { select: { departmentId: true, department: { select: { campusId: true } } } } },
        })
      : null,
    filters.sectionId
      ? prisma.section.findFirst({
          where: { id: filters.sectionId, institutionId, isActive: true },
          select: { id: true, semesterId: true, semester: { select: { programId: true, academicYearId: true, program: { select: { departmentId: true, department: { select: { campusId: true } } } } } } },
        })
      : null,
    filters.batchId
      ? prisma.batch.findFirst({
          where: { id: filters.batchId, institutionId, isActive: true },
          select: { id: true, programId: true, program: { select: { departmentId: true, department: { select: { campusId: true } } } } },
        })
      : null,
  ]);

  if (filters.campusId && !campus) throw new AppError("Selected campus is not available in this institution", 404);
  if (filters.departmentId && !department) throw new AppError("Selected department is not available in this institution", 404);
  if (filters.programId && !program) throw new AppError("Selected programme is not available in this institution", 404);
  if (filters.academicYearId && !year) throw new AppError("Selected academic year is not available in this institution", 404);
  if (filters.semesterId && !semester) throw new AppError("Selected semester is not available in this institution", 404);
  if (filters.sectionId && !section) throw new AppError("Selected section is not available in this institution", 404);
  if (filters.batchId && !batch) throw new AppError("Selected batch is not available in this institution", 404);

  if (getEffectiveWorkspaceRole(actor) === "STUDENT") {
    const enrollment = await prisma.studentEnrollment.findFirst({
      where: { institutionId, userId: actor.id, status: "ACTIVE" },
      orderBy: { enrolledAt: "desc" },
      select: {
        programId: true,
        academicYearId: true,
        batchId: true,
        semesterId: true,
        sectionId: true,
        program: { select: { departmentId: true, department: { select: { campusId: true } } } },
      },
    });
    if (!enrollment) {
      throw new AppError("No active enrollment authorizes this academic context", 403);
    }
    const enrollmentScope: WorkspaceContextFilterInput = {
      campusId: enrollment.program.department.campusId ?? undefined,
      departmentId: enrollment.program.departmentId,
      programId: enrollment.programId,
      academicYearId: enrollment.academicYearId,
      batchId: enrollment.batchId ?? undefined,
      semesterId: enrollment.semesterId ?? undefined,
      sectionId: enrollment.sectionId ?? undefined,
    };
    for (const key of CONTEXT_KEYS) {
      const requested = filters[key];
      if (requested && requested !== enrollmentScope[key]) {
        throw new AppError("Selected academic context is outside the student's active enrollment", 403);
      }
    }
    return;
  }

  if (filters.campusId) await assertCampusInScope(institutionId, actor, filters.campusId);
  if (filters.departmentId) await assertDepartmentInScope(institutionId, actor, filters.departmentId);
  if (filters.programId) await assertProgramInScope(institutionId, actor, filters.programId);
  if (filters.academicYearId) await assertAcademicYearInScope(institutionId, actor, filters.academicYearId);
  if (filters.semesterId) await assertSemesterInScope(institutionId, actor, filters.semesterId);
  if (filters.sectionId) await assertSectionInScope(institutionId, actor, filters.sectionId);
  if (batch) await assertProgramInScope(institutionId, actor, batch.programId);

  if (campus && department && department.campusId !== filters.campusId) {
    throw new AppError("Selected department does not belong to the selected campus", 400);
  }
  if (campus && program && program.department.campusId !== filters.campusId) {
    throw new AppError("Selected programme does not belong to the selected campus", 400);
  }
  if (department && program && program.departmentId !== department.id) {
    throw new AppError("Selected programme does not belong to the selected department", 400);
  }
  if (program && year) {
    const matchingSemester = semester?.programId === program.id && semester.academicYearId === year.id
      ? { id: semester.id }
      : await prisma.semester.findFirst({
          where: { institutionId, programId: program.id, academicYearId: year.id, isActive: true },
          select: { id: true },
        });
    if (!matchingSemester) {
      throw new AppError("Selected academic year has no active semester for the selected programme", 400);
    }
  }
  if (program && semester && semester.programId !== program.id) {
    throw new AppError("Selected semester does not belong to the selected programme", 400);
  }
  if (year && semester && semester.academicYearId !== year.id) {
    throw new AppError("Selected semester does not belong to the selected academic year", 400);
  }
  if (department && semester && semester.program.departmentId !== department.id) {
    throw new AppError("Selected semester does not belong to the selected department", 400);
  }
  if (campus && semester && semester.program.department.campusId !== campus.id) {
    throw new AppError("Selected semester does not belong to the selected campus", 400);
  }
  if (semester && section && section.semesterId !== semester.id) {
    throw new AppError("Selected section does not belong to the selected semester", 400);
  }
  if (program && section && section.semester.programId !== program.id) {
    throw new AppError("Selected section does not belong to the selected programme", 400);
  }
  if (year && section && section.semester.academicYearId !== year.id) {
    throw new AppError("Selected section does not belong to the selected academic year", 400);
  }
  if (department && section && section.semester.program.departmentId !== department.id) {
    throw new AppError("Selected section does not belong to the selected department", 400);
  }
  if (campus && section && section.semester.program.department.campusId !== campus.id) {
    throw new AppError("Selected section does not belong to the selected campus", 400);
  }
  if (batch && program && batch.programId !== program.id) {
    throw new AppError("Selected batch does not belong to the selected programme", 400);
  }
  if (batch && department && batch.program.departmentId !== department.id) {
    throw new AppError("Selected batch does not belong to the selected department", 400);
  }
  if (batch && campus && batch.program.department.campusId !== campus.id) {
    throw new AppError("Selected batch does not belong to the selected campus", 400);
  }
  if (batch && semester && batch.programId !== semester.programId) {
    throw new AppError("Selected batch does not belong to the selected semester's programme", 400);
  }
  if (batch && section && batch.programId !== section.semester.programId) {
    throw new AppError("Selected batch does not belong to the selected section's programme", 400);
  }
}

/** Scope join filter for list records attached to a course offering. */
export function courseOfferingWorkspaceWhere(
  institutionId: string,
  filters: WorkspaceContextFilterInput,
): Prisma.CourseOfferingWhereInput | undefined {
  if (!hasWorkspaceContextFilters(filters)) return undefined;

  const courseWhere: Prisma.CourseWhereInput = {
    ...(filters.departmentId ? { departmentId: filters.departmentId } : {}),
    ...(filters.campusId ? { department: { campusId: filters.campusId } } : {}),
  };
  const programWhere: Prisma.ProgramWhereInput = {
    ...(filters.programId ? { id: filters.programId } : {}),
    ...(filters.departmentId ? { departmentId: filters.departmentId } : {}),
    ...(filters.campusId ? { department: { campusId: filters.campusId } } : {}),
  };
  const semesterWhere: Prisma.SemesterWhereInput = {
    ...(filters.semesterId ? { id: filters.semesterId } : {}),
    ...(filters.academicYearId ? { academicYearId: filters.academicYearId } : {}),
    ...(filters.programId ? { programId: filters.programId } : {}),
    ...(filters.campusId || filters.departmentId ? { program: programWhere } : {}),
  };

  return {
    ...(Object.keys(courseWhere).length ? { course: courseWhere } : {}),
    ...(Object.keys(semesterWhere).length ? { semester: semesterWhere } : {}),
    ...(filters.sectionId ? { sectionId: filters.sectionId } : {}),
    ...(filters.batchId
      ? { section: { studentEnrollments: { some: studentEnrollmentWorkspaceWhere(institutionId, filters) } } }
      : {}),
  };
}

/** A student must match the selected enrollment context when filtering marks by student/batch. */
export function studentEnrollmentWorkspaceWhere(
  institutionId: string,
  filters: WorkspaceContextFilterInput,
): Prisma.StudentEnrollmentWhereInput {
  const programWhere: Prisma.ProgramWhereInput = {
    ...(filters.programId ? { id: filters.programId } : {}),
    ...(filters.departmentId ? { departmentId: filters.departmentId } : {}),
    ...(filters.campusId ? { department: { campusId: filters.campusId } } : {}),
  };

  return {
    institutionId,
    status: "ACTIVE",
    ...(filters.batchId ? { batchId: filters.batchId } : {}),
    ...(filters.programId || filters.departmentId || filters.campusId ? { program: programWhere } : {}),
    ...(filters.academicYearId ? { academicYearId: filters.academicYearId } : {}),
    ...(filters.semesterId ? { semesterId: filters.semesterId } : {}),
    ...(filters.sectionId ? { sectionId: filters.sectionId } : {}),
  };
}
