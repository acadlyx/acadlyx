import { getPrimaryRole } from "./authority";

export type PermissionKey = string;

const ROLE_ALIASES: Record<string, string> = {};

function normalizeRoleName(role: string): string {
  const normalized = role.trim().toUpperCase();
  return ROLE_ALIASES[normalized] ?? normalized;
}

/**
 * Canonical role-owned destinations for sidebar links that start from a
 * shared module path. The shell and the authorization guard both consume this
 * table so a rewritten sidebar URL is authorized against the same destination.
 */
export const ROLE_ROUTE_OVERRIDES: Record<string, Record<string, string>> = {
  DEAN: { "/notices": "/dean/notices" },
  HOD: {
    "/timetable": "/hod/timetable",
    "/reports": "/hod/reports",
    "/intelligence": "/hod/intelligence",
    "/notices": "/hod/notices",
  },
  STUDENT: { "/notices": "/student/notices" },
  HR: { "/reports": "/hr/reports" },
  EXAMINATION: { "/reports": "/examination/reports" },
  REGISTRAR: { "/reports": "/registrar/reports" },
  ADMISSIONS: { "/reports": "/admissions/reports" },
  LIBRARIAN: { "/reports": "/library/reports" },
};

export function roleOwnedHref(role: string | null, href: string): string {
  return ROLE_ROUTE_OVERRIDES[role || ""]?.[href] || href;
}

const TENANT_FEATURE_BY_ROUTE: Array<[RegExp, string]> = [
  [/^\/accounts\/fees(\/|$)/, "fees"],
  [/^\/faculty\/operations(\/|$)/, "academics"],
  // Parent pages require Parent Portal even when a nested page also needs
  // its own feature (for example, fees or placements).
  [/^\/parent(\/|$)/, "parent_portal"],
  // Tenant policy covers role-owned routes outside generic module namespaces.
  [/^\/admin\/(academic-years|campuses|course-offerings)(\/|$)|^\/registrar\/academic-masters(\/|$)|^\/student\/academic(\/|$)/, "academics"],
  [/^\/admin\/calendar(\/|$)/, "calendar"],
  [/^\/(admin|student)\/documents(\/|$)/, "documents"],
  [/^\/admin\/institutional-cms(\/|$)/, "cms"],
  [/^\/admin\/parent-links(\/|$)/, "parent_portal"],
  [/^\/(admin|club-president|site-content)\/notices?(\/|$)/, "notices"],
  [/^\/(admin|club-president|site-content)\/notifications?(\/|$)/, "notifications"],
  [/^\/(admin|management|registrar)\/placements?(\/|$)/, "placements"],
  [/^\/(director|it)\/imports(\/|$)/, "import_export"],
  [/^\/(admin|staff)\/operations(\/|$)/, "operations"],
  [/^\/hod\/enrollment-requests(\/|$)|^\/student\/enrollment(\/|$)/, "admissions"],
  [/^\/hod\/course-registration-requests(\/|$)/, "registration"],
  [/^\/student\/admit-cards(\/|$)/, "exams"],
  [/^\/student\/marks(\/|$)/, "results"],
  [/^\/student\/leave(\/|$)|^\/leave-management(\/|$)|^\/(faculty|hod|director|dean|registrar|hr)\/leave(\/|$)/, "leave"],
  [/^\/(chairman|director|dean|hod|registrar|management|parent|accounts)\/(fees|payments|fee-approvals|fee-structures|fee-heads)(\/|$)/, "fees"],
  [/^\/payments(\/|$)/, "fees"],
  [/^\/parent\/children(\/|$)/, "parent_portal"],
  [/^\/(chairman|director|dean|hod|registrar|management|accounts|hr|parent|student|admissions|library|placements)\/students(\/|$)|^\/students(\/|$)/, "students"],
  [/^\/(chairman|director|dean|hod|registrar|management|hr|accounts)\/faculty(\/|$)|^\/faculty(\/|$)/, "faculty"],
  [/^\/(chairman|director|dean|registrar|admissions)\/(admissions|applications)(\/|$)|^\/applications(\/|$)|^\/admissions(\/|$)/, "admissions"],
  [/^\/student\/examinations\/(performance|results)(\/|$)/, "results"],
  [/^\/(chairman|director|dean|hod|registrar|faculty|student)\/examinations?(\/|$)/, "exams"],
  [/^\/(chairman|director|dean|hod|registrar|faculty|student|parent)\/results?(\/|$)/, "results"],
  [/^\/(chairman|director|dean|hod|faculty|student)\/attendance(\/|$)/, "attendance"],
  [/^\/(chairman|director|dean|hod|faculty|student)\/timetable(\/|$)/, "timetable"],
  [/^\/(chairman|director|dean|hod|faculty|student)\/assignments?(\/|$)/, "assignments"],
  [/^\/(chairman|director|dean|hod|faculty|student)\/obe(\/|$)/, "obe"],
  [/^\/(student|faculty|hod|librarian)\/library(\/|$)|^\/library(\/|$)/, "library"],
  [/^\/(chairman|director|dean|hod|faculty|student|parent|placement|placements)\/placements?(\/|$)|^\/placements?(\/|$)/, "placements"],
  [/^\/(chairman|director|dean|registrar|hod|faculty|student|parent)\/certificates?(\/|$)|^\/certificates?(\/|$)/, "certificates"],
  [/^\/(chairman|director|dean|registrar|hod|faculty|student)\/course-registration(\/|$)|^\/course-registration(\/|$)/, "registration"],
  [/^\/(chairman|director|dean|registrar|hod|faculty|student|accounts|hr|admissions|examination|placements|management|it|library)\/reports(\/|$)|^\/reports(\/|$)/, "reports"],
  [/^\/(chairman|director|dean|hod|management|registrar)\/intelligence(\/|$)|^\/intelligence(\/|$)/, "intelligence"],
  [/^\/(admin\/)?events-gallery(\/|$)|^\/(chairman|director|management|dean|registrar|hod|faculty|student|parent)\/events-gallery(\/|$)|^\/(site-content|institutionalcms)(\/|$)/, "cms"],
  [/^\/cms(\/|$)/, "cms"],
  [/^\/((director|dean|hod|faculty|student)\/)?examinations?(\/|$)/, "exams"],
  [/^\/examination(\/|$)/, "exams"],
  [/^\/((director|dean|hod|faculty|student)\/)?obe(\/|$)/, "obe"],
  [/^\/((student)\/)?results?(\/|$)/, "results"],
  [/^\/((student)\/)?attendance(\/|$)/, "attendance"],
  [/^\/((student)\/)?assignments?(\/|$)/, "assignments"],
  [/^\/((student)\/)?(fees|accounts)(\/|$)/, "fees"],
  [/^\/((student)\/)?library(\/|$)/, "library"],
  [/^\/((student)\/)?placements?(\/|$)/, "placements"],
  [/^\/((student)\/)?admissions?(\/|$)|^\/applications(\/|$)/, "admissions"],
  [/^\/enrollment(\/|$)/, "admissions"],
  [/^\/(hr|employees|faculty-management)(\/|$)/, "hr"],
  [/^\/((student)\/)?timetable(\/|$)/, "timetable"],
  [/^\/lms(\/|$)/, "lms"],
  [/^\/course-registration(\/|$)|^\/student\/course-registration(\/|$)/, "registration"],
  [/^\/certificates?(\/|$)/, "certificates"],
  [/^\/library(\/|$)/, "library"],
  [/^\/students(\/|$)/, "students"],
  [/^\/faculty(\/|$)/, "faculty"],
  [/^\/admin\/(students|departments|programs|academic|courses|sections|semesters|student-setup)(\/|$)/, "academics"],
  [/^\/(chairman|director|dean|registrar|hod|faculty|student|parent|accounts|hr|admissions|examination|library|placements|it|management|staff)\/notices?(\/|$)|^\/notices?(\/|$)/, "notices"],
  [/^\/(chairman|director|dean|registrar|hod|faculty|student|parent|accounts|hr|admissions|examination|library|placements|it|management|staff)\/notifications?(\/|$)|^\/notifications?(\/|$)/, "notifications"],
  [/^\/(chairman|director|dean|registrar|hod|faculty|student|accounts|hr|admissions|examination|placements|management|it|library)\/reports(\/|$)|^\/reports(\/|$)/, "reports"],
  [/^\/(chairman|director|dean|hod|management|registrar)\/intelligence(\/|$)|^\/intelligence(\/|$)/, "intelligence"],
  [/^\/(chairman|director|dean|registrar|hod|faculty|student|parent)\/calendar(\/|$)|^\/calendar(\/|$)/, "calendar"],
  [/^\/admin\/imports(\/|$)|^\/imports(\/|$)|^\/exports(\/|$)/, "import_export"],
  [/^\/documents(\/|$)/, "documents"],
  [/^\/forms(\/|$)/, "certificates"],
  [/^\/operations(\/|$)|^\/(chairman|director|dean|hod|management|it)\/operations(\/|$)/, "operations"],
  [/^\/analytics(\/|$)/, "analytics"],
  [/^\/promotions?(\/|$)|^\/student-promotion(\/|$)/, "promotions"],
  [/^\/(chairman|director|dean|hod|registrar|faculty|student|parent)\/library(\/|$)|^\/library(\/|$)/, "library"],
  [/^\/(chairman|director|dean|hod|registrar|faculty|student|parent)\/calendar(\/|$)|^\/calendar(\/|$)/, "calendar"],
  [/^\/(chairman|director|dean|hod|registrar|faculty|student|parent|accounts|hr|admissions|examination|placements|library|it|management|staff)\/notices?(\/|$)|^\/notices?(\/|$)/, "notices"],
  [/^\/(chairman|director|dean|hod|registrar|faculty|student|parent|accounts|hr|admissions|examination|placements|library|it|management|staff)\/notifications?(\/|$)|^\/notifications?(\/|$)/, "notifications"],
];

export function tenantFeaturesForPath(pathname: string): string[] {
  const [rawPath, rawQuery] = pathname.split("?");
  const normalizedPath = rawPath.replace(/\/+$/, "") || "/";
  const requiredFeatures = TENANT_FEATURE_BY_ROUTE
    .filter(([pattern]) => pattern.test(normalizedPath))
    .map(([, feature]) => feature);

  // The HOD workspace reuses /hod for its student and course-registration
  // views. The query-backed registration view is its own protected feature;
  // evaluate this against the full URL for both navigation and direct routes.
  const query = new URLSearchParams(rawQuery || "");
  if (normalizedPath === "/hod" && query.get("tab") === "registrations") {
    requiredFeatures.push("registration");
  }

  return Array.from(new Set(requiredFeatures));
}

