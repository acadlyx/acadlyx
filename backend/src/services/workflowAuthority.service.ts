import { prisma } from "../lib/prisma";
import { AppError } from "../middleware/errorHandler";
import { AuthenticatedUser } from "../types/auth";
import { isInstitutionWideFinance, getEffectiveWorkspaceRole } from "./accessScope.service";
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

  const activeRole = getEffectiveWorkspaceRole(actor);
  const applicantRoles = getCanonicalRoleNames(applicant.userRoles.map((binding) => binding.role.name));

  // Only the active HR workspace owns employee-leave administration. A
  // secondary HR role must not override a narrower or different workspace.
  if (activeRole === "HR") {
    if (applicantRoles.includes("STUDENT")) {
      throw new AppError("HR is not the configured approver for student leave", 403);
    }
    return;
  }

  if (applicantRoles.includes("STUDENT")) {
    throw new AppError("Student leave requires its dedicated student-leave approval workflow", 403);
  }

  // A Director may review only employee records inside their assigned campus;
  // Dean/HOD may review employees in their assigned department(s).
  if (activeRole === "DIRECTOR" && isDirectorScoped(actor)) {
    await assertCanViewUserRecord(institutionId, actor, applicantId);
    return;
  }
  if (activeRole === "DEAN" || activeRole === "HOD") {
    const managed = await getManagedDepartmentIds(institutionId, actor.id);
    if (!managed.length) throw new AppError("You have no department scope assigned", 403);
    const departments = await getStaffDepartmentIds(institutionId, applicantId);
    if (departments.some((id) => managed.includes(id))) return;
    throw new AppError("This leave applicant is outside your department scope", 403);
  }

  throw new AppError("You are not a configured leave approver", 403);
}

export function assertAdmissionWorkflowAuthority(actor: AuthenticatedUser): void {
  // Only an active Admissions workspace may operate institution-wide intake
  // workflows. Campus/department admission reviews use record-specific scope
  // checks instead; a secondary ADMISSIONS binding must not switch workspaces.
  if (getEffectiveWorkspaceRole(actor) !== "ADMISSIONS") {
    throw new AppError("Only the active Admissions workspace may operate the admission workflow", 403);
  }
}

export async function assertRegistrationApprovalAuthority(
  institutionId: string,
  actor: AuthenticatedUser,
  departmentId: string,
): Promise<void> {
  const activeRole = getEffectiveWorkspaceRole(actor);

  // Chairman and Registrar may approve institution-wide; secondary bindings
  // never turn Institution Admin/Accounts/another active role into Registrar.
  if (activeRole === "CHAIRMAN") return;
  if (activeRole === "REGISTRAR" && isInstitutionWide(actor)) return;

  if (activeRole === "DIRECTOR" && isDirectorScoped(actor)) {
    const allowed = await getDirectorDepartmentIds(institutionId, actor.id);
    if (allowed.includes(departmentId)) return;
    throw new AppError("This course is outside your assigned campus approval scope", 403);
  }

  if (activeRole === "DEAN" || activeRole === "HOD") {
    const managed = await getManagedDepartmentIds(institutionId, actor.id);
    if (managed.includes(departmentId)) return;
    throw new AppError("This course is outside your department approval scope", 403);
  }

  throw new AppError("You are not a configured registration approver", 403);
}

export async function assertMovementApprovalAuthority(
  institutionId: string,
  actor: AuthenticatedUser,
  studentId: string,
): Promise<void> {
  const activeRole = getEffectiveWorkspaceRole(actor);

  if (activeRole === "CHAIRMAN") return;
  if (activeRole === "REGISTRAR" && isInstitutionWide(actor)) return;

  if (activeRole === "DIRECTOR" && isDirectorScoped(actor)) {
    await assertCanViewStudent(institutionId, actor, studentId);
    return;
  }

  if (activeRole === "DEAN" || activeRole === "HOD") {
    const [managed, studentDepartments] = await Promise.all([
      getManagedDepartmentIds(institutionId, actor.id),
      getStudentDepartmentIds(institutionId, studentId),
    ]);
    if (studentDepartments.some((id) => managed.includes(id))) return;
    throw new AppError("This student is outside your department approval scope", 403);
  }

  throw new AppError("You are not a configured student-lifecycle approver", 403);
}

export function assertFeeApprovalAuthority(actor: AuthenticatedUser): void {
  const activeRole = getEffectiveWorkspaceRole(actor);
  if (activeRole === "CHAIRMAN") return;
  if (activeRole === "DIRECTOR" && isDirectorScoped(actor)) return;
  if (activeRole === "ACCOUNTS" && isInstitutionWideFinance(actor)) return;
  throw new AppError("Only Chairman, Accounts, or a Director in their assigned campus scope may approve this financial action", 403);
}

export function assertExaminationController(actor: AuthenticatedUser): void {
  if (getEffectiveWorkspaceRole(actor) === "EXAMINATION") return;
  throw new AppError("Only the active Examination workspace may perform this institutional examination action", 403);
}
