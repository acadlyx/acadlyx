import { prisma } from "../lib/prisma";
import { AppError } from "../middleware/errorHandler";
import { AuthenticatedUser } from "../types/auth";
import {
  getDirectorDepartmentIds,
  getManagedDepartmentIds,
  getStaffDepartmentIds,
  getStudentDepartmentIds,
  getEffectiveWorkspaceRole,
  isDirectorScoped,
  isInstitutionWide,
} from "./accessScope.service";

export type WorkspaceContextInput = {
  campusId?: string;
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
  const activeRole = getEffectiveWorkspaceRole(actor);
  if (isDirectorScoped(actor)) return getDirectorDepartmentIds(institutionId, actor.id);
  if (activeRole === "DEAN" || activeRole === "HOD") {
    return getManagedDepartmentIds(institutionId, actor.id, activeRole);
  }
  if (activeRole === "FACULTY") return getStaffDepartmentIds(institutionId, actor.id);
  if (activeRole === "STUDENT") return getStudentDepartmentIds(institutionId, actor.id);
  return [];
}

function workspaceBasePath(activeRole: string) {
  if (activeRole === "HOD") return "/hod";
  if (activeRole === "FACULTY") return "/faculty";
  if (activeRole === "STUDENT") return "/student";
  if (activeRole === "INSTITUTION_ADMIN") return "/admin";
  if (activeRole === "REGISTRAR") return "/registrar";
  if (activeRole === "DEAN") return "/dean";
  if (activeRole === "DIRECTOR") return "/director";
  if (activeRole === "CHAIRMAN") return "/chairman";
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

async function buildWorkspaceContext(
  institutionId: string,
  actor: AuthenticatedUser,
  input: WorkspaceContextInput = {}
) {
  const allowed = await allowedDepartmentIds(institutionId, actor);
  const activeRole = getEffectiveWorkspaceRole(actor);
  // Preserve the user's request separately from the canonical values we later
  // derive. In particular, a Student request must not silently ignore an
  // attempted switch to a foreign/deleted campus or another enrollment.
  const requestedSelection = { ...input };
  let campusId = input.campusId;
  let departmentId = input.departmentId;

  if (!departmentId && allowed?.length === 1) departmentId = allowed[0];
  if (departmentId) await assertDepartmentScope(institutionId, actor, departmentId);

  if (activeRole === "STUDENT") {
    const enrollment = await prisma.studentEnrollment.findFirst({
      where: { institutionId, userId: actor.id, status: "ACTIVE" },
      orderBy: { enrolledAt: "desc" },
      select: {
        programId: true,
        academicYearId: true,
        semesterId: true,
        sectionId: true,
        batchId: true,
        program: { select: { departmentId: true, department: { select: { campusId: true } } } },
      },
    });

    if (!enrollment) {
      if (Object.values(requestedSelection).some((value) => typeof value === "string" && value.trim())) {
        throw new AppError("No active enrollment authorizes the requested academic context", 403);
      }
      return {
        role: "STUDENT",
        scope: {
          institutionId,
          campusId: null,
          departmentId: null,
          programId: null,
          academicYearId: null,
          semesterId: null,
          sectionId: null,
          batchId: null,
        },
        breadcrumbs: [],
        children: { campuses: [], departments: [], programs: [], academicYears: [], batches: [], semesters: [], sections: [] },
      };
    }

    const canonicalSelection: WorkspaceContextInput = {
      campusId: enrollment.program.department.campusId ?? undefined,
      departmentId: enrollment.program.departmentId,
      programId: enrollment.programId,
      academicYearId: enrollment.academicYearId,
      semesterId: enrollment.semesterId ?? undefined,
      sectionId: enrollment.sectionId ?? undefined,
      batchId: enrollment.batchId ?? undefined,
    };
    for (const key of ["campusId", "departmentId", "programId", "academicYearId", "batchId", "semesterId", "sectionId"] as const) {
      const requested = requestedSelection[key];
      if (typeof requested === "string" && requested.trim() && requested !== canonicalSelection[key]) {
        throw new AppError("Selected academic context is outside the student's active enrollment", 403);
      }
    }
    departmentId = canonicalSelection.departmentId;
    campusId = canonicalSelection.campusId;
    input = canonicalSelection;
  }

  const campuses = await prisma.campus.findMany({
    where: {
      institutionId,
      isActive: true,
      ...(allowed ? { departments: { some: { id: { in: allowed }, isActive: true } } } : {}),
    },
    select: { id: true, name: true, code: true },
    orderBy: { name: "asc" },
  });

  const requestedCampus = campusId ? campuses.find((campus) => campus.id === campusId) ?? null : null;
  if (campusId && !requestedCampus) {
    throw new AppError("Campus not found in your authorized institution scope", 404);
  }

  const departments = await prisma.department.findMany({
    where: {
      institutionId,
      isActive: true,
      ...(allowed ? { id: { in: allowed } } : {}),
      ...(campusId ? { campusId } : {}),
    },
    select: {
      id: true,
      name: true,
      code: true,
      campus: { select: { id: true, name: true, code: true } },
    },
    orderBy: { name: "asc" },
  });

  let selectedDepartment = departmentId
    ? departments.find((department) => department.id === departmentId) ?? null
    : departments.length === 1 ? departments[0] : null;

  if (departmentId && !selectedDepartment) {
    throw new AppError("Department not found in your authorized institution scope", 404);
  }
  if (!departmentId && selectedDepartment) departmentId = selectedDepartment.id;
  let effectiveCampusId = requestedCampus?.id ?? selectedDepartment?.campus?.id ?? null;
  let effectiveCampus = effectiveCampusId
    ? campuses.find((campus) => campus.id === effectiveCampusId) ?? selectedDepartment?.campus ?? null
    : null;

  const institutionPromise = prisma.institution.findUnique({
    where: { id: institutionId },
    select: { name: true, logoUrl: true },
  });

  const contextDepartmentIds = selectedDepartment ? [selectedDepartment.id] : departments.map((department) => department.id);

  const programsPromise = prisma.program.findMany({
    where: {
      institutionId,
      isActive: true,
      ...(selectedDepartment ? { departmentId: selectedDepartment.id } : allowed ? { departmentId: { in: allowed } } : {}),
      ...(campusId ? { department: { campusId } } : {}),
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

  const academicYearsPromise = prisma.academicYear.findMany({
    where: {
      institutionId,
      semesters: {
        some: {
          isActive: true,
          ...(input.programId
            ? { programId: input.programId }
            : { program: { departmentId: { in: contextDepartmentIds } } }),
        },
      },
    },
    select: { id: true, name: true, startDate: true, endDate: true, isCurrent: true },
    orderBy: [{ isCurrent: "desc" }, { startDate: "desc" }],
  });

  const semestersPromise = prisma.semester.findMany({
    where: {
      institutionId,
      isActive: true,
      ...(input.programId
        ? { programId: input.programId }
        : { program: { departmentId: { in: contextDepartmentIds } } }),
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

  const [programs, academicYears, semesters] = await Promise.all([
    programsPromise,
    academicYearsPromise,
    semestersPromise,
  ]);

  const selectedSemester = input.semesterId
    ? semesters.find((semester) => semester.id === input.semesterId) ?? null
    : null;

  if (input.semesterId && !selectedSemester) {
    throw new AppError("Semester is not valid for the selected academic context", 404);
  }
  if (selectedSemester) {
    if (!input.programId) input.programId = selectedSemester.programId;
    if (!input.academicYearId) input.academicYearId = selectedSemester.academicYearId;
  }

  const sectionsPromise = selectedSemester
    ? prisma.section.findMany({
        where: { institutionId, semesterId: selectedSemester.id, isActive: true },
        select: { id: true, name: true, capacity: true, semesterId: true },
        orderBy: { name: "asc" },
      })
    : [];

  const batchesPromise = input.programId
    ? prisma.batch.findMany({
        where: { institutionId, programId: input.programId, isActive: true },
        select: { id: true, name: true, code: true, programId: true, admissionYear: true, completionYear: true },
        orderBy: { admissionYear: "desc" },
      })
    : [];

  const [sections, batches] = await Promise.all([sectionsPromise, batchesPromise]);

  const selectedSection = input.sectionId
    ? sections.find((section) => section.id === input.sectionId) ?? null
    : null;

  if (input.sectionId && !selectedSection) {
    throw new AppError("Section is not valid for the selected semester", 404);
  }

  const selectedBatch = input.batchId
    ? batches.find((batch) => batch.id === input.batchId) ?? null
    : null;

  const selectedProgram = input.programId
    ? programs.find((program) => program.id === input.programId) ?? null
    : null;

  if (input.programId && !selectedProgram) {
    throw new AppError("Program is not valid for the selected department or authorized scope", 404);
  }
  if (selectedProgram) {
    const programDepartment = departments.find((department) => department.id === selectedProgram.departmentId) ?? null;
    if (!programDepartment || (selectedDepartment && selectedDepartment.id !== programDepartment.id)) {
      throw new AppError("Program is not valid for the selected department or authorized scope", 404);
    }
    selectedDepartment = programDepartment;
    departmentId = programDepartment.id;
    if (!effectiveCampusId && programDepartment.campus?.id) {
      effectiveCampusId = programDepartment.campus.id;
      effectiveCampus = campuses.find((campus) => campus.id === effectiveCampusId) ?? programDepartment.campus;
    }
  }

  if (input.batchId && !selectedBatch) {
    throw new AppError("Batch is not valid for the selected program", 404);
  }

  const selectedYear = input.academicYearId
    ? academicYears.find((year) => year.id === input.academicYearId) ?? null
    : null;

  if (input.academicYearId && !selectedYear) {
    throw new AppError("Academic year is not valid for the selected academic context", 404);
  }

  const institution = await institutionPromise;

  const basePath = workspaceBasePath(activeRole);
  const contextHref = (extra: Record<string, string | undefined> = {}) => {
    const params = new URLSearchParams();
    const values = { campusId: effectiveCampusId ?? undefined, departmentId, programId: input.programId, batchId: input.batchId, academicYearId: input.academicYearId, semesterId: input.semesterId, sectionId: input.sectionId, ...extra };
    Object.entries(values).forEach(([key, value]) => { if (value) params.set(key, value); });
    const query = params.toString();
    return query ? `${basePath}?${query}` : basePath;
  };
  const breadcrumbs: Array<{ type: string; id: string; label: string; href: string }> = [
    { type: "institution", id: institutionId, label: "Institution", href: basePath },
  ];

  if (effectiveCampus && effectiveCampusId) {
    breadcrumbs.push({
      type: "campus",
      id: effectiveCampusId,
      label: effectiveCampus.name,
      href: contextHref({ campusId: effectiveCampusId, departmentId: undefined, programId: undefined, batchId: undefined, academicYearId: undefined, semesterId: undefined, sectionId: undefined }),
    });
  }

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
    institution: {
      name: institution?.name ?? "",
      logoUrl: institution?.logoUrl ?? null,
    },
    role: activeRole,
    scope: {
      institutionId,
      campusId: effectiveCampusId,
      departmentId: selectedDepartment?.id ?? null,
      programId: selectedProgram?.id ?? null,
      academicYearId: selectedYear?.id ?? null,
      semesterId: selectedSemester?.id ?? null,
      sectionId: selectedSection?.id ?? null,
      batchId: selectedBatch?.id ?? null,
    },
    breadcrumbs,
    children: {
      campuses,
      departments,
      programs: selectedDepartment ? programs.filter((program) => program.departmentId === selectedDepartment?.id) : programs,
      academicYears,
      batches,
      semesters,
      sections,
    },
  };
}


/**
 * Compatibility hook for services that revoke/change academic access. The
 * workspace context is intentionally not memoized: campus/department grants
 * and enrollment state can be revoked without changing the user's role list.
 */
export function invalidateWorkspaceContextCache(_institutionId?: string): void {
  // No shared workspace-scope cache is retained.
}

export async function getWorkspaceContext(
  institutionId: string,
  actor: AuthenticatedUser,
  input: WorkspaceContextInput = {}
) {
  // A context response is an authorization decision. Resolve CampusAccess,
  // DepartmentAccess and enrollment state from the database on every request;
  // role bindings can stay unchanged while grants are revoked.
  return buildWorkspaceContext(institutionId, actor, input);
}