function tenantFeaturesForNavigation(item: NavigationItem): string[] {
  return tenantFeaturesForPath(item.href);
}


export type NavigationItem = {
  label: string;
  href: string;
  icon?: string;
  roles?: string[];
  permissions?: PermissionKey[];
  /** Require at least one listed permission when the workspace contains per-action capabilities. */
  anyPermissions?: PermissionKey[];
  group?: string;
  children?: NavigationItem[];
  /** Route matching strategy for active state. Nested is boundary-safe; exact is exact-only. */
  activeMatch?: "exact" | "nested";
  /** Optional query parameters that must match for this item to be active. */
  activeQuery?: Record<string, string | null>;
};

export const ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN: "Super Admin",
  INSTITUTION_ADMIN: "Institution Admin",
  CHAIRMAN: "Chairman",
  DIRECTOR: "Director",
  DEAN: "Dean",
  REGISTRAR: "Registrar",
  HOD: "Head of Department",
  FACULTY: "Faculty",
  ACCOUNTS: "Accounts",
  HR: "HR",
  ADMISSIONS: "Admissions",
  EXAMINATION: "Examination",
  LIBRARIAN: "Librarian",
  PLACEMENT: "Placement",
  IT: "IT",
  CMS: "CMS",
  STUDENT: "Student",
  PARENT: "Parent",
  CLUB_PRESIDENT: "Club President",
  MANAGEMENT: "Management",
  STAFF: "Staff",
};

export const COMMON_ACCOUNT_NAVIGATION: NavigationItem = {
  label: "Account Security",
  href: "/account-security",
  icon: "◉",
  group: "Account",
};

