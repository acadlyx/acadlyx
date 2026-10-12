import { prisma } from "../lib/prisma";
import { AppError } from "../middleware/errorHandler";
import { AuthenticatedUser } from "../types/auth";
import { isInstitutionWideFinance } from "./accessScope.service";
import {
  getManagedDepartmentIds,
  getStudentDepartmentIds,
  getStaffDepartmentIds,
  getDirectorDepartmentIds,
  assertCanViewStudent,
  assertCanViewUserRecord,
  isDirectorScoped,
  isInstitutionWide,
} from "./accessScope.service";
import { getCanonicalRoleNames } from "../config/rbac";

/**
 * Workflow authority is deliberately separate from generic permissions.
 * A permission opens a module; these checks decide whether this actor is the
 * configured authority for this particular workflow record.
 */

export async function assertLeaveDecisionAuthority(
  institutionId: string,
  actor: AuthenticatedUser,
  applicantId: string,
): Promise<void> {
  if (actor.id === applicantId) {
    throw new AppError("You cannot decide your own leave request", 403);
  }

  const applicant = await prisma.user.findFirst({
    where: { id: applicantId, institutionId },
    select: { id: true, userRoles: { select: { role: { select: { name: true } } } } },
  });
  if (!applicant) throw new AppError("Leave applicant not found", 404);

  const actorRoles = new Set(getCanonicalRoleNames(actor.roles));
  const applicantRoles = getCanonicalRoleNames(applicant.userRoles.map((binding) => binding.role.name));

  // HR is an employee-leave workflow owner, not an institution-wide override
  // for a Director/Dean/HOD account which happens to retain a legacy HR role.
  if (actorRoles.has("HR") && !isDirectorScoped(actor) &&
      !actorRoles.has("DEAN") && !actorRoles.has("HOD") &&
      !actorRoles.has("FACULTY") && !actorRoles.has("STUDENT") &&
      !actorRoles.has("PARENT")) {
    if (applicantRoles.includes("STUDENT")) {
      throw new AppError("HR is not the configured approver for student leave", 403);
    }
    return;
  }

  if (applicantRoles.includes("STUDENT")) {
    throw new AppError("HR is not the configured approver for student leave", 403);
  }

  // A Director may review only employee records inside their assigned campus;
  // Dean/HOD may review employees in their assigned department(s).
  if (isDirectorScoped(actor)) {
    await assertCanViewUserRecord(institutionId, actor, applicantId);
    return;
  }
  if (actorRoles.has("DEAN") || actorRoles.has("HOD")) {
    const managed = await getManagedDepartmentIds(institutionId, actor.id);
    if (!managed.length) throw new AppError("You have no department scope assigned", 403);
    const departments = await getStaffDepartmentIds(institutionId, applicantId);
    if (departments.some((id) => managed.includes(id))) return;
    throw new AppError("This leave applicant is outside your department scope", 403);
  }

  throw new AppError("You are not a configured leave approver", 403);
}

export function assertAdmissionWorkflowAuthority(actor: AuthenticatedUser): void {
  const roles = new Set(getCanonicalRoleNames(actor.roles));
  // Admissions is its own institution-wide workflow workspace. A secondary
  // ADMISSIONS binding must not widen an otherwise campus/department-scoped
  // account; record-scoped academic approvals use the dedicated authorities.
  if (!roles.has("ADMISSIONS") ||
      isDirectorScoped(actor) || roles.has("DEAN") || roles.has("HOD") ||
      roles.has("FACULTY") || roles.has("STUDENT") || roles.has("PARENT")) {
    throw new AppError("Only the Admissions workspace may operate the admission workflow", 403);
  }
}

export async function assertRegistrationApprovalAuthority(
  institutionId: string,
  actor: AuthenticatedUser,
  departmentId: string,
): Promise<void> {
  const roles = new Set(getCanonicalRoleNames(actor.roles));

  // Chairman's workspace intentionally remains institution-wide. A Director
  // who has an extra Dean/HOD/Registrar binding is still campus-scoped unless
  // Chairman is also bound to the account.
  if (isInstitutionWide(actor) && (roles.has("REGISTRAR") || roles.has("CHAIRMAN"))) return;

  if (isDirectorScoped(actor)) {
    const allowed = await getDirectorDepartmentIds(institutionId, actor.id);
    if (allowed.includes(departmentId)) return;
    throw new AppError("This course is outside your assigned campus approval scope", 403);
  }

  if (roles.has("DEAN") || roles.has("HOD")) {
    const managed = await getManagedDepartmentIds(institutionId, actor.id);
    if (managed.includes(departmentId)) return;
    throw new AppError("This course is outside your department approval scope", 403);
  }

  if (roles.has("REGISTRAR") && isInstitutionWide(actor)) return;
  throw new AppError("You are not a configured registration approver", 403);
}

export async function assertMovementApprovalAuthority(
  institutionId: string,
  actor: AuthenticatedUser,
  studentId: string,
): Promise<void> {
  const roles = new Set(getCanonicalRoleNames(actor.roles));

  if (isInstitutionWide(actor) && (roles.has("REGISTRAR") || roles.has("CHAIRMAN"))) return;

  if (isDirectorScoped(actor)) {
    await assertCanViewStudent(institutionId, actor, studentId);
    return;
  }

  if (roles.has("DEAN") || roles.has("HOD")) {
    const [managed, studentDepartments] = await Promise.all([
      getManagedDepartmentIds(institutionId, actor.id),
      getStudentDepartmentIds(institutionId, studentId),
    ]);
    if (studentDepartments.some((id) => managed.includes(id))) return;
    throw new AppError("This student is outside your department approval scope", 403);
  }

  if (roles.has("REGISTRAR") && isInstitutionWide(actor)) return;
  throw new AppError("You are not a configured student-lifecycle approver", 403);
}

export function assertFeeApprovalAuthority(actor: AuthenticatedUser): void {
  const roles = new Set(getCanonicalRoleNames(actor.roles));
  if (isDirectorScoped(actor) && roles.has("DIRECTOR")) return;
  if (isInstitutionWideFinance(actor) && roles.has("ACCOUNTS")) return;
  throw new AppError("Only Accounts or a Director in their assigned campus scope may approve this financial action", 403);
}

export function assertExaminationController(actor: AuthenticatedUser): void {
  if (actor.roles.includes("EXAMINATION")) return;
  throw new AppError("Only the Examination Cell may perform this operational examination action", 403);
}
