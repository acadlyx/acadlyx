import type { AuthUser } from "./auth";
import {
  canAccessRoute,
  navigationForUser,
} from "./navigation";

export type InstitutionAdminNavItem = {
  label: string;
  href: string;
  icon: string;
  group: string;
  permission?: string;
  description: string;
};

/**
 * Compatibility adapter only.
 *
 * Institution Admin navigation is owned exclusively by:
 *
 *   src/lib/navigation.ts
 *
 * This file deliberately contains no second navigation catalogue.
 */
export const INSTITUTION_ADMIN_NAVIGATION: readonly InstitutionAdminNavItem[] =
  [];

export function getInstitutionAdminNavigation(
  user:
    | AuthUser
    | null
    | undefined,
): InstitutionAdminNavItem[] {
  if (!user) {
    return [];
  }

  return navigationForUser(user)
    .filter(
      (item) =>
        item.roles.includes(
          "INSTITUTION_ADMIN",
        ),
    )
    .map((item) => ({
      label: item.label,
      href: item.href,
      icon: item.icon,
      group:
        item.group ||
        "Workspace",
      permission:
        item.permissions?.[0],
      description:
        `Open ${item.label.toLowerCase()}.`,
    }));
}

export function institutionAdminRouteAllowed(
  user:
    | AuthUser
    | null
    | undefined,
  pathname: string,
): boolean {
  if (
    !user ||
    !user.roles.includes(
      "INSTITUTION_ADMIN",
    )
  ) {
    return false;
  }

  return canAccessRoute(
    user,
    pathname,
    ["INSTITUTION_ADMIN"],
  );
}
