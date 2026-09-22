import { prisma } from "../lib/prisma";
import { AppError } from "../middleware/errorHandler";
import { AuthenticatedUser } from "../types/auth";
import { getManagedDepartmentIds, getStudentDepartmentIds, getStaffDepartmentIds } from "./accessScope.service";

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

  const roles = applicant.userRoles.map((binding) => binding.role.name);

  // HR owns employee leave administration. It is not a blanket approval
  // authority over student leave.
  if (actor.roles.includes("HR")) {
    if (roles.includes("STUDENT")) {
      throw new AppError("HR is not the configured approver for student leave", 403);
    }
    return;
  }

  // HOD authority is limited to the department(s) explicitly assigned to it.
  if (actor.roles.includes("HOD")) {
    const managed = await getManagedDepartmentIds(institutionId, actor.id);
    if (managed.length === 0) {
      throw new AppError("You have no department scope assigned", 403);
    }

    const departments = roles.includes("STUDENT")
      ? await getStudentDepartmentIds(institutionId, applicantId)
      : await getStaffDepartmentIds(institutionId, applicantId);

    if (departments.some((id) => managed.includes(id))) return;
    throw new AppError("This leave applicant is outside your department scope", 403);
  }

  throw new AppError("You are not a configured leave approver", 403);
}

export function assertAdmissionWorkflowAuthority(actor: AuthenticatedUser): void {
  if (!actor.roles.includes("ADMISSIONS")) {
    throw new AppError("Only the Admissions role may operate the admission workflow", 403);
  }
}

export async function assertRegistrationApprovalAuthority(
  institutionId: string,
  actor: AuthenticatedUser,
  departmentId: string,
): Promise<void> {
  if (actor.roles.some((role) => ["DIRECTOR", "DEAN", "REGISTRAR"].includes(role))) return;

  if (actor.roles.includes("HOD")) {
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
  if (actor.roles.some((role) => ["DIRECTOR", "DEAN", "REGISTRAR"].includes(role))) return;

  if (actor.roles.includes("HOD")) {
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
  if (actor.roles.some((role) => ["ACCOUNTS", "DIRECTOR"].includes(role))) return;
  throw new AppError("Only Accounts or configured institutional leadership may approve this financial action", 403);
}

export function assertExaminationController(actor: AuthenticatedUser): void {
  if (actor.roles.some((role) => ["EXAMINATION", "DIRECTOR"].includes(role))) return;
  throw new AppError("Only the Examination Cell or configured examination leadership may perform this action", 403);
}
