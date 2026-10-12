import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { AppError } from "../middleware/errorHandler";
import { AuthenticatedUser } from "../types/auth";
import { getCanonicalRoleNames } from "../config/rbac";

/**
 * Central resource-level scope checks shared by every module.
 * Permissions answer whether a role may use a module; these helpers answer
 * whether the authenticated actor may touch a particular record.
 * Scope is always derived server-side.
 */

/**
 * Roles that have general cross-module institutional record scope. Specialist
 * workspaces (Accounts, Admissions, Examination) are intentionally excluded:
 * each may be institution-wide inside its own module but must not inherit
 * generic access to student profiles, user records, notices or other modules.
 */
export const INSTITUTION_WIDE_ROLES = [
  "SUPER_ADMIN",
  "INSTITUTION_ADMIN",
  "CHAIRMAN",
  "MANAGEMENT",
  "REGISTRAR",
];

export function hasAnyRole(actor: Pick<AuthenticatedUser, "roles">, roles: readonly string[]): boolean {
  const canonical = getCanonicalRoleNames(actor.roles);
  return canonical.some((role) => roles.includes(role));
}

/**
 * Role bindings may contain legacy secondary roles. A broad secondary role
 * must not erase a narrower assigned workspace. Chairman is the explicit
 * exception: institution-wide Chairman authority intentionally wins over a
 * legacy Director binding. Otherwise campus/department/class/ownership roles
 * take precedence over institution-wide operational roles.
 */
const SCOPED_ROLES = [
  "DIRECTOR",
  "DEAN",
  "HOD",
  "FACULTY",
  "STUDENT",
  "PARENT",
  "PLACEMENT",
] as const;

export function isInstitutionWide(actor: Pick<AuthenticatedUser, "roles">): boolean {
  const roles = getCanonicalRoleNames(actor.roles);
  if (roles.includes("CHAIRMAN")) return true;
  if (roles.some((role) => SCOPED_ROLES.includes(role as typeof SCOPED_ROLES[number]))) {
    return false;
  }
  return roles.some((role) => INSTITUTION_WIDE_ROLES.includes(role));
}

/**
 * Module-specific institution-wide authority. This is deliberately separate
 * from isInstitutionWide(), which is used by generic student/user/record
 * scope guards and must not treat specialist role grants as global directory
 * access. Chairman is the explicit institution-wide override.
 */
export function hasScopedWorkspaceRole(actor: Pick<AuthenticatedUser, "roles">): boolean {
  const roles = getCanonicalRoleNames(actor.roles);
  return roles.some((role) => SCOPED_ROLES.includes(role as typeof SCOPED_ROLES[number]));
}

/**
 * The active workspace is derived from the same priority as the frontend.
 * A permission from a secondary role cannot silently switch the request into
 * a broader or different module. Keep this list aligned with frontend/authority.ts.
 */
const EFFECTIVE_WORKSPACE_ROLE_PRIORITY = [
  "CHAIRMAN",
  "DIRECTOR",
  "DEAN",
  "HOD",
  "FACULTY",
  "STUDENT",
  "PARENT",
  "PLACEMENT",
  "SUPER_ADMIN",
  "INSTITUTION_ADMIN",
  "MANAGEMENT",
  "REGISTRAR",
  "ACCOUNTS",
  "HR",
  "ADMISSIONS",
  "EXAMINATION",
  "LIBRARIAN",
  "IT",
  "CMS",
  "CLUB_PRESIDENT",
  "STAFF",
] as const;

export function getEffectiveWorkspaceRole(actor: Pick<AuthenticatedUser, "roles">): string {
  const roles = new Set(getCanonicalRoleNames(actor.roles));
  return EFFECTIVE_WORKSPACE_ROLE_PRIORITY.find((role) => roles.has(role)) ?? "UNASSIGNED";
}

