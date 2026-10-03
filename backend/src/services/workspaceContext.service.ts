import { prisma } from "../lib/prisma";
import { AppError } from "../middleware/errorHandler";
import { AuthenticatedUser } from "../types/auth";
import {
  getManagedDepartmentIds,
  getStaffDepartmentIds,
  getStudentDepartmentIds,
  isInstitutionWide,
} from "./accessScope.service";
import { getCanonicalRoleNames } from "../config/rbac";

export type WorkspaceContextInput = {
  departmentId?: string;
  programId?: string;
  academicYearId?: string;
  semesterId?: string;
  sectionId?: string;
  batchId?: string;
};

async function allowedDepartmentIds(
  institutionId: string,
  actor: AuthenticatedUser
): Promise<string[] | null> {
  if (isInstitutionWide(actor)) return null;
  const roles = getCanonicalRoleNames(actor.roles);
  if (roles.includes("HOD")) return getManagedDepartmentIds(institutionId, actor.id);
  if (roles.includes("FACULTY")) return getStaffDepartmentIds(institutionId, actor.id);
  if (roles.includes("STUDENT")) return getStudentDepartmentIds(institutionId, actor.id);
  return [];
}

function workspaceBasePath(roles: string[]) {
  if (roles.includes("HOD")) return "/hod";
  if (roles.includes("FACULTY")) return "/faculty";
  if (roles.includes("STUDENT")) return "/student";
  if (roles.includes("INSTITUTION_ADMIN")) return "/admin";
  if (roles.includes("REGISTRAR")) return "/registrar";
  if (roles.includes("DEAN")) return "/dean";
  if (roles.includes("DIRECTOR")) return "/director";
  if (roles.includes("CHAIRMAN")) return "/chairman";
  return "/dashboard";
}

async function assertDepartmentScope(
  institutionId: string,
  actor: AuthenticatedUser,
  departmentId: string
) {
  const allowed = await allowedDepartmentIds(institutionId, actor);
  if (allowed !== null && !allowed.includes(departmentId)) {
    throw new AppError("This department is outside your authorized scope", 403);
  }
}

