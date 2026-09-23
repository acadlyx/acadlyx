import type { CanonicalRole } from "@/lib/authorization";
import { normalizeRole } from "@/lib/authorization";

/**
 * UI route ownership map.
 *
 * Permissions answer:
 * "Can this account perform this capability?"
 *
 * Route ownership answers:
 * "Does this workspace contain this area at all?"
 *
 * Backend authorization remains the security boundary.
 */
const COMMON_ROUTES = [
  "/account-security",
];

const ROLE_ROUTES: Record<
  CanonicalRole,
  readonly string[]
> = {
  SUPER_ADMIN: [
    "/superadmin",
    ...COMMON_ROUTES,
  ],

  INSTITUTION_ADMIN: [
    "/admin",
    "/user-management",
    "/institution-settings",
    ...COMMON_ROUTES,
  ],

  CHAIRMAN: [
    "/chairman",
    "/intelligence",
    "/reports",
    "/calendar",
    "/account-security",
  ],

  DIRECTOR: [
    "/director",
    "/intelligence",
    "/admissions",
    "/examinations",
    "/reports",
    "/calendar",
    "/account-security",
  ],

  DEAN: [
    "/dean",
    "/intelligence",
    "/examinations",
    "/results",
    "/calendar",
    "/account-security",
  ],

  REGISTRAR: [
    "/registrar",
    "/enrollment",
    "/course-registration",
    "/student-promotion",
    "/certificates",
    "/students",
    "/account-security",
  ],

  HOD: [
    "/hod",
    "/erp",
    "/examinations",
    "/student-promotion",
    "/intelligence",
    "/calendar",
    "/account-security",
  ],

  FACULTY: [
    "/faculty",
    "/faculty/attendance",
    "/faculty/assignments",
    "/faculty/marks",
    "/examinations",
    "/calendar",
    "/leave-management",
    "/account-security",
  ],

  ACCOUNTS: [
    "/accounts",
    "/fees",
    "/fees/receipts",
    "/erp",
    "/reports",
    "/account-security",
  ],

  HR: [
    "/hr",
    "/leave-management",
    "/calendar",
    "/account-security",
  ],

  ADMISSIONS: [
    "/admissions",
    "/applications",
    "/account-security",
  ],

  EXAMINATION: [
    "/examinations",
    "/results",
    "/calendar",
    "/account-security",
  ],

  LIBRARIAN: [
    "/library",
    "/calendar",
    "/account-security",
  ],

  PLACEMENT: [
    "/placements",
    "/intelligence",
    "/account-security",
  ],

  IT: [
    "/it",
    "/operations",
    "/account-security",
  ],

  CMS: [
    "/site-content",
    "/account-security",
  ],

  STUDENT: [
    "/student",
    "/student/timetable",
    "/student/calendar",
    "/student/attendance",
    "/student/assignments",
    "/student/marks",
    "/student/results",
    "/student/examinations",
    "/student/fees",
    "/student/course-registration",
    "/student/library",
    "/student/certificates",
    "/student/leave",
    "/account-security",
  ],

  PARENT: [
    "/parent",
    "/parent/children",
    "/parent/students",
    "/calendar",
    "/account-security",
  ],

  CLUB_PRESIDENT: [
    "/club-president",
    "/calendar",
    "/account-security",
  ],
};

function matchesRoute(
  pathname: string,
  route: string,
): boolean {
  if (
    pathname === route
  ) {
    return true;
  }

  return pathname.startsWith(
    `${route}/`,
  );
}

export function getAllowedRoutes(
  role: string,
): readonly string[] {
  const canonical =
    normalizeRole(
      role,
    ) as CanonicalRole;

  return (
    ROLE_ROUTES[
      canonical
    ] ?? []
  );
}

export function isRouteInWorkspace(
  role: string,
  pathname: string,
): boolean {
  const allowed =
    getAllowedRoutes(role);

  return allowed.some(
    (route) =>
      matchesRoute(
        pathname,
        route,
      ),
  );
}

export function getWorkspaceHome(
  role: string,
): string {
  const canonical =
    normalizeRole(
      role,
    ) as CanonicalRole;

  switch (canonical) {
    case "SUPER_ADMIN":
      return "/superadmin";

    case "INSTITUTION_ADMIN":
      return "/admin";

    case "CHAIRMAN":
      return "/chairman";

    case "DIRECTOR":
      return "/director";

    case "DEAN":
      return "/dean";

    case "REGISTRAR":
      return "/registrar";

    case "HOD":
      return "/hod";

    case "FACULTY":
      return "/faculty";

    case "ACCOUNTS":
      return "/accounts";

    case "HR":
      return "/hr";

    case "ADMISSIONS":
      return "/admissions";

    case "EXAMINATION":
      return "/examinations";

    case "LIBRARIAN":
      return "/library";

    case "PLACEMENT":
      return "/placements";

    case "IT":
      return "/it";

    case "CMS":
      return "/site-content";

    case "STUDENT":
      return "/student";

    case "PARENT":
      return "/parent";

    case "CLUB_PRESIDENT":
      return "/club-president";

    default:
      return "/login";
  }
}

export function roleOwnsRoute(
  role: string,
  pathname: string,
): boolean {
  return isRouteInWorkspace(
    role,
    pathname,
  );
}
