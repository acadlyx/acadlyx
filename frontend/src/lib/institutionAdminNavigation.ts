import type { AuthUser } from "./auth";
import { hasPermission } from "./authorization";

export type InstitutionAdminNavItem = {
  label: string;
  href: string;
  icon: string;
  group: string;
  permission?: string;
  description: string;
};

/**
 * Institution Admin navigation.
 *
 * This is the single frontend source of truth for the Institution Admin
 * workspace.
 *
 * Visibility is permission-driven.
 *
 * The backend remains the final security boundary.
 * The frontend must never advertise a capability that the authenticated
 * account does not possess.
 */
export const INSTITUTION_ADMIN_NAVIGATION: readonly InstitutionAdminNavItem[] =
  [
    {
      label: "Overview",
      href: "/admin",
      icon: "home",
      group: "Workspace",
      description:
        "Institution-wide administration at a glance.",
    },

    {
      label: "People",
      href: "/user-management",
      icon: "people",
      group: "Administration",
      permission: "users.read",
      description:
        "Users, roles and account status.",
    },

    {
      label: "Timetable",
      href: "/timetable",
      icon: "calendar",
      group: "Institution",
      permission: "timetable.read",
      description:
        "Institution timetable and schedules.",
    },

    {
      label: "Notices",
      href: "/notices",
      icon: "notice",
      group: "Institution",
      permission: "notices.read",
      description:
        "Institution-wide communications.",
    },

    {
      label: "Calendar",
      href: "/calendar",
      icon: "date",
      group: "Institution",
      permission: "calendar.read",
      description:
        "Academic and institutional dates.",
    },

    {
      label: "Notifications",
      href: "/notifications",
      icon: "bell",
      group: "Institution",
      permission: "notifications.read",
      description:
        "Institution notification centre.",
    },

    {
      label: "Operations",
      href: "/operations",
      icon: "settings",
      group: "Institution",
      permission: "operations.read",
      description:
        "Operational records and requests.",
    },

    {
      label: "Admissions",
      href: "/admissions",
      icon: "admissions",
      group: "Oversight",
      permission: "admissions.read",
      description:
        "View institution admission applications.",
    },

    {
      label: "Reports",
      href: "/reports",
      icon: "reports",
      group: "Oversight",
      permission: "reports.read",
      description:
        "Institution-scoped reporting.",
    },

    {
      label: "Intelligence",
      href: "/intelligence",
      icon: "intelligence",
      group: "Oversight",
      permission: "intelligence.read",
      description:
        "Institution intelligence and insights.",
    },

    {
      label: "Course registration",
      href: "/course-registration",
      icon: "registration",
      group: "Oversight",
      permission: "registration.read",
      description:
        "View registration activity.",
    },

    {
      label: "Student movement",
      href: "/student-promotion",
      icon: "movement",
      group: "Oversight",
      permission: "promotions.read",
      description:
        "View promotion and movement requests.",
    },

    {
      label: "Certificates",
      href: "/certificates",
      icon: "certificate",
      group: "Oversight",
      permission: "certificates.read",
      description:
        "View certificate requests and status.",
    },

    {
      label: "Account security",
      href: "/account-security",
      icon: "shield",
      group: "Account",
      description:
        "Password, sessions and account security.",
    },
  ];

export function getInstitutionAdminNavigation(
  user: AuthUser | null | undefined,
): InstitutionAdminNavItem[] {
  if (!user) {
    return INSTITUTION_ADMIN_NAVIGATION.filter(
      (item) => !item.permission,
    );
  }

  return INSTITUTION_ADMIN_NAVIGATION.filter(
    (item) =>
      !item.permission ||
      hasPermission(user, item.permission),
  ).slice();
}

export function institutionAdminRouteAllowed(
  user: AuthUser | null | undefined,
  pathname: string,
): boolean {
  if (!user) {
    return false;
  }

  if (
    pathname === "/account-security" ||
    pathname.startsWith("/account-security/")
  ) {
    return true;
  }

  return getInstitutionAdminNavigation(user).some(
    (item) =>
      pathname === item.href ||
      pathname.startsWith(`${item.href}/`),
  );
}