export const ROLE_NAVIGATION: NavigationItem[] = [
  COMMON_ACCOUNT_NAVIGATION,
  {
    label: "Events & Gallery",
    href: "/admin/events-gallery",
    icon: "◫",
    roles: ["INSTITUTION_ADMIN"],
    permissions: ["events.manage"],
    group: "Administration",
    activeMatch: "nested",
  },
  {
    label: "Events & Gallery",
    href: "/events-gallery",
    icon: "◫",
    roles: ["MANAGEMENT","DEAN","REGISTRAR","HOD","FACULTY","ACCOUNTS","HR","ADMISSIONS","EXAMINATION","LIBRARIAN","PLACEMENT","IT","CMS","STUDENT","PARENT","CLUB_PRESIDENT","STAFF"],
    permissions: ["events.read"],
    group: "Institution",
    activeMatch: "nested",
  },

  {
    label: "Learning",
    href: "/lms",
    icon: "▥",
    roles: ["INSTITUTION_ADMIN"],
    permissions: ["lms.read"],
    group: "Academic",
  },
  {
    label: "Learning",
    href: "/lms",
    icon: "▥",
    roles: ["CHAIRMAN"],
    permissions: ["lms.read"],
    group: "Academic",
  },
  {
    label: "Learning",
    href: "/lms",
    icon: "▥",
    roles: ["MANAGEMENT"],
    permissions: ["lms.read"],
    group: "Academic",
  },
  {
    label: "Learning",
    href: "/lms",
    icon: "▥",
    roles: ["DIRECTOR"],
    permissions: ["lms.read"],
    group: "Academic",
  },
  {
    label: "Learning",
    href: "/lms",
    icon: "▥",
    roles: ["DEAN"],
    permissions: ["lms.read"],
    group: "Academic",
  },
  {
    label: "Learning",
    href: "/lms",
    icon: "▥",
    roles: ["REGISTRAR"],
    permissions: ["lms.read"],
    group: "Academic",
  },
  {
    label: "Learning",
    href: "/lms",
    icon: "▥",
    roles: ["EXAMINATION"],
    permissions: ["lms.read"],
    group: "Academic",
  },
  {
    label: "Learning",
    href: "/lms",
    icon: "▥",
    roles: ["STUDENT"],
    permissions: ["lms.read"],
    group: "Academic",
  },
  {
    label: "Learning",
    href: "/lms",
    icon: "▥",
    roles: ["PARENT"],
    permissions: ["lms.read"],
    group: "Academic",
  },

  {
    label: "Platform overview",
    href: "/superadmin",
    activeMatch: "exact",
    activeQuery: { section: null },
    icon: "⌂",
    roles: ["SUPER_ADMIN"],
    group: "Platform",
  },
  {
    label: "Institutions",
    href: "/superadmin?section=institutions",
    icon: "▦",
    roles: ["SUPER_ADMIN"],
    permissions: ["institutions.manage"],
    group: "Platform",
  },
  {
    label: "Platform users",
    href: "/superadmin?section=users",
    icon: "♙",
    roles: ["SUPER_ADMIN"],
    permissions: ["users.read"],
    group: "Platform",
  },
  {
    label: "Website CMS",
    href: "/site-content",
    icon: "✦",
    roles: ["SUPER_ADMIN", "CMS"],
    permissions: ["site.manage"],
    group: "Website",
    activeMatch: "exact",
  },
  {
    label: "Institutional CMS",
    href: "/admin/institutional-cms",
    icon: "✦",
    roles: ["INSTITUTION_ADMIN", "CHAIRMAN", "MANAGEMENT", "DIRECTOR"],
    permissions: ["institutional-cms.read"],
    group: "Institution",
    activeMatch: "exact",
  },

  {
    label: "Overview",
    href: "/admin",
    activeMatch: "exact",
    icon: "⌂",
    roles: ["INSTITUTION_ADMIN"],
    group: "Administration",
  },
   {
    label: "Academic years",
    href: "/admin/academic-years",
    icon: "calendar",
    roles: ["INSTITUTION_ADMIN"],
    permissions: ["academic-years.read"],
    group: "Academics",
  },
  {
    label: "Programs",
    href: "/admin/programs",
    icon: "academic",
    roles: ["INSTITUTION_ADMIN"],
    permissions: ["programs.read"],
    group: "Academics",
  },
  {
    label: "Semesters",
    href: "/admin/semesters",
    icon: "academic",
    roles: ["INSTITUTION_ADMIN"],
    permissions: ["semesters.read"],
    group: "Academics",
  },
  {
    label: "Sections",
    href: "/admin/sections",
    icon: "people",
    roles: ["INSTITUTION_ADMIN"],
    permissions: ["sections.read"],
    group: "Academics",
  },
  {
    label: "Courses",
    href: "/admin/courses",
    icon: "document",
    roles: ["INSTITUTION_ADMIN"],
    permissions: ["courses.read"],
    group: "Academics",
  },
  {
    label: "Course offerings",
    href: "/admin/course-offerings",
    icon: "academic",
    roles: ["INSTITUTION_ADMIN"],
    permissions: ["course-offerings.read"],
    group: "Academics",
  },
  {
    label: "Documents",
    href: "/admin/documents",
    icon: "document",
    roles: ["INSTITUTION_ADMIN"],
    permissions: ["documents.read"],
    group: "Institution",
  },
  {
    label: "Parent links",
    href: "/admin/parent-links",
    icon: "people",
    roles: ["INSTITUTION_ADMIN"],
    permissions: ["parent-links.read"],
    group: "Institution",
  },
  {
    label: "People",
    href: "/admin/users",
    icon: "♙",
    roles: ["INSTITUTION_ADMIN"],
    permissions: ["users.read"],
    group: "People",
  },
  {
    label: "Import / Export",
    href: "/admin/imports",
    icon: "⇅",
    roles: ["INSTITUTION_ADMIN"],
    permissions: ["imports.manage"],
    group: "Administration",
  },
  {
    label: "Students",
    href: "/admin/students",
    icon: "◎",
    roles: ["INSTITUTION_ADMIN"],
    permissions: ["students.read"],
    group: "People",
  },
  {
    label: "Student Setup",
    href: "/admin/student-setup",
    icon: "✦",
    roles: ["INSTITUTION_ADMIN"],
    permissions: ["students.update"],
    group: "People",
  },
  {
    label: "Academic structure",
    href: "/admin/departments",
    icon: "▦",
    roles: ["INSTITUTION_ADMIN"],
    permissions: ["departments.read"],
    group: "Institution",
  },
  {
    label: "Campuses",
    href: "/admin/campuses",
    icon: "⌂",
    roles: ["INSTITUTION_ADMIN"],
    permissions: ["campuses.read"],
    group: "Institution",
  },
  {
    label: "Notices",
    href: "/admin/notices",
    icon: "◌",
    roles: ["INSTITUTION_ADMIN"],
    permissions: ["notices.read"],
    group: "Institution",
  },
  {
    label: "Calendar",
    href: "/admin/calendar",
    icon: "◫",
    roles: ["INSTITUTION_ADMIN"],
    permissions: ["calendar.read"],
    group: "Institution",
  },
  {
    label: "Notifications",
    href: "/admin/notifications",
    icon: "◉",
    roles: ["INSTITUTION_ADMIN"],
    permissions: ["notifications.read"],
    group: "Institution",
  },
  {
    label: "Operations",
    href: "/admin/operations",
    icon: "⚙",
    roles: ["INSTITUTION_ADMIN"],
    permissions: ["operations.read"],
    group: "Institution",
  },

  {
    label: "Overview",
    href: "/chairman",
    activeMatch: "exact",
    icon: "⌂",
    roles: ["CHAIRMAN"],
    group: "Workspace",
  },
  {
    label: "Examination operations",
    href: "/chairman/examinations/operations",
    icon: "◉",
    roles: ["CHAIRMAN"],
    permissions: ["exams.read"],
    group: "Academic",
    activeMatch: "nested",
  },
  {
    label: "Placements",
    href: "/chairman/placements",
    icon: "◎",
    roles: ["CHAIRMAN"],
    permissions: ["placements.read"],
    group: "Academic",
  },
  {
    label: "Fee Structures",
    href: "/chairman/fees/structures",
    icon: "₹",
    roles: ["CHAIRMAN"],
    permissions: ["fees.structure.manage"],
    group: "Finance",
    activeMatch: "nested",
  },
  {
    label: "Students",
    href: "/chairman/students",
    icon: "◎",
    roles: ["CHAIRMAN"],
    permissions: ["students.read"],
    group: "Institution",
  },
  {
    label: "Notices",
    href: "/chairman/notices",
    icon: "◌",
    roles: ["CHAIRMAN"],
    permissions: ["notices.read"],
    group: "Institution",
  },
  {
    label: "Notifications",
    href: "/chairman/notifications",
    icon: "◉",
    roles: ["CHAIRMAN"],
    permissions: ["notifications.read"],
    group: "Institution",
  },
  {
    label: "Events & Gallery",
    href: "/chairman/events-gallery",
    icon: "◫",
    roles: ["CHAIRMAN"],
    permissions: ["events.read"],
    group: "Institution",
  },
  {
    label: "Institution Collection",
    href: "/chairman/fees/collections",
    icon: "₹",
    roles: ["CHAIRMAN"],
    permissions: ["fees.collection.read"],
    group: "Finance",
  },
  {
    label: "Intelligence",
    href: "/chairman/intelligence",
    icon: "✦",
    roles: ["CHAIRMAN"],
    permissions: ["intelligence.read"],
    group: "Oversight",
  },
  {
    label: "Reports",
    href: "/chairman/reports",
    icon: "▤",
    roles: ["CHAIRMAN"],
    permissions: ["reports.read"],
    group: "Oversight",
  },
  {
    label: "Financial oversight",
    href: "/chairman/fees",
    icon: "₹",
    roles: ["CHAIRMAN"],
    permissions: ["fees.read"],
    group: "Oversight",
  },
  {
    label: "Academic oversight",
    href: "/chairman/examinations",
    icon: "◉",
    roles: ["CHAIRMAN"],
    permissions: ["exams.read"],
    group: "Oversight",
  },
  {
    label: "Outcome Based Education",
    href: "/chairman/obe",
    icon: "◎",
    roles: ["CHAIRMAN"],
    permissions: ["obe.read"],
    group: "Oversight",
  },
  {
    label: "Overview",
    href: "/director",
    activeMatch: "exact",
    icon: "⌂",
    roles: ["DIRECTOR"],
    group: "Workspace",
  },
  {
    label: "Import review",
    href: "/director/imports",
    icon: "download",
    roles: ["DIRECTOR"],
    anyPermissions: [
      "users.create", "students.create", "campuses.create", "departments.create",
      "programs.create", "academic-years.create", "semesters.create", "sections.create",
      "courses.create", "course-offerings.create", "exams.manage", "marks.enter",
      "attendance.mark", "fees.manage", "fees.pay", "notices.manage",
      "timetable.manage", "parent-links.manage",
    ],
    group: "Campus Operations",
  },
  {
    label: "Examination operations",
    href: "/director/examinations/operations",
    icon: "◉",
    roles: ["DIRECTOR"],
    permissions: ["exams.read"],
    group: "Academic",
    activeMatch: "nested",
  },
  {
    label: "Fee structures",
    href: "/director/fees",
    icon: "₹",
    roles: ["DIRECTOR"],
    permissions: ["fees.structure.read"],
    group: "Finance",
    activeMatch: "nested",
  },
  {
    label: "Fee approvals",
    href: "/director/fee-approvals",
    icon: "✓",
    roles: ["DIRECTOR"],
    permissions: ["fees.structure.read", "fees.structure.approve"],
    group: "Finance",
    activeMatch: "nested",
  },
  {
    label: "Intelligence",
    href: "/director/intelligence",
    icon: "✦",
    roles: ["DIRECTOR"],
    permissions: ["intelligence.read"],
    group: "Oversight",
  },
  {
    label: "Reports",
    href: "/director/reports",
    icon: "▤",
    roles: ["DIRECTOR"],
    permissions: ["reports.read"],
    group: "Oversight",
  },
  {
    label: "Students",
    href: "/director/students",
    icon: "◎",
    roles: ["DIRECTOR"],
    permissions: ["students.read"],
    group: "Academic",
  },
  {
    label: "Admissions",
    href: "/director/admissions",
    icon: "▤",
    roles: ["DIRECTOR"],
    permissions: ["admissions.read"],
    group: "Academic",
  },
  {
    label: "Placements",
    href: "/director/placements",
    icon: "↗",
    roles: ["DIRECTOR"],
    permissions: ["placements.read"],
    group: "Academic",
  },
  {
    label: "Notices",
    href: "/director/notices",
    icon: "◌",
    roles: ["DIRECTOR"],
    permissions: ["notices.read"],
    group: "Institution",
  },
  {
    label: "Notifications",
    href: "/director/notifications",
    icon: "◉",
    roles: ["DIRECTOR"],
    permissions: ["notifications.read"],
    group: "Institution",
  },
  {
    label: "Events & Gallery",
    href: "/director/events-gallery",
    icon: "◫",
    roles: ["DIRECTOR"],
    permissions: ["events.read"],
    group: "Institution",
  },
  {
    label: "Examinations",
    href: "/director/examinations",
    icon: "◉",
    roles: ["DIRECTOR"],
    permissions: ["exams.read"],
    group: "Academic",
  },
  {
    label: "Outcome Based Education",
    href: "/director/obe",
    icon: "◎",
    roles: ["DIRECTOR"],
    permissions: ["obe.read"],
    group: "Academic",
  },
  {
    label: "Campus Collection",
    href: "/director/fees/collections",
    icon: "₹",
    roles: ["DIRECTOR"],
    permissions: ["fees.collection.read"],
    group: "Finance",
  },
  {
    label: "Overview",
    href: "/dean",
    activeMatch: "exact",
    icon: "⌂",
    roles: ["DEAN"],
    group: "Workspace",
  },
  {
    label: "Academic",
    href: "/academics",
    icon: "▦",
    roles: ["DEAN"],
    permissions: ["departments.read"],
    group: "Academic",
  },
  {
    label: "Academic operations",
    href: "/dean/operations",
    icon: "academic",
    roles: ["DEAN"],
    permissions: ["operations.read"],
    group: "Academic Leadership",
  },
  {
    label: "Outcome Based Education",
    href: "/dean/obe",
    icon: "◎",
    roles: ["DEAN"],
    permissions: ["obe.read"],
    group: "Academic",
  },
  {
    label: "Examinations",
    href: "/dean/examinations",
    icon: "◉",
    roles: ["DEAN"],
    permissions: ["exams.read"],
    group: "Academic",
  },
  {
    label: "Department Fees",
    href: "/dean/fees",
    icon: "₹",
    roles: ["DEAN"],
    permissions: ["fees.collection.read"],
    group: "Finance",
  },
  {
    label: "Reports",
    href: "/dean/reports",
    icon: "▤",
    roles: ["DEAN"],
    permissions: ["reports.read"],
    group: "Oversight",
  },
  {
    label: "Intelligence",
    href: "/intelligence",
    icon: "✦",
    roles: ["DEAN"],
    permissions: ["intelligence.read"],
    group: "Oversight",
  },
  {
    label: "Students",
    href: "/dean/students",
    icon: "◎",
    roles: ["DEAN"],
    permissions: ["students.read"],
    group: "Academic",
  },
  {
    label: "Results",
    href: "/results",
    icon: "✓",
    roles: ["DEAN"],
    permissions: ["results.read"],
    group: "Academic",
  },
  {
    label: "Notices",
    href: "/notices",
    icon: "◌",
    roles: ["DEAN"],
    permissions: ["notices.read"],
    group: "Institution",
  },

  {
    label: "Overview",
    href: "/registrar",
    activeMatch: "exact",
    icon: "⌂",
    roles: ["REGISTRAR"],
    group: "Workspace",
  },
  {
    label: "Reports",
    href: "/reports",
    icon: "chart",
    roles: ["REGISTRAR"],
    permissions: ["reports.read"],
    group: "Reports",
  },
  {
    label: "Students",
    href: "/registrar/students",
    icon: "◎",
    roles: ["REGISTRAR"],
    permissions: ["students.read"],
    group: "Academic",
  },
  {
    label: "Admissions",
    href: "/admissions",
    icon: "▤",
    roles: ["REGISTRAR", "ADMISSIONS"],
    permissions: ["admissions.read"],
    group: "Academic",
  },
  {
    label: "Certificates",
    href: "/certificates",
    icon: "▤",
    roles: ["REGISTRAR"],
    permissions: ["certificates.read"],
    group: "Academic",
  },
  {
    label: "Academic masters",
    href: "/registrar/academic-masters",
    icon: "▦",
    roles: ["REGISTRAR"],
    permissions: ["academic-years.read"],
    group: "Academic",
  },
  {
    label: "Reports",
    href: "/registrar/reports",
    icon: "▤",
    roles: ["REGISTRAR"],
    permissions: ["reports.read"],
    group: "Administration",
  },
  {
    label: "Course registration",
    href: "/course-registration",
    icon: "▦",
    roles: ["REGISTRAR"],
    permissions: ["registration.read"],
    group: "Academic",
  },
  {
    label: "Student movement",
    href: "/student-promotion",
    icon: "⇅",
    roles: ["REGISTRAR"],
    permissions: ["promotions.read"],
    group: "Academic",
  },

  {
    label: "Overview",
    href: "/hod",
    activeMatch: "exact",
    icon: "⌂",
    roles: ["HOD"],
    group: "Workspace",
  },
  {
    label: "Department operations",
    href: "/hod/operations",
    icon: "settings",
    roles: ["HOD"],
    permissions: ["operations.read"],
    group: "Department",
  },
  {
    label: "Enrollment Requests",
    href: "/hod/enrollment-requests",
    icon: "✓",
    roles: ["HOD"],
    permissions: ["enrollment.read"],
    group: "Academic",
  },
  {
    label: "Course Registration Requests",
    href: "/hod/course-registration-requests",
    icon: "▦",
    roles: ["HOD"],
    permissions: ["registration.read"],
    group: "Academic",
  },

  {
    label: "Students",
    href: "/hod?tab=students",
    icon: "◎",
    roles: ["HOD"],
    permissions: ["students.read"],
    group: "Academic",
  },
  {
    label: "Faculty",
    href: "/hod/faculty",
    icon: "♙",
    roles: ["HOD"],
    permissions: ["students.read"],
    group: "People",
  },
  {
    label: "Attendance",
    href: "/hod/attendance",
    icon: "✓",
    roles: ["HOD"],
    permissions: ["attendance.read"],
    group: "Academic",
  },
  {
    label: "Timetable",
    href: "/hod/timetable",
    icon: "◫",
    roles: ["HOD"],
    permissions: ["timetable.read"],
    group: "Academic",
  },
  {
    label: "Reports",
    href: "/hod/reports",
    icon: "▤",
    roles: ["HOD"],
    permissions: ["reports.read"],
    group: "Oversight",
  },
  {
    label: "Intelligence",
    href: "/hod/intelligence",
    icon: "✦",
    roles: ["HOD"],
    permissions: ["intelligence.read"],
    group: "Oversight",
  },
  {
    label: "Outcome Based Education",
    href: "/hod/obe",
    icon: "◎",
    roles: ["HOD"],
    permissions: ["obe.read"],
    group: "Academic",
  },
  {
    label: "Examinations",
    href: "/hod/examinations",
    icon: "◉",
    roles: ["HOD"],
    permissions: ["exams.read"],
    group: "Academic",
  },
  {
    label: "Department Fees",
    href: "/hod/fees",
    icon: "₹",
    roles: ["HOD"],
    permissions: ["fees.collection.read"],
    group: "Finance",
  },
  {
    label: "Learning",
    href: "/lms",
    icon: "▥",
    roles: ["HOD"],
    permissions: ["lms.read"],
    group: "Academic",
  },
  {
    label: "Timetable",
    href: "/timetable",
    icon: "◫",
    roles: ["HOD"],
    permissions: ["timetable.read"],
    group: "Academic",
  },
  {
    label: "Reports",
    href: "/reports",
    icon: "▤",
    roles: ["HOD"],
    permissions: ["reports.read"],
    group: "Oversight",
  },
  {
    label: "Intelligence",
    href: "/intelligence",
    icon: "✦",
    roles: ["HOD"],
    permissions: ["intelligence.read"],
    group: "Oversight",
  },
  {
    label: "Notices",
    href: "/notices",
    icon: "◌",
    roles: ["HOD"],
    permissions: ["notices.read"],
    group: "Institution",
  },

  {
    label: "Overview",
    href: "/faculty",
    activeMatch: "exact",
    icon: "⌂",
    roles: ["FACULTY"],
    group: "Workspace",
  },
  {
    label: "Teaching operations",
    href: "/faculty/operations",
    icon: "academic",
    roles: ["FACULTY"],
    permissions: ["courses.read"],
    group: "Teaching",
  },
  {
    label: "My courses",
    href: "/faculty/courses",
    icon: "▦",
    roles: ["FACULTY"],
    permissions: ["courses.read"],
    group: "Teaching",
  },
  {
    label: "My Students",
    href: "/faculty#students",
    icon: "◎",
    roles: ["FACULTY"],
    permissions: ["students.read"],
    group: "Teaching",
  },
  {
    label: "Outcome Based Education",
    href: "/faculty/obe",
    icon: "◎",
    roles: ["FACULTY"],
    permissions: ["obe.read"],
    group: "Teaching",
  },
  {
    label: "Attendance",
    href: "/faculty/attendance",
    icon: "✓",
    roles: ["FACULTY"],
    permissions: ["attendance.read"],
    group: "Teaching",
  },
  {
    label: "Assignments",
    href: "/faculty/assignments",
    icon: "▤",
    roles: ["FACULTY"],
    permissions: ["assignments.read"],
    group: "Teaching",
  },
  {
    label: "Examinations",
    href: "/faculty/examinations",
    icon: "◉",
    roles: ["FACULTY"],
    permissions: ["exams.read"],
    group: "Teaching",
  },
  {
    label: "Marks",
    href: "/faculty/marks",
    icon: "◎",
    roles: ["FACULTY"],
    permissions: ["marks.read"],
    group: "Teaching",
  },
  {
    label: "Learning",
    href: "/lms",
    icon: "▥",
    roles: ["FACULTY"],
    permissions: ["lms.read"],
    group: "Teaching",
  },
  {
    label: "Leave",
    href: "/leave-management",
    icon: "◫",
    roles: ["FACULTY"],
    permissions: ["leave.apply"],
    group: "Workspace",
  },
  {
    label: "Profile",
    href: "/faculty/profile",
    icon: "◉",
    roles: ["FACULTY"],
    group: "Account",
  },

  {
    label: "Overview",
    href: "/accounts",
    activeMatch: "exact",
    icon: "⌂",
    roles: ["ACCOUNTS"],
    group: "Workspace",
  },
  {
    label: "Expenses & Approvals",
    href: "/accounts/expenses",
    icon: "₹",
    roles: ["ACCOUNTS"],
    permissions: ["expenses.read"],
    group: "Finance",
  },
  {
    label: "Fee Structures",
    href: "/accounts/fee-structures",
    icon: "▤",
    roles: ["ACCOUNTS"],
    permissions: ["fees.structure.read"],
    group: "Fee Management",
  },
  {
    label: "Fee Heads",
    href: "/accounts/fee-heads",
    icon: "▤",
    roles: ["ACCOUNTS"],
    permissions: ["fees.structure.read"],
    group: "Fee Management",
  },
  {
    label: "Invoices",
    href: "/accounts/invoices",
    icon: "▤",
    roles: ["ACCOUNTS"],
    permissions: ["fees.read"],
    group: "Billing",
  },
  {
    label: "Payments",
    href: "/accounts/payments",
    icon: "₹",
    roles: ["ACCOUNTS"],
    permissions: ["fees.read"],
    group: "Collections",
  },
  {
    label: "Receipts",
    href: "/accounts/receipts",
    icon: "▤",
    roles: ["ACCOUNTS"],
    permissions: ["fees.read"],
    group: "Billing",
  },
  {
    label: "Dues & Outstanding",
    href: "/accounts/dues",
    icon: "!",
    roles: ["ACCOUNTS"],
    permissions: ["fees.read"],
    group: "Dues",
  },
  {
    label: "Collections",
    href: "/accounts/collections",
    icon: "▦",
    roles: ["ACCOUNTS"],
    permissions: ["fees.read"],
    group: "Collections",
  },
  {
    label: "Concessions",
    href: "/accounts/concessions",
    icon: "◇",
    roles: ["ACCOUNTS"],
    permissions: ["fees.read"],
    group: "Adjustments",
  },
  {
    label: "Refunds",
    href: "/accounts/refunds",
    icon: "↩",
    roles: ["ACCOUNTS"],
    permissions: ["fees.read"],
    group: "Adjustments",
  },
  {
    label: "Transactions",
    href: "/accounts/transactions",
    icon: "▤",
    roles: ["ACCOUNTS"],
    permissions: ["fees.read"],
    group: "Collections",
  },
  {
    label: "Audit",
    href: "/accounts/audit",
    icon: "◉",
    roles: ["ACCOUNTS"],
    permissions: ["fees.read"],
    group: "Reporting",
  },
  {
    label: "Reports",
    href: "/accounts/reports",
    icon: "▤",
    roles: ["ACCOUNTS"],
    permissions: ["fees.read"],
    group: "Reporting",
  },

  {
    label: "Overview",
    href: "/hr",
    activeMatch: "exact",
    icon: "⌂",
    roles: ["HR"],
    group: "Workspace",
  },
  {
    label: "Employees",
    href: "/employees",
    icon: "♙",
    roles: ["HR"],
    permissions: ["hr.read"],
    group: "People",
  },
  {
    label: "Leave management",
    href: "/leave-management",
    icon: "◫",
    roles: ["HR"],
    permissions: ["leave.read"],
    group: "People",
  },
  {
    label: "Reports",
    href: "/reports",
    icon: "▤",
    roles: ["HR"],
    permissions: ["reports.read"],
    group: "People",
  },

  {
    label: "Applications",
    href: "/applications",
    icon: "▤",
    roles: ["ADMISSIONS"],
    permissions: ["admissions.read"],
    group: "Admissions",
  },
  {
    label: "Students",
    href: "/admissions/students",
    icon: "◎",
    roles: ["ADMISSIONS"],
    permissions: ["students.read", "admissions.read"],
    group: "Admissions",
  },
  {
    label: "Reports",
    href: "/reports",
    icon: "▤",
    roles: ["ADMISSIONS"],
    permissions: ["reports.read"],
    group: "Admissions",
  },

  {
    label: "Overview",
    href: "/examination",
    activeMatch: "exact",
    icon: "⌂",
    roles: ["EXAMINATION"],
    group: "Workspace",
  },
  {
    label: "Admit card templates",
    href: "/examination/admit-card-templates",
    icon: "▤",
    roles: ["EXAMINATION"],
    permissions: ["exams.manage"],
    group: "Examinations",
  },
  {
    label: "Outcome Based Education",
    href: "/examination/obe",
    icon: "◎",
    roles: ["EXAMINATION"],
    permissions: ["obe.read"],
    group: "Examinations",
  },
  {
    label: "Reports",
    href: "/reports",
    icon: "▤",
    roles: ["EXAMINATION"],
    permissions: ["reports.read"],
    group: "Examinations",
  },

  {
    label: "Overview",
    href: "/library",
    activeMatch: "exact",
    icon: "⌂",
    roles: ["LIBRARIAN"],
    group: "Workspace",
  },
  {
    label: "Book Copies",
    href: "/library/copies",
    icon: "▣",
    roles: ["LIBRARIAN"],
    permissions: ["library.manage"],
    group: "Library",
    activeMatch: "nested",
  },
  {
    label: "Circulation",
    href: "/library?tab=circulation",
    icon: "⇄",
    roles: ["LIBRARIAN"],
    permissions: ["library.manage"],
    group: "Library",
  },
  {
    label: "Fines",
    href: "/library?tab=fines",
    icon: "₹",
    roles: ["LIBRARIAN"],
    permissions: ["library.manage"],
    group: "Library",
  },
  {
    label: "Policies",
    href: "/library/policies",
    icon: "⚙",
    roles: ["LIBRARIAN"],
    permissions: ["library.manage"],
    group: "Administration",
    activeMatch: "nested",
  },
  {
    label: "Students",
    href: "/library/students",
    icon: "◎",
    roles: ["LIBRARIAN"],
    permissions: ["students.read", "library.read"],
    group: "Circulation",
  },
  {
    label: "Reports",
    href: "/reports",
    icon: "▤",
    roles: ["LIBRARIAN"],
    permissions: ["reports.read"],
    group: "Circulation",
  },

  {
    label: "Overview",
    href: "/placements",
    activeMatch: "exact",
    icon: "⌂",
    roles: ["PLACEMENT"],
    permissions: ["placements.read"],
    group: "Workspace",
  },
  {
    label: "Students",
    href: "/placements/students",
    icon: "◎",
    roles: ["PLACEMENT"],
    permissions: ["placements.read"],
    group: "Placement",
    activeMatch: "nested",
  },
  {
    label: "Companies",
    href: "/placements/companies",
    icon: "▣",
    roles: ["PLACEMENT"],
    permissions: ["placements.read"],
    group: "Placement",
    activeMatch: "nested",
  },
  {
    label: "Drives & Eligibility",
    href: "/placements/drives",
    icon: "▤",
    roles: ["PLACEMENT"],
    permissions: ["placements.read"],
    group: "Placement",
    activeMatch: "nested",
  },
  {
    label: "Job Openings",
    href: "/placements/openings",
    icon: "◈",
    roles: ["PLACEMENT"],
    permissions: ["placements.read"],
    group: "Placement",
    activeMatch: "nested",
  },
  {
    label: "Applications",
    href: "/placements/applications",
    icon: "☷",
    roles: ["PLACEMENT"],
    permissions: ["placements.read"],
    group: "Placement",
    activeMatch: "nested",
  },
  {
    label: "Calendar",
    href: "/placements/calendar",
    icon: "◫",
    roles: ["PLACEMENT"],
    permissions: ["placements.read"],
    group: "Placement",
    activeMatch: "nested",
  },
  {
    label: "Company Visits",
    href: "/placements/visits",
    icon: "◷",
    roles: ["PLACEMENT"],
    permissions: ["placements.read"],
    group: "Placement",
    activeMatch: "nested",
  },
  {
    label: "Interviews",
    href: "/placements/interviews",
    icon: "◉",
    roles: ["PLACEMENT"],
    permissions: ["placements.read"],
    group: "Placement",
    activeMatch: "nested",
  },
  {
    label: "Tests & Assessments",
    href: "/placements/tests",
    icon: "✓",
    roles: ["PLACEMENT"],
    permissions: ["placements.read"],
    group: "Placement",
    activeMatch: "nested",
  },
  {
    label: "Offers & Joining",
    href: "/placements/offers",
    icon: "₹",
    roles: ["PLACEMENT"],
    permissions: ["placements.read"],
    group: "Placement",
    activeMatch: "nested",
  },
  {
    label: "Reports & Exports",
    href: "/placements/reports",
    icon: "▤",
    roles: ["PLACEMENT"],
    permissions: ["placements.read"],
    group: "Placement",
    activeMatch: "nested",
  },

  {
    label: "Overview",
    href: "/it",
    activeMatch: "exact",
    icon: "⌂",
    roles: ["IT"],
    group: "Workspace",
  },
  {
    label: "Operations",
    href: "/operations",
    icon: "⚙",
    roles: ["IT"],
    permissions: ["operations.read"],
    group: "Technology",
  },




  /*
   * ============================================================
   * STUDENT WORKSPACE
   * ============================================================
   */

  {
    label: "Overview",
    href: "/student",
    activeMatch: "exact",
    icon: "⌂",
    roles: ["STUDENT"],
    group: "Workspace",
  },
  {
    label: "Notices",
    href: "/notices",
    icon: "◌",
    roles: ["STUDENT"],
    permissions: ["notices.read"],
    group: "Workspace",
  },
  {
    label: "Notifications",
    href: "/student/notifications",
    icon: "◉",
    roles: ["STUDENT"],
    permissions: ["notifications.read"],
    group: "Workspace",
  },
  {
    label: "Calendar",
    href: "/student/calendar",
    icon: "◫",
    roles: ["STUDENT"],
    permissions: ["calendar.read"],
    group: "Workspace",
  },

  {
    label: "Timetable",
    href: "/student/timetable",
    icon: "◫",
    roles: ["STUDENT"],
    permissions: ["timetable.read"],
    group: "Academic",
  },
  {
    label: "Assignments",
    href: "/student/assignments",
    icon: "▤",
    roles: ["STUDENT"],
    permissions: ["assignments.read"],
    group: "Academic",
  },
  {
    label: "Attendance",
    href: "/student/attendance",
    icon: "◉",
    roles: ["STUDENT"],
    permissions: ["attendance.read"],
    group: "Academic",
  },
  {
    label: "Examinations",
    href: "/student/examinations",
    icon: "✍",
    roles: ["STUDENT"],
    permissions: ["exams.read"],
    group: "Academic",
    activeMatch: "nested",
    children: [
      { label: "Upcoming Examinations", href: "/student/examinations", roles: ["STUDENT"], permissions: ["exams.read"], activeMatch: "exact" },
      { label: "Exam Registration", href: "/student/examinations/registration", roles: ["STUDENT"], permissions: ["exams.read"], activeMatch: "nested" },
      { label: "Admit Cards", href: "/student/examinations/admit-cards", roles: ["STUDENT"], permissions: ["exams.read"], activeMatch: "nested" },
      { label: "Performance", href: "/student/examinations/performance", roles: ["STUDENT"], permissions: ["exams.read"], activeMatch: "nested" },
      { label: "Results", href: "/student/examinations/results", roles: ["STUDENT"], permissions: ["exams.read"], activeMatch: "nested" },
    ],
  },
  {
    label: "Outcome Based Education",
    href: "/student/obe",
    icon: "◎",
    roles: ["STUDENT"],
    permissions: ["obe.read"],
    group: "Academic",
  },
  {
    label: "Enrollment",
    href: "/student/enrollment",
    icon: "✓",
    roles: ["STUDENT"],
    permissions: ["enrollment.read"],
    group: "Academic",
  },
  {
    label: "Course Registration",
    href: "/student/course-registration",
    icon: "▦",
    roles: ["STUDENT"],
    permissions: ["registration.submit"],
    group: "Academic",
  },

  {
    label: "Placement",
    href: "/student/placements",
    icon: "◎",
    roles: ["STUDENT"],
    permissions: ["placements.read"],
    group: "Career",
  },

  {
    label: "Fees",
    href: "/student/fees",
    icon: "₹",
    roles: ["STUDENT"],
    permissions: ["fees.read"],
    group: "Finance",
  },

  {
    label: "Library",
    href: "/student/library",
    icon: "▤",
    roles: ["STUDENT"],
    permissions: ["library.read"],
    group: "Services",
  },
  {
    label: "Leave",
    href: "/student/leave",
    icon: "◫",
    roles: ["STUDENT"],
    permissions: ["leave.apply"],
    group: "Services",
  },
  {
    label: "Certificates",
    href: "/student/certificates",
    icon: "▤",
    roles: ["STUDENT"],
    permissions: ["certificates.request"],
    group: "Services",
  },

  {
    label: "Profile",
    href: "/student/profile",
    icon: "♙",
    roles: ["STUDENT"],
    group: "Account",
  },
  {
    label: "Academic record",
    href: "/student/academic",
    icon: "▦",
    roles: ["STUDENT"],
    permissions: ["courses.read"],
    group: "Account",
  },
  {
    label: "Documents",
    href: "/student/documents",
    icon: "▤",
    roles: ["STUDENT"],
    permissions: ["documents.read"],
    group: "Account",
  },

  {
    label: "Profile",
    href: "/parent/profile",
    icon: "user",
    roles: ["PARENT"],
    permissions: ["parent-portal.read"],
    group: "Family",
  },
  {
    label: "Children",
    href: "/parent/children",
    icon: "people",
    roles: ["PARENT"],
    group: "Student",
    activeMatch: "nested",
  },

  {
    label: "Overview",
    href: "/parent",
    activeMatch: "exact",
    icon: "⌂",
    roles: ["PARENT"],
    group: "Workspace",
  },

  {
    label: "Overview",
    href: "/club-president",
    activeMatch: "exact",
    icon: "⌂",
    roles: ["CLUB_PRESIDENT"],
    group: "Workspace",
  },
  {
    label: "Fee structure approvals",
    href: "/management/fee-approvals",
    icon: "✓",
    roles: ["MANAGEMENT"],
    permissions: ["fees.structure.read", "fees.structure.approve"],
    group: "Finance",
    activeMatch: "nested",
  },

  {
    label: "Overview",
    href: "/management",
    activeMatch: "exact",
    icon: "⌂",
    roles: ["MANAGEMENT"],
    group: "Workspace",
  },
  {
    label: "Operations",
    href: "/management/operations",
    icon: "⚙",
    roles: ["MANAGEMENT"],
    permissions: ["operations.read"],
    group: "Oversight",
  },
  {
    label: "Intelligence",
    href: "/management/intelligence",
    icon: "✦",
    roles: ["MANAGEMENT"],
    permissions: ["intelligence.read"],
    group: "Oversight",
  },
  {
    label: "Reports",
    href: "/management/reports",
    icon: "▤",
    roles: ["MANAGEMENT"],
    permissions: ["reports.read"],
    group: "Oversight",
  },
  {
    label: "Overview",
    href: "/staff",
    activeMatch: "exact",
    icon: "⌂",
    roles: ["STAFF"],
    group: "Workspace",
  },
  {
    label: "Operations",
    href: "/staff/operations",
    icon: "⚙",
    roles: ["STAFF"],
    group: "Workspace",
  },
  { label: "Placement", href: "/admin/placements", icon: "◎", roles: ["INSTITUTION_ADMIN"], permissions: ["placements.read"], group: "Administration", activeMatch: "nested" },
  { label: "Placement", href: "/superadmin/placements", icon: "◎", roles: ["SUPER_ADMIN"], permissions: ["plans.manage"], group: "Platform", activeMatch: "nested" },
  { label: "Placement", href: "/management/placements", icon: "◎", roles: ["MANAGEMENT"], permissions: ["placements.read"], group: "Institution", activeMatch: "nested" },
  { label: "Placement", href: "/registrar/placements", icon: "◎", roles: ["REGISTRAR"], permissions: ["placements.read"], group: "Institution", activeMatch: "nested" },
  { label: "Placement", href: "/dean/placements", icon: "◎", roles: ["DEAN"], permissions: ["placements.read"], group: "Institution", activeMatch: "nested" },
  { label: "Placement", href: "/hod/placements", icon: "◎", roles: ["HOD"], permissions: ["placements.read"], group: "Academic", activeMatch: "nested" },
  { label: "Placement", href: "/faculty/placements", icon: "◎", roles: ["FACULTY"], permissions: ["placements.read"], group: "Academic", activeMatch: "nested" },
  { label: "Placement", href: "/parent/placements", icon: "◎", roles: ["PARENT"], permissions: ["placements.read"], group: "Student", activeMatch: "nested" },
  {
    label: "Notifications",
    href: "/superadmin/notifications",
    icon: "◉",
    roles: ["SUPER_ADMIN"],
    group: "Platform",
    activeMatch: "nested",
  },
  {
    label: "Notices",
    href: "/management/notices",
    icon: "◌",
    roles: ["MANAGEMENT"],
    group: "Institution",
    activeMatch: "nested",
  },
  {
    label: "Notifications",
    href: "/management/notifications",
    icon: "◉",
    roles: ["MANAGEMENT"],
    group: "Institution",
    activeMatch: "nested",
  },
  {
    label: "Notices",
    href: "/dean/notices",
    icon: "◌",
    roles: ["DEAN"],
    group: "Institution",
    activeMatch: "nested",
  },
  {
    label: "Notifications",
    href: "/dean/notifications",
    icon: "◉",
    roles: ["DEAN"],
    group: "Institution",
    activeMatch: "nested",
  },
  {
    label: "Notices",
    href: "/registrar/notices",
    icon: "◌",
    roles: ["REGISTRAR"],
    group: "Institution",
    activeMatch: "nested",
  },
  {
    label: "Notifications",
    href: "/registrar/notifications",
    icon: "◉",
    roles: ["REGISTRAR"],
    group: "Institution",
    activeMatch: "nested",
  },
  {
    label: "Notices",
    href: "/hod/notices",
    icon: "◌",
    roles: ["HOD"],
    group: "Academic",
    activeMatch: "nested",
  },
  {
    label: "Notifications",
    href: "/hod/notifications",
    icon: "◉",
    roles: ["HOD"],
    group: "Academic",
    activeMatch: "nested",
  },
  {
    label: "Notices",
    href: "/faculty/notices",
    icon: "◌",
    roles: ["FACULTY"],
    group: "Academic",
    activeMatch: "nested",
  },
  {
    label: "Notifications",
    href: "/faculty/notifications",
    icon: "◉",
    roles: ["FACULTY"],
    group: "Academic",
    activeMatch: "nested",
  },
  {
    label: "Notices",
    href: "/accounts/notices",
    icon: "◌",
    roles: ["ACCOUNTS"],
    group: "Institution",
    activeMatch: "nested",
  },
  {
    label: "Notifications",
    href: "/accounts/notifications",
    icon: "◉",
    roles: ["ACCOUNTS"],
    group: "Institution",
    activeMatch: "nested",
  },
  {
    label: "Notices",
    href: "/hr/notices",
    icon: "◌",
    roles: ["HR"],
    group: "Institution",
    activeMatch: "nested",
  },
  {
    label: "Notifications",
    href: "/hr/notifications",
    icon: "◉",
    roles: ["HR"],
    group: "Institution",
    activeMatch: "nested",
  },
  {
    label: "Notices",
    href: "/admissions/notices",
    icon: "◌",
    roles: ["ADMISSIONS"],
    group: "Institution",
    activeMatch: "nested",
  },
  {
    label: "Notifications",
    href: "/admissions/notifications",
    icon: "◉",
    roles: ["ADMISSIONS"],
    group: "Institution",
    activeMatch: "nested",
  },
  {
    label: "Notices",
    href: "/examination/notices",
    icon: "◌",
    roles: ["EXAMINATION"],
    group: "Institution",
    activeMatch: "nested",
  },
  {
    label: "Notifications",
    href: "/examination/notifications",
    icon: "◉",
    roles: ["EXAMINATION"],
    group: "Institution",
    activeMatch: "nested",
  },
  {
    label: "Notices",
    href: "/library/notices",
    icon: "◌",
    roles: ["LIBRARIAN"],
    group: "Institution",
    activeMatch: "nested",
  },
  {
    label: "Notifications",
    href: "/library/notifications",
    icon: "◉",
    roles: ["LIBRARIAN"],
    group: "Institution",
    activeMatch: "nested",
  },
  {
    label: "Notices",
    href: "/placements/notices",
    icon: "◌",
    roles: ["PLACEMENT"],
    group: "Institution",
    activeMatch: "nested",
  },
  {
    label: "Notifications",
    href: "/placements/notifications",
    icon: "◉",
    roles: ["PLACEMENT"],
    group: "Institution",
    activeMatch: "nested",
  },
  {
    label: "Notices",
    href: "/it/notices",
    icon: "◌",
    roles: ["IT"],
    group: "Institution",
    activeMatch: "nested",
  },
  {
    label: "Notifications",
    href: "/it/notifications",
    icon: "◉",
    roles: ["IT"],
    group: "Institution",
    activeMatch: "nested",
  },
  {
    label: "Notices",
    href: "/site-content/notices",
    icon: "◌",
    roles: ["CMS"],
    group: "Institution",
    activeMatch: "nested",
  },
  {
    label: "Notifications",
    href: "/site-content/notifications",
    icon: "◉",
    roles: ["CMS"],
    group: "Institution",
    activeMatch: "nested",
  },
  {
    label: "Notices",
    href: "/student/notices",
    icon: "◌",
    roles: ["STUDENT"],
    group: "Student",
    activeMatch: "nested",
  },
  {
    label: "Notices",
    href: "/parent/notices",
    icon: "◌",
    roles: ["PARENT"],
    group: "Student",
    activeMatch: "nested",
  },
  {
    label: "Notifications",
    href: "/parent/notifications",
    icon: "◉",
    roles: ["PARENT"],
    group: "Student",
    activeMatch: "nested",
  },
  {
    label: "Notices",
    href: "/club-president/notices",
    icon: "◌",
    roles: ["CLUB_PRESIDENT"],
    group: "Institution",
    activeMatch: "nested",
  },
  {
    label: "Notifications",
    href: "/club-president/notifications",
    icon: "◉",
    roles: ["CLUB_PRESIDENT"],
    group: "Institution",
    activeMatch: "nested",
  },
  {
    label: "Notices",
    href: "/staff/notices",
    icon: "◌",
    roles: ["STAFF"],
    group: "Institution",
    activeMatch: "nested",
  },
  {
    label: "Notifications",
    href: "/staff/notifications",
    icon: "◉",
    roles: ["STAFF"],
    group: "Institution",
    activeMatch: "nested",
  },
].filter((item): item is NavigationItem => Boolean(item));

