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

export function canManageNotices(
  roles: string[],
  permissions: string[],
): boolean {
  const activeRole = getPrimaryRole(roles);
  return NOTICE_MANAGEMENT_ROLES.includes(
    activeRole as (typeof NOTICE_MANAGEMENT_ROLES)[number],
  ) && permissions.includes("notices.manage");
}
