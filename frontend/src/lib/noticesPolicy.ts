import { getPrimaryRole } from "./authority";

/**
 * Must match backend/src/config/rbac.ts NOTICE_MANAGEMENT_ROLES.
 * Effective-role ownership is checked as well as the permission union, so a
 * secondary role cannot expose notice publishing in a read-only workspace.
 * Platform Super Admin does not gain tenant notice-write authority by role alone.
 */
export const NOTICE_MANAGEMENT_ROLES = [
  "INSTITUTION_ADMIN",
  "CHAIRMAN",
  "DIRECTOR",
  "MANAGEMENT",
  "DEAN",
  "REGISTRAR",
  "HOD",
  "CMS",
] as const;

export const NOTICE_DEPARTMENT_TARGET_ROLES = [
  "INSTITUTION_ADMIN",
  "CHAIRMAN",
  "DIRECTOR",
  "DEAN",
  "MANAGEMENT",
  "REGISTRAR",
  "HOD",
] as const;

export const NOTICE_DEPARTMENT_REQUIRED_ROLES = [
  "DIRECTOR",
  "DEAN",
  "HOD",
] as const;

export function canTargetDepartmentWithNotice(roles: string[]): boolean {
  const activeRole = getPrimaryRole(roles);
  return NOTICE_DEPARTMENT_TARGET_ROLES.includes(
    activeRole as (typeof NOTICE_DEPARTMENT_TARGET_ROLES)[number],
  );
}

export function noticeRequiresDepartment(roles: string[]): boolean {
  const activeRole = getPrimaryRole(roles);
  return NOTICE_DEPARTMENT_REQUIRED_ROLES.includes(
    activeRole as (typeof NOTICE_DEPARTMENT_REQUIRED_ROLES)[number],
  );
}

export function canManageNotices(
  roles: string[],
  permissions: string[],
): boolean {
  const activeRole = getPrimaryRole(roles);
  return NOTICE_MANAGEMENT_ROLES.includes(
    activeRole as (typeof NOTICE_MANAGEMENT_ROLES)[number],
  ) && permissions.includes("notices.manage");
}
