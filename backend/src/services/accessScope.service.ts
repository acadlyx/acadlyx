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

export const INSTITUTION_WIDE_ROLES = [
  "INSTITUTION_ADMIN",
  "CHAIRMAN",
  "REGISTRAR",
  "ACCOUNTS",
  "ADMISSIONS",
  "EXAMINATION",
  "SUPER_ADMIN",
];

export function hasAnyRole(
  actor: Pick<AuthenticatedUser, "roles">,
  roles: readonly string[],
): boolean {
  const canonical = getCanonicalRoleNames(actor.roles);
  return canonical.some((role) => roles.includes(role));
}

export function isInstitutionWide(
  actor: Pick<AuthenticatedUser, "roles">,
): boolean {
  return hasAnyRole(actor, INSTITUTION_WIDE_ROLES);
}

export async function getManagedDepartmentIds(
  institutionId: string,
  userId: string,
): Promise<string[]> {
  const rows = await prisma.departmentAccess.findMany({
    where: { userId, department: { institutionId } },
    select: { departmentId: true },
  });
  return rows.map((row) => row.departmentId);
}

export async function getStudentDepartmentIds(
  institutionId: string,
  studentId: string,
): Promise<string[]> {
  const rows = await prisma.studentEnrollment.findMany({
    where: { institutionId, userId: studentId, status: "ACTIVE" },
    select: { program: { select: { departmentId: true } } },
  });
  return Array.from(new Set(rows.map((row) => row.program.departmentId)));
}

export async function getUserRoleNames(
  institutionId: string,
  userId: string,
): Promise<string[]> {
  const user = await prisma.user.findFirst({
    where: { id: userId, institutionId },
    select: { userRoles: { select: { role: { select: { name: true } } } } },
  });
  if (!user) throw new AppError("User not found in this institution", 404);
  return user.userRoles.map((binding) => binding.role.name);
}

export async function getStaffDepartmentIds(
  institutionId: string,
  userId: string,
): Promise<string[]> {
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

/**
 * Director scope. The current schema has no dedicated Director→Campus
 * relation, so explicit DepartmentAccess rows are used as a fail-closed
 * campus proxy until a dedicated campus assignment is introduced.
 */
export async function getDirectorDepartmentIds(
  institutionId: string,
  userId: string,
): Promise<string[]> {
  return getManagedDepartmentIds(institutionId, userId);
}

export async function assertHodCanReachUser(
  institutionId: string,
  actor: AuthenticatedUser,
  targetUserId: string,
): Promise<void> {
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

export async function assertCanViewStudent(
  institutionId: string,
  actor: AuthenticatedUser,
  studentId: string,
): Promise<void> {
  const student = await prisma.user.findFirst({
    where: {
      id: studentId,
      institutionId,
      userRoles: { some: { role: { name: "STUDENT" } } },
    },
    select: { id: true },
  });
  if (!student) throw new AppError("Student not found in this institution", 404);

  if (actor.id === studentId || isInstitutionWide(actor)) return;

  const roles = getCanonicalRoleNames(actor.roles);

  if (roles.includes("PARENT")) {
    const link = await prisma.parentStudentLink.findFirst({
      where: { institutionId, parentId: actor.id, studentId },
      select: { parentId: true },
    });
    if (link) return;
  }

  if (roles.includes("DIRECTOR") || roles.includes("DEAN") || roles.includes("HOD")) {
    const [managed, studentDepartments] = await Promise.all([
      getManagedDepartmentIds(institutionId, actor.id),
      getStudentDepartmentIds(institutionId, studentId),
    ]);
    if (managed.length > 0 && studentDepartments.some((id) => managed.includes(id))) return;
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

export async function assertUsersInInstitution(
  institutionId: string,
  userIds: string[],
): Promise<void> {
  const unique = Array.from(new Set(userIds));
  const count = await prisma.user.count({
    where: { institutionId, id: { in: unique }, isActive: true },
  });
  if (count !== unique.length) {
    throw new AppError("One or more users are not in this institution", 404);
  }
}
