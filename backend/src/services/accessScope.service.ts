import { prisma } from "../lib/prisma";
import { AppError } from "../middleware/errorHandler";
import { AuthenticatedUser } from "../types/auth";
import { getCanonicalRoleNames } from "../config/rbac";

/**
 * Central resource-level scope checks shared by every module.
 *
 * Permissions (config/rbac.ts) answer "may this role use the module at all".
 * These helpers answer "may this actor touch THIS record". Every check is
 * bound to the actor's authenticated institution.
 */

/** Roles with institution-wide visibility inside their own tenant. */
export const INSTITUTION_WIDE_ROLES = [
  "INSTITUTION_ADMIN",
  "DIRECTOR",
  "CHAIRMAN",
  "DEAN",
  "REGISTRAR",
];

export function hasAnyRole(
  actor: Pick<AuthenticatedUser, "roles">,
  roles: readonly string[]
): boolean {
  const canonical = getCanonicalRoleNames(actor.roles);\n  return canonical.some((role) => roles.includes(role));
}

export function isInstitutionWide(
  actor: Pick<AuthenticatedUser, "roles">
): boolean {
  return hasAnyRole(actor, INSTITUTION_WIDE_ROLES);
}

/** Department ids the HOD is authorised to manage (tenant-checked). */
export async function getManagedDepartmentIds(
  institutionId: string,
  userId: string
): Promise<string[]> {
  const rows = await prisma.departmentAccess.findMany({
    where: { userId, department: { institutionId } },
    select: { departmentId: true },
  });
  return rows.map((row) => row.departmentId);
}

/** Departments a student belongs to through any enrollment. */
export async function getStudentDepartmentIds(
  institutionId: string,
  studentId: string
): Promise<string[]> {
  const rows = await prisma.studentEnrollment.findMany({
    where: { institutionId, userId: studentId },
    select: { program: { select: { departmentId: true } } },
  });
  return Array.from(new Set(rows.map((row) => row.program.departmentId)));
}

/** Loads a user's role names, scoped to the institution. */
export async function getUserRoleNames(
  institutionId: string,
  userId: string
): Promise<string[]> {
  const user = await prisma.user.findFirst({
    where: { id: userId, institutionId },
    select: { userRoles: { select: { role: { select: { name: true } } } } },
  });
  if (!user) throw new AppError("User not found in this institution", 404);
  return user.userRoles.map((binding) => binding.role.name);
}

/** Department ids a non-student user is associated with. */
export async function getStaffDepartmentIds(
  institutionId: string,
  userId: string
): Promise<string[]> {
  const [teaching, employee, access] = await Promise.all([
    prisma.courseOffering.findMany({
      where: { institutionId, facultyId: userId },
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
 * A HOD may only reach users inside a managed department. Used before
 * acting on a person (notify, leave decision, document, registration).
 */
export async function assertHodCanReachUser(
  institutionId: string,
  actor: AuthenticatedUser,
  targetUserId: string
): Promise<void> {
  if (actor.id === targetUserId) return;

  const managed = await getManagedDepartmentIds(institutionId, actor.id);
  if (managed.length === 0) {
    throw new AppError("You have no department scope assigned", 403);
  }

  const roles = await getUserRoleNames(institutionId, targetUserId);
  const departments = roles.includes("STUDENT")
    ? await getStudentDepartmentIds(institutionId, targetUserId)
    : await getStaffDepartmentIds(institutionId, targetUserId);

  if (!departments.some((id) => managed.includes(id))) {
    throw new AppError("This person is outside your department scope", 403);
  }
}

/**
 * Authoritative student-record visibility rule.
 *   self · linked parent · institution-wide roles + staff ·
 *   HOD of the student's department · faculty teaching the student.
 */
export async function assertCanViewStudent(
  institutionId: string,
  actor: AuthenticatedUser,
  studentId: string
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

  if (actor.id === studentId) return;
  if (isInstitutionWide(actor)) return;

  if (getCanonicalRoleNames(actor.roles).includes("PARENT")) {
    const link = await prisma.parentStudentLink.findFirst({
      where: { institutionId, parentId: actor.id, studentId },
      select: { parentId: true },
    });
    if (link) return;
  }

  if (getCanonicalRoleNames(actor.roles).includes("HOD")) {
    const [managed, studentDepartments] = await Promise.all([
      getManagedDepartmentIds(institutionId, actor.id),
      getStudentDepartmentIds(institutionId, studentId),
    ]);
    if (studentDepartments.some((id) => managed.includes(id))) return;
  }

  if (getCanonicalRoleNames(actor.roles).includes("FACULTY")) {
    const taught = await prisma.courseOffering.findFirst({
      where: {
        institutionId,
        facultyId: actor.id,
        OR: [
          {
            section: {
              studentEnrollments: {
                some: { userId: studentId, institutionId },
              },
            },
          },
          {
            registrations: {
              some: { studentId, status: "APPROVED", institutionId },
            },
          },
        ],
      },
      select: { id: true },
    });
    if (taught) return;
  }

  throw new AppError("This student is outside your authorized scope", 403);
}

/** Validates that a set of ids all belong to the institution. */
export async function assertUsersInInstitution(
  institutionId: string,
  userIds: string[]
): Promise<void> {
  const unique = Array.from(new Set(userIds));
  const count = await prisma.user.count({
    where: { institutionId, id: { in: unique }, isActive: true },
  });
  if (count !== unique.length) {
    throw new AppError("One or more users are not in this institution", 404);
  }
}