const NAMESPACE_OWNERS: Array<[string, string[]]> = [
  ["/admissions/reports", ["ADMISSIONS"]],
  ["/admissions/students", ["ADMISSIONS"]],
  ["/admissions", ["ADMISSIONS", "REGISTRAR"]],
  ["/library/reports", ["LIBRARIAN"]],
  ["/library/students", ["LIBRARIAN"]],
  ["/club", ["CLUB_PRESIDENT"]],
  ["/cms", ["SUPER_ADMIN", "CMS"]],
  ["/enrollment", ["ADMISSIONS"]],
  ["/erp", ["SUPER_ADMIN", "INSTITUTION_ADMIN", "DIRECTOR", "MANAGEMENT", "HOD", "STAFF", "FACULTY", "PARENT", "STUDENT"]],
  ["/faculty-management", ["HR"]],
  ["/forms", ["REGISTRAR"]],
  ["/institution-settings", ["INSTITUTION_ADMIN"]],
  ["/institutionalcms", ["INSTITUTION_ADMIN", "CHAIRMAN", "MANAGEMENT", "DIRECTOR"]],
  ["/lms/settings", ["INSTITUTION_ADMIN", "CHAIRMAN", "MANAGEMENT", "DIRECTOR", "DEAN", "REGISTRAR", "EXAMINATION", "HOD", "FACULTY"]],
  ["/lms/reports", ["INSTITUTION_ADMIN", "CHAIRMAN", "MANAGEMENT", "DIRECTOR", "DEAN", "REGISTRAR", "EXAMINATION", "HOD", "FACULTY"]],
  ["/lms/parent", ["PARENT"]],
  ["/lms", ["INSTITUTION_ADMIN", "CHAIRMAN", "MANAGEMENT", "DIRECTOR", "DEAN", "REGISTRAR", "EXAMINATION", "STUDENT", "PARENT", "HOD", "FACULTY"]],
  ["/my-work", ["SUPER_ADMIN", "INSTITUTION_ADMIN", "CHAIRMAN", "MANAGEMENT", "DIRECTOR", "DEAN", "REGISTRAR", "HOD", "FACULTY", "ACCOUNTS", "HR", "ADMISSIONS", "EXAMINATION", "LIBRARIAN", "PLACEMENT", "IT", "CMS", "STUDENT", "PARENT", "CLUB_PRESIDENT", "STAFF"]],
  ["/profile", ["SUPER_ADMIN", "INSTITUTION_ADMIN", "CHAIRMAN", "MANAGEMENT", "DIRECTOR", "DEAN", "REGISTRAR", "HOD", "FACULTY", "ACCOUNTS", "HR", "ADMISSIONS", "EXAMINATION", "LIBRARIAN", "PLACEMENT", "IT", "CMS", "STUDENT", "PARENT", "CLUB_PRESIDENT", "STAFF"]],
  ["/today", ["SUPER_ADMIN", "INSTITUTION_ADMIN", "CHAIRMAN", "MANAGEMENT", "DIRECTOR", "DEAN", "REGISTRAR", "HOD", "FACULTY", "ACCOUNTS", "HR", "ADMISSIONS", "EXAMINATION", "LIBRARIAN", "PLACEMENT", "IT", "CMS", "STUDENT", "PARENT", "CLUB_PRESIDENT", "STAFF"]],
  ["/user-deletion-approvals", ["INSTITUTION_ADMIN"]],
  ["/fees/receipts", ["ACCOUNTS"]],
  ["/fees/collections", ["SUPER_ADMIN", "INSTITUTION_ADMIN", "CHAIRMAN", "MANAGEMENT", "ACCOUNTS"]],

  ["/admin/institutional-cms", ["INSTITUTION_ADMIN", "CHAIRMAN", "MANAGEMENT", "DIRECTOR"]],
  ["/superadmin", ["SUPER_ADMIN"]],
  ["/admin", ["INSTITUTION_ADMIN"]],
  ["/student", ["STUDENT"]],
  ["/faculty", ["FACULTY"]],
  ["/parent/students/[studentId]", ["PARENT"]],
  ["/parent", ["PARENT"]],
  ["/chairman", ["CHAIRMAN"]],
  ["/director", ["DIRECTOR"]],
  ["/management", ["MANAGEMENT"]],
  ["/dean", ["DEAN"]],
  ["/registrar", ["REGISTRAR"]],
  ["/hod", ["HOD"]],

  ["/hr", ["HR"]],


  [
    "/library",
    [
      "LIBRARIAN",
      "STUDENT",
      "FACULTY",
      "HOD",
    ],
  ],

  ["/placements", ["PLACEMENT"]],

  ["/it", ["IT"]],
  ["/staff", ["STAFF"]],
  ["/imports", ["INSTITUTION_ADMIN", "REGISTRAR", "HOD", "FACULTY", "ACCOUNTS", "EXAMINATION", "HR"]],
  ["/examination", ["EXAMINATION"]],
  ["/site-content", ["SUPER_ADMIN", "CMS"]],
  ["/events-gallery", ["CHAIRMAN","MANAGEMENT","DIRECTOR","DEAN","REGISTRAR","HOD","FACULTY","ACCOUNTS","HR","ADMISSIONS","EXAMINATION","LIBRARIAN","PLACEMENT","IT","CMS","STUDENT","PARENT","CLUB_PRESIDENT","STAFF"]],

  [
    "/operations",
    [
      "INSTITUTION_ADMIN",
      "CHAIRMAN",
      "DIRECTOR",
      "DEAN",
      "HOD",
      "IT",
    ],
  ],

  ["/timetable", ["CHAIRMAN", "DIRECTOR", "DEAN", "HOD", "FACULTY"]],

  [
    "/reports",
    [
      "INSTITUTION_ADMIN",
      "CHAIRMAN",
      "DIRECTOR",
      "DEAN",
      "REGISTRAR",
      "HOD",
      "ACCOUNTS",
      "HR",
      "ADMISSIONS",
      "EXAMINATION",
      "PLACEMENT",
    ],
  ],

  [
    "/intelligence",
    ["CHAIRMAN", "DIRECTOR", "DEAN", "HOD"],
  ],

  ["/students/[id]", ["INSTITUTION_ADMIN", "CHAIRMAN", "MANAGEMENT", "DIRECTOR", "DEAN", "REGISTRAR", "HOD", "FACULTY", "ACCOUNTS", "ADMISSIONS", "EXAMINATION", "PLACEMENT"]],
  ["/students", ["INSTITUTION_ADMIN"]],

  ["/user-management", ["INSTITUTION_ADMIN"]],

  [
    "/calendar",
    [
      "INSTITUTION_ADMIN",
      "CHAIRMAN",
      "DIRECTOR",
      "DEAN",
      "REGISTRAR",
      "HOD",
      "FACULTY",
      "STUDENT",
      "PARENT",
    ],
  ],

  [
    "/notices",
    [
      "INSTITUTION_ADMIN",
      "DEAN",
      "HOD",
      "STUDENT",
    ],
  ],

  [
    "/notifications",
    [
      "INSTITUTION_ADMIN",
      "DIRECTOR",
      "DEAN",
      "REGISTRAR",
      "HOD",
      "FACULTY",
      "STUDENT",
      "PARENT",
    ],
  ],

  [
    "/fees",
    [
      "SUPER_ADMIN",
      "CHAIRMAN",
      "MANAGEMENT",
      "REGISTRAR",
      "DIRECTOR",
      "DEAN",
      "HOD",
      "ACCOUNTS",
      "STUDENT",
      "PARENT",
    ],
  ],
  ["/accounts", ["ACCOUNTS"]],

  [
    "/obe",
    [
      "EXAMINATION",
      "DIRECTOR",
      "DEAN",
      "REGISTRAR",
      "HOD",
      "FACULTY",
      "STUDENT",
      "CHAIRMAN",
    ],
  ],

  [
    "/payments",
    [
      "ACCOUNTS",
      "STUDENT",
      "PARENT",
    ],
  ],

  ["/admissions", ["ADMISSIONS"]],

  [
    "/applications",
    ["ADMISSIONS"],
  ],

  [
    "/course-registration",
    [
      "REGISTRAR",
      "HOD",
      "DEAN",
      "DIRECTOR",
      "STUDENT",
    ],
  ],

  [
    "/student-promotion",
    [
      "REGISTRAR",
      "HOD",
      "DEAN",
      "DIRECTOR",
    ],
  ],

  [
    "/certificates",
    [
      "REGISTRAR",
      "STUDENT",
    ],
  ],

  [
    "/results",
    [
      "CHAIRMAN",
      "DIRECTOR",
      "DEAN",
      "REGISTRAR",
      "HOD",
      "FACULTY",
      "STUDENT",
      "PARENT",
    ],
  ],

  [
    "/assignments",
    [
      "FACULTY",
      "HOD",
      "STUDENT",
    ],
  ],

  [
    "/attendance",
    [
      "FACULTY",
      "HOD",
      "STUDENT",
    ],
  ],

  [
    "/marks",
    [
      "FACULTY",
      "HOD",
      "STUDENT",
    ],
  ],

  [
    "/courses",
    [
      "FACULTY",
      "HOD",
      "STUDENT",
    ],
  ],

  ["/academics", ["DEAN"]],

  ["/employees", ["HR"]],

  [
    "/leave-management",
    [
      "FACULTY",
      "HR",
    ],
  ],

  [
    "/club-president",
    ["CLUB_PRESIDENT"],
  ],

  [
    "/account-security",
    [
      "SUPER_ADMIN",
      "INSTITUTION_ADMIN",
      "CHAIRMAN",
      "DIRECTOR",
      "DEAN",
      "REGISTRAR",
      "HOD",
      "FACULTY",
      "ACCOUNTS",
      "HR",
      "ADMISSIONS",
      "EXAMINATION",
      "LIBRARIAN",
      "PLACEMENT",
      "IT",
      "CMS",
      "STUDENT",
      "PARENT",
      "CLUB_PRESIDENT",
      "MANAGEMENT",
      "STAFF",
    ],
  ],

];