export function isInstitutionWideForRole(
  actor: Pick<AuthenticatedUser, "roles">,
  moduleRole: "ACCOUNTS" | "ADMISSIONS" | "EXAMINATION",
): boolean {
  const activeRole = getEffectiveWorkspaceRole(actor);
  const allowedByModule: Record<typeof moduleRole, readonly string[]> = {
    // Institution Admin intentionally does not own Accounts/Fees.
    ACCOUNTS: ["SUPER_ADMIN", "CHAIRMAN", "MANAGEMENT", "REGISTRAR", "ACCOUNTS"],
    // Institution Admin may administer admissions, but this role must not
    // grant generic finance or examination authority.
    ADMISSIONS: ["SUPER_ADMIN", "CHAIRMAN", "INSTITUTION_ADMIN", "MANAGEMENT", "REGISTRAR", "ADMISSIONS"],
    // Institution Admin intentionally does not own Exams/Examination.
    EXAMINATION: ["SUPER_ADMIN", "CHAIRMAN", "MANAGEMENT", "REGISTRAR", "EXAMINATION"],
  };
  return allowedByModule[moduleRole].includes(activeRole);
}

export function isInstitutionWideFinance(actor: Pick<AuthenticatedUser, "roles">): boolean {
  return isInstitutionWideForRole(actor, "ACCOUNTS");
}

export function isInstitutionWideAdmissions(actor: Pick<AuthenticatedUser, "roles">): boolean {
  return isInstitutionWideForRole(actor, "ADMISSIONS");
}

export function isInstitutionWideExamination(actor: Pick<AuthenticatedUser, "roles">): boolean {
  return isInstitutionWideForRole(actor, "EXAMINATION");
}

/**
 * Chairman workspace authority is institution-wide and wins over a legacy
 * secondary Director role. Otherwise, a Director must stay campus-scoped even
 * if an old account has additional role bindings.
 */
export function isDirectorScoped(actor: Pick<AuthenticatedUser, "roles">): boolean {
  return hasAnyRole(actor, ["DIRECTOR"]) && !hasAnyRole(actor, ["CHAIRMAN"]);
}

export async function getAuthorizedDepartmentIds(
  institutionId: string,
  actor: AuthenticatedUser
): Promise<string[]> {
  if (isDirectorScoped(actor)) return getDirectorDepartmentIds(institutionId, actor.id);
  if (isInstitutionWide(actor)) {
    const rows = await prisma.department.findMany({
      where: { institutionId, isActive: true },
      select: { id: true },
      orderBy: { name: "asc" },
    });
    return rows.map((row) => row.id);
  }

  const roles = getCanonicalRoleNames(actor.roles);
  if (roles.includes("DEAN") || roles.includes("HOD")) return getManagedDepartmentIds(institutionId, actor.id);
  if (roles.includes("FACULTY")) return getStaffDepartmentIds(institutionId, actor.id);
  return [];
}

export async function assertDepartmentInScope(
  institutionId: string,
  actor: AuthenticatedUser,
  departmentId: string
): Promise<void> {
  const allowed = await getAuthorizedDepartmentIds(institutionId, actor);
  if (!allowed.includes(departmentId)) {
    throw new AppError("This department is outside your authorized scope", 403);
  }
}

export async function assertProgramInScope(institutionId: string, actor: AuthenticatedUser, programId: string) {
  const row = await prisma.program.findFirst({ where: { id: programId, institutionId }, select: { departmentId: true } });
  if (!row) throw new AppError("Program not found in this institution", 404);
  await assertDepartmentInScope(institutionId, actor, row.departmentId);
}

export async function assertSemesterInScope(institutionId: string, actor: AuthenticatedUser, semesterId: string) {
  const row = await prisma.semester.findFirst({ where: { id: semesterId, institutionId }, select: { program: { select: { departmentId: true } } } });
  if (!row) throw new AppError("Semester not found in this institution", 404);
  await assertDepartmentInScope(institutionId, actor, row.program.departmentId);
}

