export type PermissionKey = string;

const ROLE_ALIASES: Record<string, string> = {
  MANAGEMENT: "CHAIRMAN",
  STAFF: "ACCOUNTS",
};

function normalizeRoleName(role: string): string {
  const normalized = role.trim().toUpperCase();
  return ROLE_ALIASES[normalized] ?? normalized;
}

const TENANT_FEATURE_BY_ROUTE: Array<[RegExp, string]> = [
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
  [/^\/(hr|employees|leave-management)(\/|$)/, "hr"],
  [/^\/((student)\/)?timetable(\/|$)/, "timetable"],
  [/^\/lms(\/|$)/, "lms"],
  [/^\/course-registration(\/|$)|^\/student\/course-registration(\/|$)/, "registration"],
  [/^\/certificates?(\/|$)/, "certificates"],
  [/^\/library(\/|$)/, "library"],
  [/^\/students(\/|$)/, "students"],
  [/^\/faculty(\/|$)/, "faculty"],
  [/^\/admin\/(students|departments|programs|academic|courses|sections|semesters|student-setup)(\/|$)/, "academics"],
];

function tenantFeatureForNavigation(item: NavigationItem): string | null {
  const match = TENANT_FEATURE_BY_ROUTE.find(([pattern]) => pattern.test(item.href.split("?")[0]));
  return match?.[1] ?? null;
}


  label: string;
  href: string;
  icon?: string;
  roles?: string[];
  permissions?: PermissionKey[];
  group?: string;
  children?: NavigationItem[];
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