export function isNavigationItemActive(pathname: string, item: NavigationItem): boolean {
  const normalize = (value: string) => value.replace(/\/+$/, "") || "/";
  const [currentPathRaw, currentQueryRaw] = pathname.split("?");
  const [hrefPathRaw, hrefQueryRaw] = item.href.split("?");
  const currentPath = normalize(currentPathRaw);
  const targetPath = normalize(hrefPathRaw);

  const matchMode = item.activeMatch ?? "nested";
  const pathMatches =
    matchMode === "exact"
      ? currentPath === targetPath
      : currentPath === targetPath || currentPath.startsWith(targetPath + "/");

  if (!pathMatches) return false;

  const requiredQuery = new URLSearchParams(hrefQueryRaw || "");
  const absentQueryKeys = new Set<string>();

  if (item.activeQuery) {
    for (const [key, value] of Object.entries(item.activeQuery)) {
      if (value === null) {
        requiredQuery.delete(key);
        absentQueryKeys.add(key);
      } else {
        requiredQuery.set(key, value);
        absentQueryKeys.delete(key);
      }
    }
  }

  const currentQuery =
    currentQueryRaw !== undefined
      ? new URLSearchParams(currentQueryRaw)
      : typeof window !== "undefined"
        ? new URLSearchParams(window.location.search)
        : new URLSearchParams();

  for (const key of absentQueryKeys) {
    if (currentQuery.has(key)) return false;
  }

  for (const [key, value] of requiredQuery.entries()) {
    if (currentQuery.get(key) !== value) return false;
  }

  return true;
}
export function getNavigationForRoles(
  roles: string[],
  permissions: string[] = [],
  tenantFeatures: string[] = [],
): NavigationItem[] {
  const activeRole = getPrimaryRole(roles);

  const permissionSet = new Set(
    permissions,
  );

  const visible = ROLE_NAVIGATION.filter((item) => {
    const roleAllowed =
      !item.roles ||
      item.roles.length === 0 ||
      item.roles.some((role) => normalizeRoleName(role) === activeRole);

    const permissionAllowed = item.anyPermissions?.length
      ? item.anyPermissions.some((permission) => permissionSet.has(permission))
      : !item.permissions ||
        item.permissions.length === 0 ||
        item.permissions.every((permission) => permissionSet.has(permission));

    const requiredFeatures = tenantFeaturesForNavigation(item);
    const itemPath = item.href.split("?")[0].replace(/\/+$/, "") || "/";
    // Public website CMS is a platform-owned workspace for Super Admin. It
    // must not require a tenant subscription, because a platform account has
    // no institution whose entitlements could be evaluated.
    const platformManagedCms = activeRole === "SUPER_ADMIN" && itemPath === "/site-content";
    const featureAllowed = platformManagedCms || requiredFeatures.every((feature) =>
      tenantFeatures.includes(feature),
    );

    return roleAllowed && permissionAllowed && featureAllowed;
  });
  // One destination gets one navigation entry. If several visible entries
  // intentionally land on the same page (including tab/query variants),
  // combine their names instead of making users choose between duplicates.
  const merged = new Map<string, NavigationItem>();

  for (const item of visible) {
    const [destinationPath, destinationQuery] = item.href.split("?");
    const destination = (destinationPath.replace(/\/+$/, "") || "/") + (destinationQuery ? `?${destinationQuery}` : "");
    const existing = merged.get(destination);

    if (!existing) {
      merged.set(destination, {
        ...item,
        label: item.label,
        permissions: item.permissions ? [...item.permissions] : undefined,
      });
      continue;
    }

    const labels = existing.label.split(" & ").filter(Boolean);
    if (!labels.includes(item.label)) labels.push(item.label);

    const permissions = Array.from(
      new Set([...(existing.permissions ?? []), ...(item.permissions ?? [])]),
    );

    merged.set(destination, {
      ...existing,
      label: labels.join(" & "),
      href: existing.href.includes("?") ? item.href.split("?")[0] : existing.href,
      permissions: permissions.length ? permissions : undefined,
    });
  }

  const ordered = Array.from(merged.values());
  const priority = (item: NavigationItem): number => {
    if (item.label === "Overview") return 0;
    if (item.label === "Profile") return 1;
    if (item.label === "Account Security") return 99;
    return 10;
  };
  return ordered
    .map((item, index) => ({ item, index }))
    .sort((a, b) => priority(a.item) - priority(b.item) || a.index - b.index)
    .map(({ item }) => item);
}

