import { prisma } from "../lib/prisma";
import { AppError } from "../middleware/errorHandler";
import { AuthenticatedUser } from "../types/auth";
import {
  getAuthorizedDepartmentIds,
  isInstitutionWide,
} from "./accessScope.service";

export type AcademicContextInput = {
  institutionId: string;
  departmentId?: string;
  programId?: string;
  academicYearId?: string;
  semesterId?: string;
  sectionId?: string;
  courseId?: string;
  facultyId?: string;
};

export type ResolvedAcademicContext = {
  institutionId: string;
  department: {
    id: string;
    name: string;
    code: string;
    campusId: string | null;
  };
  program: {
    id: string;
    name: string;
    code: string;
    departmentId: string;
    isActive: boolean;
  };
  academicYear: {
    id: string;
    name: string;
    startDate: Date;
    endDate: Date;
    isCurrent: boolean;
  };
  semester: {
    id: string;
    name: string;
    number: number;
    programId: string;
    academicYearId: string;
    isActive: boolean;
  };
  section: {
    id: string;
    name: string;
    semesterId: string;
    capacity: number | null;
    isActive: boolean;
  };
  course?: {
    id: string;
    code: string;
    name: string;
    credits: number;
    departmentId: string;
    isActive: boolean;
  };
  faculty?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
};

/**
 * Single server-side resolver for the canonical academic hierarchy.
 * Every relationship is checked in the tenant before any caller is allowed
 * to use the resolved context.
 */
export async function resolveAcademicContext(
  input: AcademicContextInput,
): Promise<ResolvedAcademicContext> {
  const {
    institutionId,
    departmentId,
    programId,
    academicYearId,
    semesterId,
    sectionId,
    courseId,
    facultyId,
  } = input;

  if (!departmentId || !programId || !academicYearId || !semesterId || !sectionId) {
    throw new AppError(
      "Complete academic context is required: department, program, academic year, semester and section",
      400,
    );
  }

  const [department, program, academicYear, semester, section] = await Promise.all([
    prisma.department.findFirst({
      where: { id: departmentId, institutionId, isActive: true },
      select: { id: true, name: true, code: true, campusId: true },
    }),
    prisma.program.findFirst({
      where: { id: programId, institutionId, isActive: true },
      select: { id: true, name: true, code: true, departmentId: true, isActive: true },
    }),
    prisma.academicYear.findFirst({
      where: { id: academicYearId, institutionId },
      select: { id: true, name: true, startDate: true, endDate: true, isCurrent: true },
    }),
    prisma.semester.findFirst({
      where: { id: semesterId, institutionId, isActive: true },
      select: { id: true, name: true, number: true, programId: true, academicYearId: true, isActive: true },
    }),
    prisma.section.findFirst({
      where: { id: sectionId, institutionId, isActive: true },
      select: { id: true, name: true, semesterId: true, capacity: true, isActive: true },
    }),
  ]);

  if (!department) throw new AppError("Department not found or inactive", 404);
  if (!program) throw new AppError("Program not found or inactive", 404);
  if (!academicYear) throw new AppError("Academic year not found", 404);
  if (!semester) throw new AppError("Semester not found or inactive", 404);
  if (!section) throw new AppError("Section not found or inactive", 404);

  if (program.departmentId !== department.id) {
    throw new AppError("Program does not belong to the selected department", 400);
  }
  if (semester.programId !== program.id) {
    throw new AppError("Semester does not belong to the selected program", 400);
  }
  if (semester.academicYearId !== academicYear.id) {
    throw new AppError("Semester does not belong to the selected academic year", 400);
  }
  if (section.semesterId !== semester.id) {
    throw new AppError("Section does not belong to the selected semester", 400);
  }

  const [course, faculty] = await Promise.all([
    courseId
      ? prisma.course.findFirst({
          where: { id: courseId, institutionId, isActive: true },
          select: {
            id: true,
            code: true,
            name: true,
            credits: true,
            departmentId: true,
            isActive: true,
          },
        })
      : Promise.resolve(undefined),
    facultyId
      ? prisma.user.findFirst({
          where: {
            id: facultyId,
            institutionId,
            isActive: true,
            userRoles: { some: { role: { name: "FACULTY", institutionId } } },
          },
          select: { id: true, firstName: true, lastName: true, email: true },
        })
      : Promise.resolve(undefined),
  ]);

  if (courseId && !course) throw new AppError("Course not found or inactive", 404);
  if (course && course.departmentId !== department.id) {
    throw new AppError("Course does not belong to the selected department", 400);
  }

  if (facultyId && !faculty) {
    throw new AppError("Faculty member not found or inactive", 404);
  }

  return {
    institutionId,
    department,
    program,
    academicYear,
    semester,
    section,
    ...(course ? { course } : {}),
    ...(faculty ? { faculty } : {}),
  };
}