export async function assertSectionInScope(institutionId: string, actor: AuthenticatedUser, sectionId: string) {
  const row = await prisma.section.findFirst({ where: { id: sectionId, institutionId }, select: { semester: { select: { program: { select: { departmentId: true } } } } } });
  if (!row) throw new AppError("Section not found in this institution", 404);
  await assertDepartmentInScope(institutionId, actor, row.semester.program.departmentId);
}

export async function assertCourseInScope(institutionId: string, actor: AuthenticatedUser, courseId: string) {
  const row = await prisma.course.findFirst({ where: { id: courseId, institutionId }, select: { departmentId: true } });
  if (!row) throw new AppError("Course not found in this institution", 404);
  await assertDepartmentInScope(institutionId, actor, row.departmentId);
}

export async function assertCourseOfferingInScope(institutionId: string, actor: AuthenticatedUser, offeringId: string) {
  const row = await prisma.courseOffering.findFirst({ where: { id: offeringId, institutionId }, select: { semester: { select: { program: { select: { departmentId: true } } } } } });
  if (!row) throw new AppError("Course offering not found in this institution", 404);
  await assertDepartmentInScope(institutionId, actor, row.semester.program.departmentId);
}



export async function getManagedDepartmentIds(institutionId: string, userId: string): Promise<string[]> {
  // Inactive departments are no longer part of an operational workspace.
  // Keep the access rows for audit/history, but never grant live scope through
  // a disabled or cross-institution department.
  const rows = await prisma.departmentAccess.findMany({
    where: { userId, department: { institutionId, isActive: true } },
    select: { departmentId: true },
  });
  return Array.from(new Set(rows.map((row) => row.departmentId)));
}

/**
 * Director scope is campus-level. CampusAccess is the sole source of truth;
 * department assignments are never treated as a proxy for campus authority.
 */
export async function getDirectorCampusIds(institutionId: string, userId: string): Promise<string[]> {
  const rows = await prisma.campusAccess.findMany({
    where: {
      userId,
      scope: "DIRECTOR",
      campus: { institutionId, isActive: true },
    },
    select: { campusId: true },
  });
  return Array.from(new Set(rows.map((row) => row.campusId)));
}

export async function getDirectorDepartmentIds(institutionId: string, userId: string): Promise<string[]> {
  const campusIds = await getDirectorCampusIds(institutionId, userId);
  if (campusIds.length === 0) return [];

  const departments = await prisma.department.findMany({
    where: { institutionId, campusId: { in: campusIds }, isActive: true },
    select: { id: true },
  });
  return departments.map((row) => row.id);
}

export async function getStudentWhereScope(
  institutionId: string,
  actor: AuthenticatedUser
): Promise<Prisma.UserWhereInput> {
  if (isDirectorScoped(actor)) {
    const departments = await getDirectorDepartmentIds(institutionId, actor.id);
    if (!departments.length) return { id: "__NO_AUTHORIZED_STUDENT_SCOPE__" };
    return { studentEnrollments: { some: { institutionId, program: { departmentId: { in: departments } } } } };
  }
  if (actor.id && isInstitutionWide(actor)) return {};

  const roles = getCanonicalRoleNames(actor.roles);

  if (roles.includes("DEAN") || roles.includes("HOD")) {
    const departments = await getManagedDepartmentIds(institutionId, actor.id);
    if (!departments.length) return { id: "__NO_AUTHORIZED_STUDENT_SCOPE__" };
    return {
      studentEnrollments: {
        some: {
          institutionId,
          program: { departmentId: { in: departments } },
        },
      },
    };
  }

  if (roles.includes("FACULTY")) {
    const offerings = await prisma.courseOffering.findMany({
      where: { institutionId, facultyId: actor.id, isActive: true },
      select: { sectionId: true, semesterId: true },
    });
    if (!offerings.length) return { id: "__NO_AUTHORIZED_STUDENT_SCOPE__" };
    return {
      studentEnrollments: {
        some: {
          institutionId,
          OR: offerings.map((o) => ({ sectionId: o.sectionId, semesterId: o.semesterId })),
        },
      },
    };
  }

  if (roles.includes("STUDENT")) return { id: actor.id };

  // Placement Cell is not a generic institution-wide student directory.
  // Student access is limited to records that have an explicit placement
  // relationship: placement profile/snapshot or a placement application.
  if (roles.includes("PLACEMENT")) {
    return {
      OR: [
        { placementProfile: { isNot: null } },
        { placementAcademicSnapshot: { isNot: null } },
        { placementApplicationsOwned: { some: { institutionId } } },
      ],
    };
  }

  throw new AppError("Student access is not available for this role", 403);
}