export async function getWorkspaceContext(
  institutionId: string,
  actor: AuthenticatedUser,
  input: WorkspaceContextInput = {}
) {
  const allowed = await allowedDepartmentIds(institutionId, actor);
  const roles = getCanonicalRoleNames(actor.roles);
  let departmentId = input.departmentId;

  if (!departmentId && allowed?.length === 1) departmentId = allowed[0];
  if (departmentId) await assertDepartmentScope(institutionId, actor, departmentId);

  if (roles.includes("STUDENT")) {
    const enrollment = await prisma.studentEnrollment.findFirst({
      where: { institutionId, userId: actor.id, status: "ACTIVE" },
      orderBy: { enrolledAt: "desc" },
      select: {
        programId: true,
        academicYearId: true,
        semesterId: true,
        sectionId: true,
        batchId: true,
        program: { select: { departmentId: true } },
      },
    });

    if (!enrollment) {
      return {
        role: "STUDENT",
        scope: {
          institutionId,
          departmentId: null,
          programId: null,
          academicYearId: null,
          semesterId: null,
          sectionId: null,
        },
        breadcrumbs: [],
        children: { departments: [], programs: [], academicYears: [], semesters: [], sections: [] },
      };
    }

    departmentId = enrollment.program.departmentId;
    input = {
      departmentId,
      programId: enrollment.programId,
      academicYearId: enrollment.academicYearId,
      semesterId: enrollment.semesterId ?? undefined,
      sectionId: enrollment.sectionId ?? undefined,
      batchId: enrollment.batchId ?? undefined,
    };
  }

  const departments = await prisma.department.findMany({
    where: {
      institutionId,
      isActive: true,
      ...(allowed ? { id: { in: allowed } } : {}),
      ...(departmentId ? { id: departmentId } : {}),
    },
    select: {
      id: true,
      name: true,
      code: true,
      campus: { select: { id: true, name: true, code: true } },
    },
    orderBy: { name: "asc" },
  });

  if (departmentId && departments.length !== 1) {
    throw new AppError("Department not found in your authorized institution scope", 404);
  }

  const selectedDepartment = departments[0] ?? null;

  if (input.batchId) {
    const batch = await prisma.batch.findFirst({
      where: {
        id: input.batchId,
        institutionId,
        isActive: true,
        ...(input.programId ? { programId: input.programId } : {}),
      },
      select: { id: true },
    });
    if (!batch) throw new AppError("Batch is not valid for the selected program", 404);
  }

  if (input.programId) {
    const program = await prisma.program.findFirst({
      where: {
        id: input.programId,
        institutionId,
        isActive: true,
        ...(selectedDepartment ? { departmentId: selectedDepartment.id } : {}),
      },
      select: { id: true },
    });
    if (!program) throw new AppError("Program is not valid for the selected department", 404);
  }

  const programs = await prisma.program.findMany({
    where: {
      institutionId,
      isActive: true,
      ...(selectedDepartment ? { departmentId: selectedDepartment.id } : {}),
    },
    select: {
      id: true,
      name: true,
      code: true,
      level: true,
      durationYears: true,
      departmentId: true,
    },
    orderBy: { name: "asc" },
  });

  const academicYears = await prisma.academicYear.findMany({
    where: {
      institutionId,
      ...(input.programId
        ? { semesters: { some: { programId: input.programId, isActive: true } } }
        : {}),
    },
    select: { id: true, name: true, startDate: true, endDate: true, isCurrent: true },
    orderBy: [{ isCurrent: "desc" }, { startDate: "desc" }],
  });

  const semesters = await prisma.semester.findMany({
    where: {
      institutionId,
      isActive: true,
      ...(input.programId ? { programId: input.programId } : {}),
      ...(input.academicYearId ? { academicYearId: input.academicYearId } : {}),
    },
    select: {
      id: true,
      name: true,
      number: true,
      programId: true,
      academicYearId: true,
      program: { select: { id: true, name: true, code: true, departmentId: true } },
      academicYear: { select: { id: true, name: true, isCurrent: true } },
    },
    orderBy: { number: "asc" },
  });

  const selectedSemester = input.semesterId
    ? semesters.find((semester) => semester.id === input.semesterId) ?? null
    : null;

  if (input.semesterId && !selectedSemester) {
    throw new AppError("Semester is not valid for the selected academic context", 404);
  }

  const sections = selectedSemester
    ? await prisma.section.findMany({
        where: { institutionId, semesterId: selectedSemester.id, isActive: true },
        select: { id: true, name: true, capacity: true, semesterId: true },
        orderBy: { name: "asc" },
      })
    : [];

  const selectedSection = input.sectionId
    ? sections.find((section) => section.id === input.sectionId) ?? null
    : null;

  if (input.sectionId && !selectedSection) {
    throw new AppError("Section is not valid for the selected semester", 404);
  }

  const batches = input.programId
    ? await prisma.batch.findMany({
        where: { institutionId, programId: input.programId, isActive: true },
        select: { id: true, name: true, code: true, programId: true, admissionYear: true, completionYear: true },
        orderBy: { admissionYear: "desc" },
      })
    : [];

  const selectedBatch = input.batchId
    ? batches.find((batch) => batch.id === input.batchId) ?? null
    : null;

  const selectedProgram = input.programId
    ? programs.find((program) => program.id === input.programId) ?? null
    : null;

  const selectedYear = input.academicYearId
    ? academicYears.find((year) => year.id === input.academicYearId) ?? null
    : null;

  const basePath = workspaceBasePath(roles);
  const contextHref = (extra: Record<string, string | undefined> = {}) => {
    const params = new URLSearchParams();
    const values = { departmentId, programId: input.programId, batchId: input.batchId, academicYearId: input.academicYearId, semesterId: input.semesterId, sectionId: input.sectionId, ...extra };
    Object.entries(values).forEach(([key, value]) => { if (value) params.set(key, value); });
    const query = params.toString();
    return query ? `${basePath}?${query}` : basePath;
  };
  const breadcrumbs: Array<{ type: string; id: string; label: string; href: string }> = [
    { type: "institution", id: institutionId, label: "Institution", href: basePath },
  ];

  if (selectedDepartment) {
    breadcrumbs.push({
      type: "department",
      id: selectedDepartment.id,
      label: selectedDepartment.name,
      href: contextHref({ departmentId: selectedDepartment.id, programId: undefined, batchId: undefined, academicYearId: undefined, semesterId: undefined, sectionId: undefined }),
    });
  }

  if (selectedProgram) {
    breadcrumbs.push({
      type: "program",
      id: selectedProgram.id,
      label: selectedProgram.name,
      href: contextHref({ departmentId: selectedProgram.departmentId, programId: selectedProgram.id }),
    });
  }

  if (selectedYear) {
    breadcrumbs.push({ type: "academicYear", id: selectedYear.id, label: selectedYear.name, href: contextHref({ academicYearId: selectedYear.id }) });
  }

  if (selectedSemester) {
    breadcrumbs.push({ type: "semester", id: selectedSemester.id, label: selectedSemester.name, href: contextHref({ semesterId: selectedSemester.id }) });
  }

  if (selectedBatch) {
    breadcrumbs.push({ type: "batch", id: selectedBatch.id, label: selectedBatch.name, href: contextHref({ batchId: selectedBatch.id }) });
  }

  if (selectedSection) {
    breadcrumbs.push({ type: "section", id: selectedSection.id, label: selectedSection.name, href: contextHref({ sectionId: selectedSection.id }) });
  }

  return {
    role: roles[0] ?? "UNKNOWN",
    scope: {
      institutionId,
      departmentId: selectedDepartment?.id ?? null,
      programId: selectedProgram?.id ?? null,
      academicYearId: selectedYear?.id ?? null,
      semesterId: selectedSemester?.id ?? null,
      sectionId: selectedSection?.id ?? null,
      batchId: selectedBatch?.id ?? null,
    },
    breadcrumbs,
    children: { departments, programs, academicYears, batches, semesters, sections },
  };
}
