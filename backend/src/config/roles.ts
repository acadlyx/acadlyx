/**
 * Legacy compatibility facade.
 *
 * The canonical role and permission model lives in ./rbac. Existing imports
 * of ./roles are intentionally kept working during the migration, but this
 * file no longer maintains a second role matrix.
 */

export {
  INSTITUTION_ROLES,
  LEGACY_ROLE_ALIASES as ROLE_ALIASES,
  PERMISSIONS,
  PLATFORM_ROLES,
  ROLE_PERMISSIONS,
  ROLE_RANK,
  SYSTEM_ROLE_NAMES,
  getCanonicalRoleNames,
  getCanonicalRoles,
  getEffectivePermissions,
  getRolePermissions,
  hasPermission,
  hasRole,
  highestRoleRank,
  isInstitutionRole,
  isPlatformPermission,
  isPlatformRole,
  isSupportedRole,
  normalizeRoleName,
  outranks,
} from "./rbac";

export type { PermissionKey, SystemRoleName } from "./rbac";
import type { PermissionKey, SystemRoleName } from "./rbac";

export const LEGACY_ROLE_NAMES = [
  "MANAGEMENT",
  "STAFF",
] as const;

export type LegacyRoleName =
  (typeof LEGACY_ROLE_NAMES)[number];

export type KnownRoleName =
  | SystemRoleName
  | LegacyRoleName;

import {
  LEGACY_ROLE_ALIASES,
  ROLE_RANK,
  hasPermission,
  normalizeRoleName,
  outranks,
} from "./rbac";

export function rolesHavePermission(
  roles: readonly string[],
  permission: PermissionKey
): boolean {
  return hasPermission(roles, permission);
}

export function getRoleRank(role: string): number {
  const canonical = normalizeRoleName(role);
  return canonical ? ROLE_RANK[canonical] ?? 0 : 0;
}

export function canRoleOutrank(
  approverRoles: readonly string[],
  applicantRoles: readonly string[]
): boolean {
  return outranks(approverRoles, applicantRoles);
}

export { LEGACY_ROLE_ALIASES };