export async function getStudentDepartmentIds(institutionId: string, studentId: string): Promise<string[]> {
  const rows = await prisma.studentEnrollment.findMany({
    where: { institutionId, userId: studentId, status: "ACTIVE" },
    select: { program: { select: { departmentId: true } } },
  });
  return Array.from(new Set(rows.map((row) => row.program.departmentId)));
}

export async function getUserRoleNames(institutionId: string, userId: string): Promise<string[]> {
  const user = await prisma.user.findFirst({
    where: { id: userId, institutionId },
    select: { userRoles: { select: { role: { select: { name: true } } } } },
  });
  if (!user) throw new AppError("User not found in this institution", 404);
  return user.userRoles.map((binding) => binding.role.name);
}

export async function getStaffDepartmentIds(institutionId: string, userId: string): Promise<string[]> {
  const [teaching, employee, access] = await Promise.all([
    prisma.courseOffering.findMany({
      where: { institutionId, facultyId: userId, isActive: true },
      select: { course: { select: { departmentId: true } } },
    }),
    prisma.employeeProfile.findFirst({
      where: { institutionId, userId },
      select: { departmentId: true },
    }),
    prisma.departmentAccess.findMany({
      where: { userId, department: { institutionId } },
      select: { departmentId: true },
    }),
  ]);

  const ids = new Set<string>();
  teaching.forEach((row) => ids.add(row.course.departmentId));
  if (employee?.departmentId) ids.add(employee.departmentId);
  access.forEach((row) => ids.add(row.departmentId));
  return Array.from(ids);
}

export async function assertHodCanReachUser(institutionId: string, actor: AuthenticatedUser, targetUserId: string): Promise<void> {
  if (actor.id === targetUserId) return;
  const managed = await getManagedDepartmentIds(institutionId, actor.id);
  if (managed.length === 0) throw new AppError("You have no department scope assigned", 403);

  const roles = await getUserRoleNames(institutionId, targetUserId);
  const departments = roles.includes("STUDENT")
    ? await getStudentDepartmentIds(institutionId, targetUserId)
    : await getStaffDepartmentIds(institutionId, targetUserId);

  if (!departments.some((id) => managed.includes(id))) {
    throw new AppError("This person is outside your department scope", 403);
  }
}

/**
 * Enforce record-level visibility for user-linked workflows (leave,
 * user-account lifecycle, approval queues). A broad permission grants the
 * action family, not visibility of every person's record.
 */
