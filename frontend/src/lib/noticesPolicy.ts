import { getPrimaryRole } from "./authority";

/**
 * Must match backend/src/config/rbac.ts NOTICE_MANAGEMENT_ROLES.
 * Effective-role ownership is checked as well as the permission union, so a
 * secondary role cannot expose notice publishing in a read-only workspace.
 */
export const NOTICE_MANAGEMENT_ROLES = [
  "SUPER_ADMIN",
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
