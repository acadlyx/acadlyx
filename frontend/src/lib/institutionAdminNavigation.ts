import type { AuthUser } from "@/lib/auth";
import {
  INSTITUTION_ADMIN_NAV,
  hasAny,
  canSee,
  getAdminNavigation,
  findAdminNavItem,
  canAccessAdminPath,
} from "@/lib/adminNavigation";

export type InstitutionAdminNavItem =
  (typeof INSTITUTION_ADMIN_NAV)[number];

export {
  INSTITUTION_ADMIN_NAV,
  hasAny,
  canSee,
  findAdminNavItem,
  canAccessAdminPath,
};

export function getInstitutionAdminNavigation(
  user: AuthUser | null,
): InstitutionAdminNavItem[] {
  return getAdminNavigation(user);
}