export function navigationForUser(
  user: {
    roles: string[];
    permissions: string[];
    tenantFeatures?: string[];
  } | null,
): NavigationItem[] {
  if (!user) {
    return [];
  }

  return getNavigationForRoles(
    user.roles,
    user.permissions,
    user.tenantFeatures ?? [],
  );
}

function namespaceMatchesPath(pathname: string, prefix: string): boolean {
  const pathSegments = pathname.split("/").filter(Boolean);
  const prefixSegments = prefix.split("/").filter(Boolean);
  const hasDynamicSegment = prefixSegments.some(
    (segment) => segment.startsWith("[") && segment.endsWith("]"),
  );

  if (hasDynamicSegment) {
    return prefixSegments.length === pathSegments.length &&
      prefixSegments.every((segment, index) =>
        segment.startsWith("[") && segment.endsWith("]")
          ? pathSegments[index].length > 0
          : pathSegments[index] === segment,
      );
  }

  return pathname === prefix || pathname.startsWith(prefix + "/");
}

const REDIRECT_ONLY_ROUTE_ROLES: Record<string, string[]> = {
  "/club": ["CLUB_PRESIDENT"],
  "/cms": ["SUPER_ADMIN", "CMS"],
  "/enrollment": ["ADMISSIONS"],
  "/forms": ["REGISTRAR"],
  "/institution-settings": ["INSTITUTION_ADMIN"],
  "/institutionalcms": ["INSTITUTION_ADMIN", "CHAIRMAN", "MANAGEMENT", "DIRECTOR"],
  "/payments": ["ACCOUNTS", "STUDENT", "PARENT"],
  "/fees/receipts": ["ACCOUNTS"],
  "/accounts/fees": ["ACCOUNTS"],
  "/chairman/fee-approvals": ["CHAIRMAN"],
  "/hod/students": ["HOD"],
  "/library/circulation": ["LIBRARIAN"],
  "/student/admit-cards": ["STUDENT"],
  "/student/marks": ["STUDENT"],
  "/student/results": ["STUDENT"],
  "/superadmin/audit": ["SUPER_ADMIN"],
  "/superadmin/institutions": ["SUPER_ADMIN"],
  "/superadmin/plans": ["SUPER_ADMIN"],
  "/superadmin/users": ["SUPER_ADMIN"],
};

