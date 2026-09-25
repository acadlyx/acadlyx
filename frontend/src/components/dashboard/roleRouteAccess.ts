import type { CanonicalRole } from "@/lib/authorization";
import { normalizeRole } from "@/lib/authorization";

const COMMON_ROUTES = [
  "/account-security",
] as const;

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
    "/timetable",
    "/notices",
    "/calendar",
    "/notifications",
    "/operations",
    "/admissions",
    "/reports",
    "/intelligence",
    "/course-registration",
    "/student-promotion",
    "/certificates",
    ...COMMON_ROUTES,
  ],

  CHAIRMAN: [
    "/chairman",
    "/intelligence",
    "/reports",
    "/calendar",
    ...COMMON_ROUTES,
  ],

  DIRECTOR: [
    "/director",
    "/intelligence",
    "/admissions",
    "/examinations",
    "/reports",
    "/calendar",
    ...COMMON_ROUTES,
  ],

  DEAN: [
    "/dean",
    "/intelligence",
    "/examinations",
    "/results",
    "/calendar",
    ...COMMON_ROUTES,
  ],

  REGISTRAR: [
    "/registrar",
    "/enrollment",
    "/course-registration",
    "/student-promotion",
    "/certificates",
    "/students",
    ...COMMON_ROUTES,
  ],

  HOD: [
    "/hod",
    "/erp",
    "/examinations",
    "/student-promotion",
    "/intelligence",
    "/calendar",
    ...COMMON_ROUTES,
  ],

  FACULTY: [
    "/faculty",
    "/faculty/attendance",
    "/faculty/assignments",
    "/faculty/marks",
    "/examinations",
    "/calendar",
    "/leave-management",
    ...COMMON_ROUTES,
  ],

  ACCOUNTS: [
    "/accounts",
    "/fees",
    "/fees/receipts",
    "/erp",
    "/reports",
    ...COMMON_ROUTES,
  ],

  HR: [
    "/hr",
    "/leave-management",
    "/calendar",
    ...COMMON_ROUTES,
  ],

  ADMISSIONS: [
    "/admissions",
    "/applications",
    ...COMMON_ROUTES,
  ],

  EXAMINATION: [
    "/examinations",
    "/results",
    "/calendar",
    ...COMMON_ROUTES,
  ],

  LIBRARIAN: [
    "/library",
    "/calendar",
    ...COMMON_ROUTES,
  ],

  PLACEMENT: [
    "/placements",
    "/intelligence",
    ...COMMON_ROUTES,
  ],

  IT: [
    "/it",
    "/operations",
    ...COMMON_ROUTES,
  ],

  CMS: [
    "/site-content",
    ...COMMON_ROUTES,
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
    ...COMMON_ROUTES,
  ],

  PARENT: [
    "/parent",
    "/parent/children",
    "/parent/students",
    "/calendar",
    ...COMMON_ROUTES,
  ],

  CLUB_PRESIDENT: [
    "/club-president",
    "/calendar",
    ...COMMON_ROUTES,
  ],
};

function matchesRoute(
  pathname: string,
  route: string,
) {
  return (
    pathname === route ||
    pathname.startsWith(
      `${route}/`,
    )
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
  return getAllowedRoutes(
    role,
  ).some(
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

  switch (
    canonical
  ) {
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