export async function assertCanViewUserRecord(
  institutionId: string,
  actor: AuthenticatedUser,
  targetUserId: string,
): Promise<void> {
  const target = await prisma.user.findFirst({
    where: { id: targetUserId, institutionId },
    select: {
      id: true,
      userRoles: { select: { role: { select: { name: true } } } },
    },
  });
  if (!target) throw new AppError("User not found in this institution", 404);
  if (actor.id === targetUserId) return;

  const targetRoles = getCanonicalRoleNames(target.userRoles.map((binding) => binding.role.name));
  if (targetRoles.includes("STUDENT")) {
    await assertCanViewStudent(institutionId, actor, targetUserId);
    return;
  }

  if (isInstitutionWide(actor)) return;

  const actorRoles = getCanonicalRoleNames(actor.roles);
  let allowedDepartmentIds: string[] = [];
  if (isDirectorScoped(actor)) {
    allowedDepartmentIds = await getDirectorDepartmentIds(institutionId, actor.id);
  } else if (actorRoles.includes("DEAN") || actorRoles.includes("HOD")) {
    allowedDepartmentIds = await getManagedDepartmentIds(institutionId, actor.id);
  } else {
    // Students, parents, placement staff, and faculty do not gain generic
    // access to other employee/user records through a general read permission.
    throw new AppError("This user is outside your authorized scope", 403);
  }

  if (allowedDepartmentIds.length === 0) {
    throw new AppError("No department scope is assigned to this account", 403);
  }
  const targetDepartmentIds = await getStaffDepartmentIds(institutionId, targetUserId);
  if (!targetDepartmentIds.some((id) => allowedDepartmentIds.includes(id))) {
    throw new AppError("This user is outside your authorized scope", 403);
  }
}

export async function assertCanViewStudent(institutionId: string, actor: AuthenticatedUser, studentId: string): Promise<void> {
  const student = await prisma.user.findFirst({
    where: { id: studentId, institutionId, userRoles: { some: { role: { name: "STUDENT" } } } },
    select: { id: true },
  });
  if (!student) throw new AppError("Student not found in this institution", 404);
  if (actor.id === studentId) return;
  if (isDirectorScoped(actor)) {
    const [allowedDepartments, studentDepartments] = await Promise.all([
      getDirectorDepartmentIds(institutionId, actor.id),
      getStudentDepartmentIds(institutionId, studentId),
    ]);
    if (studentDepartments.some((id) => allowedDepartments.includes(id))) return;
    throw new AppError("This student is outside your authorized campus scope", 403);
  }
  if (isInstitutionWide(actor)) return;

  const roles = getCanonicalRoleNames(actor.roles);
  if (roles.includes("PARENT")) {
    const link = await prisma.parentStudentLink.findFirst({
      where: { institutionId, parentId: actor.id, studentId },
      select: { parentId: true },
    });
    if (link) return;
  }

  if (roles.includes("DEAN") || roles.includes("HOD")) {
    const [managed, studentDepartments] = await Promise.all([
      getManagedDepartmentIds(institutionId, actor.id),
      getStudentDepartmentIds(institutionId, studentId),
    ]);
    if (managed.length > 0 && studentDepartments.some((id) => managed.includes(id))) return;
  }

  if (roles.includes("PLACEMENT")) {
    const eligible = await prisma.user.findFirst({
      where: {
        id: studentId,
        institutionId,
        OR: [
          { placementProfile: { isNot: null } },
          { placementAcademicSnapshot: { isNot: null } },
          { placementApplicationsOwned: { some: { institutionId } } },
        ],
      },
      select: { id: true },
    });
    if (eligible) return;
  }

  if (roles.includes("FACULTY")) {
    const taught = await prisma.courseOffering.findFirst({
      where: {
        institutionId,
        facultyId: actor.id,
        isActive: true,
        OR: [
          { section: { studentEnrollments: { some: { userId: studentId, institutionId, status: "ACTIVE" } } } },
          { registrations: { some: { studentId, status: "APPROVED", institutionId } } },
        ],
      },
      select: { id: true },
    });
    if (taught) return;
  }

  throw new AppError("This student is outside your authorized scope", 403);
}

export async function assertUsersInInstitution(institutionId: string, userIds: string[]): Promise<void> {
  const unique = Array.from(new Set(userIds));
  const count = await prisma.user.count({ where: { institutionId, id: { in: unique }, isActive: true } });
  if (count !== unique.length) throw new AppError("One or more users are not in this institution", 404);
}