const REDIRECT_ONLY_ROUTE_PERMISSIONS: Record<string, string[]> = {
  "/accounts/fees": ["fees.read"],
  "/chairman/fee-approvals": ["fees.structure.read"],
  "/hod/students": ["students.read"],
  "/library/circulation": ["library.manage"],
  "/student/admit-cards": ["exams.read"],
  "/student/marks": ["marks.read"],
  "/student/results": ["results.read"],
  "/superadmin/audit": ["audit.read"],
  "/superadmin/institutions": ["institutions.manage"],
  "/superadmin/plans": ["plans.manage"],
  "/superadmin/users": ["users.read"],
};

export function canAccessRoute(
  pathname: string,
  roles: string[],
  permissions: string[] = [],
  tenantFeatures: string[] = [],
): boolean {
  const [rawPath, rawQuery] = pathname.split("?");
  const normalizedPath =
    rawPath.replace(
      /\/+$/,
      "",
    ) || "/";
  const currentQuery = new URLSearchParams(rawQuery || "");

  const activeRole = getPrimaryRole(roles);

  // This URL is a redirect-only legacy alias, not the Operations workspace.
  // Allow only the effective Director role to reach its redirect even when the
  // tenant's separate Operations feature is disabled; /director is authorized
  // normally after navigation, and this route serves no operational data.
  if (normalizedPath === "/director/operations") return activeRole === "DIRECTOR";
  // Chairman Operations is a redirect-only compatibility route, not the
  // Operations feature itself, so it serves no operational data.
  if (normalizedPath === "/chairman/operations") return activeRole === "CHAIRMAN";

  const permissionSet = new Set(permissions);
  // Tenant entitlement checks run before namespace checks so role-owned routes
  // omitted from NAMESPACE_OWNERS cannot bypass the feature gate.
  const requiredTenantFeatures = tenantFeaturesForPath(pathname);
  const platformManagedCms = activeRole === "SUPER_ADMIN" && (normalizedPath === "/site-content" || normalizedPath === "/cms");
  if (!platformManagedCms) {
    if (requiredTenantFeatures.some((feature) => !tenantFeatures.includes(feature))) return false;
  }

  // Explicit legacy aliases render no module data: authorize only the declared
  // effective role, tenant entitlement, and any alias-specific permission.
  // Run this before the namespace fail-closed check because aliases such as
  // /payments and /forms intentionally have no normal data-route namespace.
  const redirectOnlyRoles = REDIRECT_ONLY_ROUTE_ROLES[normalizedPath];
  if (redirectOnlyRoles) {
    const requiredAliasPermissions = REDIRECT_ONLY_ROUTE_PERMISSIONS[normalizedPath] ?? [];
    if (!requiredAliasPermissions.every((permission) => permissionSet.has(permission))) return false;
    return redirectOnlyRoles.some((role) => normalizeRoleName(role) === activeRole);
  }

  const matchingNamespace =
    NAMESPACE_OWNERS
      .filter(([prefix]) => namespaceMatchesPath(normalizedPath, prefix))
      .sort(
        (a, b) =>
          b[0].length -
          a[0].length,
      )[0];

  if (!matchingNamespace) {
    // Protected routes fail closed unless a namespace (including a specific
    // legacy alias/shared workspace) explicitly declares their owner roles.
    return false;
  }

  const [, allowedRoles] =
    matchingNamespace;

  const roleAllowed = allowedRoles.some((role) => normalizeRoleName(role) === activeRole);

  if (!roleAllowed) {
    return false;
  }

  // Permission-gated module namespaces are denied unless the authenticated
  // user actually has the module's read capability. Role ownership alone is
  // never enough to open a protected module directly by URL.
  // Shared communication pages have role-owned aliases. Their route gate must
  // check the actual read capability instead of treating sidebar ownership as
  // permission to open a URL directly.
  const ROLE_OWNED_COMMUNICATION_PREFIXES = [
    "/admin",
    "/chairman",
    "/management",
    "/director",
    "/dean",
    "/registrar",
    "/hod",
    "/faculty",
    "/accounts",
    "/hr",
    "/admissions",
    "/examination",
    "/library",
    "/placements",
    "/it",
    "/student",
    "/parent",
    "/club-president",
    "/staff",
    "/site-content",
  ];
  const communicationNamespacePermissions: Array<[string, string]> =
    ROLE_OWNED_COMMUNICATION_PREFIXES.flatMap((prefix): Array<[string, string]> => [
      [`${prefix}/notices`, "notices.read"],
      [`${prefix}/notifications`, "notifications.read"],
    ]);
  const namespacePermission: Array<[string, string]> = [
    ["/notices", "notices.read"],
    ["/notifications", "notifications.read"],
    ...communicationNamespacePermissions,
    ["/parent/students", "parent-portal.read"],
    ["/students", "students.read"],
    ["/lms/settings", "lms.manage"],
    ["/lms", "lms.read"],
    ["/obe", "obe.read"],
    ["/examination", "exams.read"],
  ];
  const requiredPermission = namespacePermission
    .filter(([prefix]) => normalizedPath === prefix || normalizedPath.startsWith(prefix + "/"))
    .sort((a, b) => b[0].length - a[0].length)[0]?.[1];
  if (requiredPermission && !permissionSet.has(requiredPermission)) return false;

  // Placement pages are a single role-owned workspace. Deep routes such as
  // calendar, applications, interviews and offers must not be denied merely
  // because each operational page is not duplicated in the sidebar registry.
  if (normalizedPath.startsWith("/placements/")) {
    return activeRole === "PLACEMENT" && permissionSet.has("placements.read");
  }

  const matchingItems = ROLE_NAVIGATION
    .filter((item) => {
      // Resolve the same role-owned destination that DashboardShell renders.
      // Without this step, links such as /reports -> /library/reports appear
      // in the sidebar but their final URL is rejected by direct-route auth.
      const targetHref = roleOwnedHref(activeRole, item.href);
      const [itemPath, itemQuery] = targetHref.split("?");
      const href = itemPath.replace(/\/+$/, "") || "/";
      // A dashboard landing item is not blanket authorization for every
      // child URL in its namespace. Deep routes need an explicitly declared
      // nested destination or their own owner policy.
      if (normalizedPath !== href && (item.activeMatch === "exact" || Boolean(itemQuery) || !normalizedPath.startsWith(href + "/"))) return false;
      if (itemQuery) {
        const required = new URLSearchParams(itemQuery);
        for (const [key, value] of required.entries()) {
          if (currentQuery.get(key) !== value) return false;
        }
      }
      return true;
    })
    .sort((a, b) => roleOwnedHref(activeRole, b.href).length - roleOwnedHref(activeRole, a.href).length);

  const relevantItem = matchingItems.find((item) =>
    !item.roles?.length ||
    item.roles.some((role) => normalizeRoleName(role) === activeRole),
  );

  if (!relevantItem) {
    // Explicit dynamic namespace entries represent detail routes whose page
    // contract authorizes owner roles even when no sidebar item targets an ID.
    // Keep the match exact to the declared route shape; arbitrary nested paths
    // and unknown protected routes remain denied.
    if (
      matchingNamespace[0].split("/").some(
        (segment) => segment.startsWith("[") && segment.endsWith("]"),
      )
    ) {
      return true;
    }

    const protectedNamespace = NAMESPACE_OWNERS.some(([prefix]) =>
      namespaceMatchesPath(normalizedPath, prefix),
    );
    return !protectedNamespace;
  }

  if (relevantItem.anyPermissions?.length) {
    return relevantItem.anyPermissions.some((permission) => permissionSet.has(permission));
  }
  return (
    !relevantItem.permissions?.length ||
    relevantItem.permissions.every((permission) => permissionSet.has(permission))
  );
}

export function workspaceHome(roles: string[]): string {
  const role = getPrimaryRole(roles);
  const homeByRole: Record<string, string> = {
    SUPER_ADMIN: "/superadmin",
    INSTITUTION_ADMIN: "/admin",
    CHAIRMAN: "/chairman",
    MANAGEMENT: "/management",
    DIRECTOR: "/director",
    DEAN: "/dean",
    REGISTRAR: "/registrar",
    HOD: "/hod",
    FACULTY: "/faculty",
    ACCOUNTS: "/accounts",
    HR: "/hr",
    ADMISSIONS: "/admissions",
    EXAMINATION: "/examination",
    LIBRARIAN: "/library",
    PLACEMENT: "/placements",
    IT: "/it",
    CMS: "/site-content",
    STUDENT: "/student",
    PARENT: "/parent",
    CLUB_PRESIDENT: "/club-president",
    STAFF: "/staff",
  };
  return role ? homeByRole[role] ?? "/" : "/";
}
