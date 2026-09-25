import type { AuthUser } from "./auth";

import {
  canUseNavigationItem,
  navigationForRole,
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
 * Compatibility adapter.
 *
 * Institution Admin navigation is no longer maintained separately.
 * The canonical registry lives in navigation.ts.
 */

export const INSTITUTION_ADMIN_NAVIGATION =
  navigationForRole(
    "INSTITUTION_ADMIN",
  ).map(
    (item) => ({
      label: item.label,
      href: item.href,
      icon: item.icon,
      group: item.group,
      permission:
        item.permissions?.[0],
      description:
        item.description ||
        `${item.label} workspace`,
    }),
  );

export function getInstitutionAdminNavigation(
  user:
    | AuthUser
    | null
    | undefined,
): InstitutionAdminNavItem[] {
  if (!user) {
    return INSTITUTION_ADMIN_NAVIGATION.filter(
      (item) =>
        !item.permission,
    );
  }

  return navigationForRole(
    "INSTITUTION_ADMIN",
  )
    .filter(
      (item) =>
        canUseNavigationItem(
          user,
          item,
        ),
    )
    .map(
      (item) => ({
        label: item.label,
        href: item.href,
        icon: item.icon,
        group: item.group,
        permission:
          item.permissions?.[0],
        description:
          item.description ||
          `${item.label} workspace`,
      }),
    );
}

export function institutionAdminRouteAllowed(
  user:
    | AuthUser
    | null
    | undefined,
  pathname: string,
): boolean {
  if (!user) {
    return false;
  }

  if (
    pathname ===
      "/account-security" ||
    pathname.startsWith(
      "/account-security/",
    )
  ) {
    return true;
  }

  return getInstitutionAdminNavigation(
    user,
  ).some(
    (item) =>
      pathname === item.href ||
      pathname.startsWith(
        `${item.href}/`,
      ),
  );
}
