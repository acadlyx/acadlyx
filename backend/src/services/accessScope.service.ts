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

export const INSTITUTION_WIDE_ROLES = [
  "INSTITUTION_ADMIN",
  "CHAIRMAN",
  "REGISTRAR",
  "ACCOUNTS",
  "ADMISSIONS",
  "EXAMINATION",
  "SUPER_ADMIN",
];

export function hasAnyRole(actor: Pick<AuthenticatedUser, "roles">, roles: readonly string[]): boolean {
  const canonical = getCanonicalRoleNames(actor.roles);
  return canonical.some((role) => roles.includes(role));
}

export function isInstitutionWide(actor: Pick<AuthenticatedUser, "roles">): boolean {
  return hasAnyRole(actor, INSTITUTION_WIDE_ROLES);
}

export async function getAuthorizedDepartmentIds(
  institutionId: string,
  actor: AuthenticatedUser
): Promise<string[]> {
  if (isInstitutionWide(actor)) {
    const rows = await prisma.department.findMany({
      where: { institutionId, isActive: true },
      select: { id: true },
      orderBy: { name: "asc" },
    });
    return rows.map((row) => row.id);
  }

  const roles = getCanonicalRoleNames(actor.roles);
  if (roles.includes("DIRECTOR")) return getDirectorDepartmentIds(institutionId, actor.id);
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
  const rows = await prisma.departmentAccess.findMany({
    where: { userId, department: { institutionId } },
    select: { departmentId: true },
  });
  return rows.map((row) => row.departmentId);
}

/**
 * Director scope is campus-level. CampusAccess is the sole source of truth;
 * department assignments are never treated as a proxy for campus authority.
 */
export async function getDirectorCampusIds(institutionId: string, userId: string): Promise<string[]> {
  const rows = await prisma.campusAccess.findMany({
    where: {
      userId,
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
  if (actor.id && isInstitutionWide(actor)) return {};

  const roles = getCanonicalRoleNames(actor.roles);

  if (roles.includes("DIRECTOR")) {
    const departments = await getDirectorDepartmentIds(institutionId, actor.id);
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

export async function assertCanViewStudent(institutionId: string, actor: AuthenticatedUser, studentId: string): Promise<void> {
  const student = await prisma.user.findFirst({
    where: { id: studentId, institutionId, userRoles: { some: { role: { name: "STUDENT" } } } },
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

  if (roles.includes("DIRECTOR")) {
    const [allowedDepartments, studentDepartments] = await Promise.all([
      getDirectorDepartmentIds(institutionId, actor.id),
      getStudentDepartmentIds(institutionId, studentId),
    ]);
    if (studentDepartments.some((id) => allowedDepartments.includes(id))) return;
  }

  if (roles.includes("DEAN") || roles.includes("HOD")) {
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

export async function assertUsersInInstitution(institutionId: string, userIds: string[]): Promise<void> {
  const unique = Array.from(new Set(userIds));
  const count = await prisma.user.count({ where: { institutionId, id: { in: unique }, isActive: true } });
  if (count !== unique.length) throw new AppError("One or more users are not in this institution", 404);
}