export const ROLE_NAVIGATION: NavigationItem[] = [
  {
    label: "Platform overview",
    href: "/superadmin",
    icon: "⌂",
    roles: ["SUPER_ADMIN"],
    group: "Platform",
  },
  {
    label: "Institutions",
    href: "/superadmin/institutions",
    icon: "▦",
    roles: ["SUPER_ADMIN"],
    permissions: ["institutions.manage"],
    group: "Platform",
  },
  {
    label: "Plans",
    href: "/superadmin/plans",
    icon: "₹",
    roles: ["SUPER_ADMIN"],
    permissions: ["plans.manage"],
    group: "Platform",
  },
  {
    label: "Platform users",
    href: "/superadmin/users",
    icon: "♙",
    roles: ["SUPER_ADMIN"],
    permissions: ["users.read"],
    group: "Platform",
  },
  {
    label: "Platform audit",
    href: "/superadmin/audit",
    icon: "▤",
    roles: ["SUPER_ADMIN"],
    permissions: ["audit.read"],
    group: "Platform",
  },
  {
    label: "Account security",
    href: "/account-security",
    icon: "◉",
    roles: ["SUPER_ADMIN"],
    group: "Account",
  },
  {
    label: "Public website",
    href: "/site-content",
    icon: "✦",
    roles: ["SUPER_ADMIN"],
    permissions: ["site.manage"],
    group: "Platform",
  },

  {
    label: "Overview",
    href: "/admin",
    icon: "⌂",
    roles: ["INSTITUTION_ADMIN"],
    group: "Administration",
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
    label: "Account security",
    href: "/account-security",
    icon: "◉",
    roles: ["INSTITUTION_ADMIN"],
    group: "Account",
  },

  {
    label: "Overview",
    href: "/chairman",
    icon: "⌂",
    roles: ["CHAIRMAN"],
    group: "Workspace",
  },
  {
    label: "Institution Collection",
    href: "/fees/collections",
    icon: "₹",
    roles: ["CHAIRMAN"],
    permissions: ["fees.collection.read"],
    group: "Finance",
  },
  {
    label: "Intelligence",
    href: "/intelligence",
    icon: "✦",
    roles: ["CHAIRMAN"],
    permissions: ["intelligence.read"],
    group: "Oversight",
  },
  {
    label: "Reports",
    href: "/reports",
    icon: "▤",
    roles: ["CHAIRMAN"],
    permissions: ["reports.read"],
    group: "Oversight",
  },
  {
    label: "Financial oversight",
    href: "/fees",
    icon: "₹",
    roles: ["CHAIRMAN"],
    permissions: ["fees.read"],
    group: "Oversight",
  },
  {
    label: "Academic oversight",
    href: "/examination",
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
    label: "Operations oversight",
    href: "/operations",
    icon: "⚙",
    roles: ["CHAIRMAN"],
    permissions: ["operations.read"],
    group: "Oversight",
  },
  {
    label: "Overview",
    href: "/director",
    icon: "⌂",
    roles: ["DIRECTOR"],
    group: "Workspace",
  },
  {
    label: "Intelligence",
    href: "/intelligence",
    icon: "✦",
    roles: ["DIRECTOR"],
    permissions: ["intelligence.read"],
    group: "Oversight",
  },
  {
    label: "Reports",
    href: "/reports",
    icon: "▤",
    roles: ["DIRECTOR"],
    permissions: ["reports.read"],
    group: "Oversight",
  },
  {
    label: "Students",
    href: "/students",
    icon: "◎",
    roles: ["DIRECTOR"],
    permissions: ["students.read"],
    group: "Academic",
  },
  {
    label: "Admissions",
    href: "/admissions",
    icon: "▤",
    roles: ["DIRECTOR"],
    permissions: ["admissions.read"],
    group: "Academic",
  },
  {
    label: "Calendar",
    href: "/calendar",
    icon: "◫",
    roles: ["DIRECTOR"],
    permissions: ["calendar.read"],
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
    label: "Operations",
    href: "/operations",
    icon: "⚙",
    roles: ["DIRECTOR"],
    permissions: ["operations.read"],
    group: "Institution",
  },
  {
    label: "Campus Collection",
    href: "/fees/collections",
    icon: "₹",
    roles: ["DIRECTOR"],
    permissions: ["fees.collection.read"],
    group: "Finance",
  },

  {
    label: "Overview",
    href: "/dean",
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
    href: "/fees/collections",
    icon: "₹",
    roles: ["DEAN"],
    permissions: ["fees.collection.read"],
    group: "Finance",
  },
  {
    label: "Reports",
    href: "/reports",
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
    href: "/students",
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
    icon: "⌂",
    roles: ["REGISTRAR"],
    group: "Workspace",
  },
  {
    label: "Students",
    href: "/students",
    icon: "◎",
    roles: ["REGISTRAR"],
    permissions: ["students.read"],
    group: "Academic",
  },
  {
    label: "Admissions",
    href: "/admissions",
    icon: "▤",
    roles: ["REGISTRAR"],
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
    href: "/erp",
    icon: "▦",
    roles: ["REGISTRAR"],
    permissions: ["academic-years.read"],
    group: "Academic",
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
    label: "Examinations",
    href: "/examination",
    icon: "◉",
    roles: ["REGISTRAR"],
    permissions: ["exams.read"],
    group: "Academic",
  },

  {
    label: "Overview",
    href: "/hod",
    icon: "⌂",
    roles: ["HOD"],
    group: "Workspace",
  },
  {
    label: "Students",
    href: "/hod",
    icon: "◎",
    roles: ["HOD"],
    permissions: ["students.read"],
    group: "Academic",
  },
  {
    label: "Course Registration",
    href: "/hod?tab=registrations",
    icon: "▦",
    roles: ["HOD"],
    permissions: ["registration.read", "registration.approve"],
    group: "Academic",
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
    href: "/fees/collections",
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
    icon: "⌂",
    roles: ["FACULTY"],
    group: "Workspace",
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
    icon: "⌂",
    roles: ["ACCOUNTS"],
    group: "Workspace",
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
    permissions: ["fees.invoice.read"],
    group: "Billing",
  },
  {
    label: "Payments",
    href: "/accounts/payments",
    icon: "₹",
    roles: ["ACCOUNTS"],
    permissions: ["fees.payment.read"],
    group: "Collections",
  },
  {
    label: "Receipts",
    href: "/accounts/receipts",
    icon: "▤",
    roles: ["ACCOUNTS"],
    permissions: ["fees.receipt.read"],
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
    permissions: ["fees.collection.read"],
    group: "Collections",
  },
  {
    label: "Concessions",
    href: "/accounts/concessions",
    icon: "◇",
    roles: ["ACCOUNTS"],
    permissions: ["fees.concession.read"],
    group: "Adjustments",
  },
  {
    label: "Refunds",
    href: "/accounts/refunds",
    icon: "↩",
    roles: ["ACCOUNTS"],
    permissions: ["fees.refund.read"],
    group: "Adjustments",
  },
  {
    label: "Transactions",
    href: "/accounts/transactions",
    icon: "▤",
    roles: ["ACCOUNTS"],
    permissions: ["fees.payment.read"],
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
    permissions: ["fees.reports.read"],
    group: "Reporting",
  },

  {
    label: "Overview",
    href: "/hr",
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
    label: "Overview",
    href: "/admissions",
    icon: "⌂",
    roles: ["ADMISSIONS"],
    group: "Workspace",
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
    href: "/students",
    icon: "◎",
    roles: ["ADMISSIONS"],
    permissions: ["students.read"],
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
    icon: "⌂",
    roles: ["EXAMINATION"],
    group: "Workspace",
  },
  {
    label: "Exam operations",
    href: "/examination",
    icon: "◉",
    roles: ["EXAMINATION"],
    permissions: ["exams.read"],
    group: "Examinations",
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
    icon: "⌂",
    roles: ["LIBRARIAN"],
    group: "Workspace",
  },
  {
    label: "Students",
    href: "/students",
    icon: "◎",
    roles: ["LIBRARIAN"],
    permissions: ["students.read"],
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
    icon: "⌂",
    roles: ["PLACEMENT"],
    group: "Workspace",
  },
  {
    label: "Students",
    href: "/students",
    icon: "◎",
    roles: ["PLACEMENT"],
    permissions: ["students.read"],
    group: "Placement",
  },
  {
    label: "Reports",
    href: "/reports",
    icon: "▤",
    roles: ["PLACEMENT"],
    permissions: ["reports.read"],
    group: "Placement",
  },

  {
    label: "Overview",
    href: "/it",
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


  {
    label: "Overview",
    href: "/site-content",
    icon: "⌂",
    roles: ["CMS"],
    group: "Workspace",
  },

  /*
   * ============================================================
   * STUDENT WORKSPACE
   * ============================================================
   */

  {
    label: "Overview",
    href: "/student",
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
    label: "Marks",
    href: "/student/marks",
    icon: "◎",
    roles: ["STUDENT"],
    permissions: ["marks.read"],
    group: "Academic",
  },
  {
    label: "Examinations",
    href: "/student/examinations",
    icon: "✍",
    roles: ["STUDENT"],
    permissions: ["exams.read"],
    group: "Academic",
  },
  {
    label: "Admit Cards",
    href: "/student/admit-cards",
    icon: "▤",
    roles: ["STUDENT"],
    permissions: ["exams.read"],
    group: "Academic",
  },
  {
    label: "Results",
    href: "/student/results",
    icon: "▤",
    roles: ["STUDENT"],
    permissions: ["results.read"],
    group: "Academic",
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
    label: "Course Registration",
    href: "/student/course-registration",
    icon: "▦",
    roles: ["STUDENT"],
    permissions: ["registration.submit"],
    group: "Academic",
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
    label: "Overview",
    href: "/parent",
    icon: "⌂",
    roles: ["PARENT"],
    group: "Workspace",
  },

  {
    label: "Overview",
    href: "/club-president",
    icon: "⌂",
    roles: ["CLUB_PRESIDENT"],
    group: "Workspace",
  },
  {
    label: "Account security",
    href: "/account-security",
    icon: "◉",
    roles: [
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
    group: "Account",
  },
];

const NAMESPACE_OWNERS: Array<[string, string[]]> = [
  ["/superadmin", ["SUPER_ADMIN"]],
  ["/admin", ["INSTITUTION_ADMIN"]],
  ["/student", ["STUDENT"]],
  ["/faculty", ["FACULTY"]],
  ["/parent", ["PARENT"]],
  ["/chairman", ["CHAIRMAN"]],
  ["/director", ["DIRECTOR"]],
  ["/management", ["CHAIRMAN", "DIRECTOR"]],
  ["/dean", ["DEAN"]],
  ["/registrar", ["REGISTRAR"]],
  ["/hod", ["HOD"]],
  ["/accounts", ["ACCOUNTS"]],
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

  [
    "/placements",
    [
      "PLACEMENT",
      "STUDENT",
    ],
  ],

  ["/it", ["IT"]],
  ["/imports", ["INSTITUTION_ADMIN", "REGISTRAR", "HOD", "FACULTY", "ACCOUNTS", "EXAMINATION", "HR"]],
  ["/examination", ["EXAMINATION"]],
  ["/site-content", ["SUPER_ADMIN", "CMS"]],

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

  [
    "/timetable",
    [
      "CHAIRMAN",
      "DIRECTOR",
      "DEAN",
      "HOD",
      "FACULTY",
      "STUDENT",
      "PARENT",
    ],
  ],

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

  [
    "/students",
    [
      "INSTITUTION_ADMIN",
      "CHAIRMAN",
      "DIRECTOR",
      "DEAN",
      "REGISTRAR",
      "HOD",
      "FACULTY",
      "ACCOUNTS",
      "ADMISSIONS",
      "EXAMINATION",
      "LIBRARIAN",
      "PLACEMENT",
    ],
  ],

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
      "CHAIRMAN",
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

  [
    "/admissions",
    [
      "ADMISSIONS",
      "REGISTRAR",
      "CHAIRMAN",
      "DIRECTOR",
      "DEAN",
    ],
  ],

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

  [
    "/academics",
    [
      "INSTITUTION_ADMIN",
      "DEAN",
      "REGISTRAR",
      "HOD",
      "FACULTY",
      "STUDENT",
    ],
  ],

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

export function getNavigationForRoles(
  roles: string[],
  permissions: string[] = [],
): NavigationItem[] {
  const roleSet = new Set(
    roles.map((role) =>
      normalizeRoleName(role),
    ),
  );

  const permissionSet = new Set(
    permissions,
  );

  const visible = ROLE_NAVIGATION.filter((item) => {
    const roleAllowed =
      !item.roles ||
      item.roles.length === 0 ||
      item.roles.some((role) => {
        const normalized = normalizeRoleName(role);
        return normalized !== null && roleSet.has(normalized);
      });

    const permissionAllowed =
      !item.permissions ||
      item.permissions.length === 0 ||
      item.permissions.every((permission) => permissionSet.has(permission));

    return roleAllowed && permissionAllowed;
  });

  // One destination gets one navigation entry. If several visible entries
  // intentionally land on the same page (including tab/query variants),
  // combine their names instead of making users choose between duplicates.
  const merged = new Map<string, NavigationItem>();

  for (const item of visible) {
    const destination = item.href.split("?")[0].replace(/\/+$/, "") || "/";
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

  return Array.from(merged.values());
}

export function navigationForUser(
  user: {
    roles: string[];
    permissions: string[];
  } | null,
): NavigationItem[] {
  if (!user) {
    return [];
  }

  return getNavigationForRoles(
    user.roles,
    user.permissions,
  );
}

export function canAccessRoute(
  pathname: string,
  roles: string[],
  permissions: string[] = [],
  tenantFeatures: string[] = [],
): boolean {
  const normalizedPath =
    pathname.replace(
      /\/+$/,
      "",
    ) || "/";

  const normalizedRoles =
    roles.map((role) =>
      normalizeRoleName(role),
    );

  const matchingNamespace =
    NAMESPACE_OWNERS
      .filter(
        ([prefix]) =>
          normalizedPath === prefix ||
          normalizedPath.startsWith(
            `${prefix}/`,
          ),
      )
      .sort(
        (a, b) =>
          b[0].length -
          a[0].length,
      )[0];

  if (!matchingNamespace) {
    return true;
  }

  const [, allowedRoles] =
    matchingNamespace;

  const roleAllowed = allowedRoles.some((role) => {
    const normalized = normalizeRoleName(role);
    return normalized !== null && normalizedRoles.includes(normalized);
  });

  if (!roleAllowed) {
    return false;
  }

  const permissionSet = new Set(permissions);
  const tenantFeature = TENANT_FEATURE_BY_ROUTE.find(([pattern]) => pattern.test(normalizedPath))?.[1];
  if (tenantFeature && tenantFeatures.length > 0 && !tenantFeatures.includes(tenantFeature)) return false;

  // Permission-gated module namespaces are denied unless the authenticated
  // user actually has the module's read capability. Role ownership alone is
  // never enough to open a protected module directly by URL.
  const namespacePermission: Array<[string, string]> = [
    ["/obe", "obe.read"],
    ["/examination", "exams.read"],
  ];
  const requiredPermission = namespacePermission
    .filter(([prefix]) => normalizedPath === prefix || normalizedPath.startsWith(prefix + "/"))
    .sort((a, b) => b[0].length - a[0].length)[0]?.[1];
  if (requiredPermission && !permissionSet.has(requiredPermission)) return false;

  const matchingItems = ROLE_NAVIGATION
    .filter((item) => {
      const href = item.href.replace(/\/+$/, "") || "/";
      return normalizedPath === href || normalizedPath.startsWith(href + "/");
    })
    .sort((a, b) => b.href.length - a.href.length);

  const relevantItem = matchingItems.find((item) =>
    !item.roles?.length ||
    item.roles.some((role) => {
      const normalized = normalizeRoleName(role);
      return normalized !== null && normalizedRoles.includes(normalized);
    }),
  );

  if (!relevantItem) {
    const protectedNamespace = NAMESPACE_OWNERS.some(([prefix]) =>
      normalizedPath === prefix || normalizedPath.startsWith(prefix + "/"),
    );
    return !protectedNamespace;
  }

  return (
    !relevantItem.permissions?.length ||
    relevantItem.permissions.every((permission) => permissionSet.has(permission))
  );
}

export function workspaceHome(
  roles: string[],
): string {
  const normalizedRoles = roles
    .map((role) => normalizeRoleName(role))
    .filter(
      (role): role is NonNullable<ReturnType<typeof normalizeRoleName>> =>
        role !== null,
    );

  if (
    normalizedRoles.includes(
      "SUPER_ADMIN",
    )
  ) {
    return "/superadmin";
  }

  if (
    normalizedRoles.includes(
      "INSTITUTION_ADMIN",
    )
  ) {
    return "/admin";
  }

  if (
    normalizedRoles.includes(
      "CHAIRMAN",
    )
  ) {
    return "/chairman";
  }

  if (
    normalizedRoles.includes(
      "DIRECTOR",
    )
  ) {
    return "/director";
  }

  if (
    normalizedRoles.includes(
      "DEAN",
    )
  ) {
    return "/dean";
  }

  if (
    normalizedRoles.includes(
      "REGISTRAR",
    )
  ) {
    return "/registrar";
  }

  if (
    normalizedRoles.includes(
      "HOD",
    )
  ) {
    return "/hod";
  }

  if (
    normalizedRoles.includes(
      "FACULTY",
    )
  ) {
    return "/faculty";
  }

  if (
    normalizedRoles.includes(
      "ACCOUNTS",
    )
  ) {
    return "/accounts";
  }

  if (
    normalizedRoles.includes(
      "HR",
    )
  ) {
    return "/hr";
  }

  if (
    normalizedRoles.includes(
      "ADMISSIONS",
    )
  ) {
    return "/admissions";
  }

  if (
    normalizedRoles.includes(
      "EXAMINATION",
    )
  ) {
    return "/examination";
  }

  if (
    normalizedRoles.includes(
      "LIBRARIAN",
    )
  ) {
    return "/library";
  }

  if (
    normalizedRoles.includes(
      "PLACEMENT",
    )
  ) {
    return "/placements";
  }

  if (
    normalizedRoles.includes(
      "IT",
    )
  ) {
    return "/it";
  }

  if (
    normalizedRoles.includes(
      "CMS",
    )
  ) {
    return "/site-content";
  }

  if (
    normalizedRoles.includes(
      "STUDENT",
    )
  ) {
    return "/student";
  }

  if (
    normalizedRoles.includes(
      "PARENT",
    )
  ) {
    return "/parent";
  }

  if (
    normalizedRoles.includes(
      "CLUB_PRESIDENT",
    )
  ) {
    return "/club-president";
  }

  if (
    normalizedRoles.includes(
      "MANAGEMENT",
    )
  ) {
    return "/management";
  }

  if (
    normalizedRoles.includes(
      "STAFF",
    )
  ) {
    return "/staff";
  }

  return "/";
}