export async function assertAcademicContextScope(
  context: Pick<ResolvedAcademicContext, "department">,
  institutionId: string,
  actor: AuthenticatedUser,
): Promise<void> {
  if (context.department.id && !isInstitutionWide(actor)) {
    const allowed = await getAuthorizedDepartmentIds(institutionId, actor);
    if (!allowed.includes(context.department.id)) {
      throw new AppError("This academic context is outside your authorized scope", 403);
    }
  }
}

export async function assertFacultyEligibleForAcademicContext(
  institutionId: string,
  actor: AuthenticatedUser,
  facultyId: string,
  departmentId: string,
): Promise<void> {
  const faculty = await prisma.user.findFirst({
    where: {
      id: facultyId,
      institutionId,
      isActive: true,
      userRoles: { some: { role: { name: "FACULTY", institutionId } } },
    },
    select: {
      id: true,
      employeeProfile: { select: { departmentId: true } },
      departmentAccesses: { select: { departmentId: true } },
      facultyCourseOfferings: {
        where: { isActive: true },
        select: { course: { select: { departmentId: true } } },
        take: 100,
      },
    },
  });

  if (!faculty) throw new AppError("Faculty member not found or inactive", 404);

  const facultyDepartments = new Set<string>();
  if (faculty.employeeProfile?.departmentId) facultyDepartments.add(faculty.employeeProfile.departmentId);
  faculty.departmentAccesses.forEach((row) => facultyDepartments.add(row.departmentId));
  faculty.facultyCourseOfferings.forEach((row) => facultyDepartments.add(row.course.departmentId));

  if (!facultyDepartments.has(departmentId)) {
    throw new AppError("Faculty member is not eligible for the selected department", 400);
  }

  if (!isInstitutionWide(actor)) {
    const allowed = await getAuthorizedDepartmentIds(institutionId, actor);
    if (!allowed.includes(departmentId)) {
      throw new AppError("The selected department is outside your authorized scope", 403);
    }
  }
}

export async function getAcademicContextOptions(
  institutionId: string,
  actor: AuthenticatedUser,
  filters: {
    departmentId?: string;
    programId?: string;
    academicYearId?: string;
    semesterId?: string;
  },
) {
  const authorizedDepartments = await getAuthorizedDepartmentIds(institutionId, actor);
  const departmentIds = filters.departmentId
    ? [filters.departmentId]
    : authorizedDepartments;

  if (filters.departmentId && !authorizedDepartments.includes(filters.departmentId)) {
    throw new AppError("Department is outside your authorized scope", 403);
  }

  const [departments, academicYears, programs, semesters, sections] = await Promise.all([
    prisma.department.findMany({
      where: { institutionId, id: { in: authorizedDepartments }, isActive: true },
      select: { id: true, name: true, code: true, campusId: true },
      orderBy: { name: "asc" },
    }),
    prisma.academicYear.findMany({
      where: { institutionId },
      select: { id: true, name: true, startDate: true, endDate: true, isCurrent: true },
      orderBy: { startDate: "desc" },
      take: 20,
    }),
    prisma.program.findMany({
      where: {
        institutionId,
        isActive: true,
        ...(departmentIds.length ? { departmentId: { in: departmentIds } } : {}),
        ...(filters.programId ? { id: filters.programId } : {}),
      },
      select: { id: true, name: true, code: true, departmentId: true },
      orderBy: { name: "asc" },
      take: 200,
    }),
    prisma.semester.findMany({
      where: {
        institutionId,
        isActive: true,
        ...(filters.programId ? { programId: filters.programId } : {}),
        ...(filters.academicYearId ? { academicYearId: filters.academicYearId } : {}),
        ...(departmentIds.length ? { program: { departmentId: { in: departmentIds } } } : {}),
      },
      select: {
        id: true,
        name: true,
        number: true,
        programId: true,
        academicYearId: true,
      },
      orderBy: [{ number: "asc" }, { name: "asc" }],
      take: 200,
    }),
    prisma.section.findMany({
      where: {
        institutionId,
        isActive: true,
        ...(filters.semesterId ? { semesterId: filters.semesterId } : {}),
        ...(filters.programId || filters.academicYearId
          ? {
              semester: {
                ...(filters.programId ? { programId: filters.programId } : {}),
                ...(filters.academicYearId ? { academicYearId: filters.academicYearId } : {}),
                ...(departmentIds.length ? { program: { departmentId: { in: departmentIds } } } : {}),
              },
            }
          : {}),
      },
      select: { id: true, name: true, capacity: true, semesterId: true },
      orderBy: { name: "asc" },
      take: 500,
    }),
  ]);

  const departmentForPrograms = new Set(departmentIds);
  const safePrograms = programs.filter((program) => departmentForPrograms.has(program.departmentId));
  const safeSemesters = semesters.filter((semester) => safePrograms.some((program) => program.id === semester.programId));
  const safeSections = sections.filter((section) => safeSemesters.some((semester) => semester.id === section.semesterId));

  return {
    departments,
    academicYears,
    programs: safePrograms,
    semesters: safeSemesters,
    sections: safeSections,
  };
}
