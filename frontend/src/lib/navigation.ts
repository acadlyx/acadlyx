export type PermissionKey = string;

export type NavigationItem = {
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
    label: "Overview",
    href: "/admin",
    icon: "⌂",
    roles: ["INSTITUTION_ADMIN"],
    group: "Administration",
  },
  {
    label: "People",
    href: "/user-management",
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
    href: "/students",
    icon: "◎",
    roles: ["INSTITUTION_ADMIN"],
    permissions: ["students.read"],
    group: "People",
  },
  {
    label: "Academic structure",
    href: "/admin",
    icon: "▦",
    roles: ["INSTITUTION_ADMIN"],
    permissions: ["departments.read"],
    group: "Institution",
  },
  {
    label: "Campuses",
    href: "/admin",
    icon: "⌂",
    roles: ["INSTITUTION_ADMIN"],
    permissions: ["campuses.read"],
    group: "Institution",
  },
  {
    label: "Notices",
    href: "/notices",
    icon: "◌",
    roles: ["INSTITUTION_ADMIN"],
    permissions: ["notices.read"],
    group: "Institution",
  },
  {
    label: "Calendar",
    href: "/calendar",
    icon: "◫",
    roles: ["INSTITUTION_ADMIN"],
    permissions: ["calendar.read"],
    group: "Institution",
  },
  {
    label: "Notifications",
    href: "/notifications",
    icon: "◉",
    roles: ["INSTITUTION_ADMIN"],
    permissions: ["notifications.read"],
    group: "Institution",
  },
  {
    label: "Operations",
    href: "/operations",
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
    href: "/examinations",
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
    label: "Audit",
    href: "/reports",
    icon: "▤",
    roles: ["CHAIRMAN"],
    permissions: ["audit.read"],
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
    label: "Import / Export",
    href: "/director/imports",
    icon: "⇅",
    roles: ["DIRECTOR"],
    permissions: ["imports.manage"],
    group: "Oversight",
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
    href: "/dean/fees",
    icon: "₹",
    roles: ["DEAN"],
    permissions: ["fees.read"],
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
    label: "Overview",
    href: "/hod",
    icon: "⌂",
    roles: ["HOD"],
    group: "Workspace",
  },
  {
    label: "Students",
    href: "/students",
    icon: "◎",
    roles: ["HOD"],
    permissions: ["students.read"],
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
    href: "/hod/fees",
    icon: "₹",
    roles: ["HOD"],
    permissions: ["fees.read"],
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
    label: "Fees",
    href: "/accounts/fees",
    icon: "₹",
    roles: ["ACCOUNTS"],
    permissions: ["fees.read"],
    group: "Finance",
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
    label: "Overview",
    href: "/examinations",
    icon: "⌂",
    roles: ["EXAMINATION"],
    group: "Workspace",
  },

  {
    label: "Overview",
    href: "/library",
    icon: "⌂",
    roles: ["LIBRARIAN"],
    group: "Workspace",
  },

  {
    label: "Overview",
    href: "/placements",
    icon: "⌂",
    roles: ["PLACEMENT"],
    group: "Workspace",
  },

  {
    label: "Overview",
    href: "/it",
    icon: "⌂",
    roles: ["IT"],
    group: "Workspace",
  },

  {
    label: "Import / Export",
    href: "/it/imports",
    icon: "⇅",
    roles: ["IT"],
    permissions: ["imports.manage"],
    group: "Operations",
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
    label: "Results",
    href: "/student/results",
    icon: "▤",
    roles: ["STUDENT"],
    permissions: ["results.read"],
    group: "Academic",
  },
  {
    label: "Outcome Based Education",
    href: "/obe",
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
    label: "Overview",
    href: "/parent",
    icon: "⌂",
    roles: ["PARENT"],
    group: "Workspace",
  },

  {
    label: "Overview",
    href: "/management",
    icon: "⌂",
    roles: ["MANAGEMENT"],
    group: "Workspace",
  },
  {
    label: "Intelligence",
    href: "/intelligence",
    icon: "✦",
    roles: ["MANAGEMENT"],
    permissions: ["intelligence.read"],
    group: "Oversight",
  },
  {
    label: "Reports",
    href: "/reports",
    icon: "▤",
    roles: ["MANAGEMENT"],
    permissions: ["reports.read"],
    group: "Oversight",
  },
  {
    label: "Examinations",
    href: "/examinations",
    icon: "◉",
    roles: ["MANAGEMENT"],
    permissions: ["exams.read"],
    group: "Academic",
  },
  {
    label: "Operations",
    href: "/operations",
    icon: "⚙",
    roles: ["MANAGEMENT"],
    permissions: ["operations.read"],
    group: "Institution",
  },

  {
    label: "Overview",
    href: "/staff",
    icon: "⌂",
    roles: ["STAFF"],
    group: "Workspace",
  },
  {
    label: "Students",
    href: "/students",
    icon: "◎",
    roles: ["STAFF"],
    permissions: ["students.read"],
    group: "People",
  },

  {
    label: "Overview",
    href: "/club-president",
    icon: "⌂",
    roles: ["CLUB_PRESIDENT"],
    group: "Workspace",
  },
  {
    label: "Club",
    href: "/club-president",
    icon: "◎",
    roles: ["CLUB_PRESIDENT"],
    permissions: ["club.read"],
    group: "Club",
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
  ["/admissions", ["ADMISSIONS"]],

  [
    "/examinations",
    [
      "EXAMINATION",
      "FACULTY",
      "HOD",
      "DEAN",
      "DIRECTOR",
      "CHAIRMAN",
      "STUDENT",
    ],
  ],

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
  ["/imports", ["INSTITUTION_ADMIN", "DIRECTOR", "IT"]],
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
    "/students",
    [
      "INSTITUTION_ADMIN",
      "REGISTRAR",
      "HOD",
      "FACULTY",
      "STAFF",
    ],
  ],

  ["/user-management", ["INSTITUTION_ADMIN"]],

  [
    "/calendar",
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
      "ACCOUNTS",
      "STUDENT",
      "PARENT",
    ],
  ],

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
    ],
  ],

  [
    "/applications",
    ["ADMISSIONS"],
  ],

  [
    "/certificates",
    [
      "REGISTRAR",
      "STUDENT",
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

  ["/accounts", ["ACCOUNTS"]],

  ["/hr", ["HR"]],

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
      role.toUpperCase(),
    ),
  );

  const permissionSet = new Set(
    permissions,
  );

  return ROLE_NAVIGATION.filter(
    (item) => {
      const roleAllowed =
        !item.roles ||
        item.roles.length === 0 ||
        item.roles.some((role) =>
          roleSet.has(
            role.toUpperCase(),
          ),
        );

      const permissionAllowed =
        !item.permissions ||
        item.permissions.length === 0 ||
        item.permissions.every(
          (permission) =>
            permissionSet.has(
              permission,
            ),
        );

      return (
        roleAllowed &&
        permissionAllowed
      );
    },
  );
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
): boolean {
  const normalizedPath =
    pathname.replace(
      /\/+$/,
      "",
    ) || "/";

  const normalizedRoles =
    roles.map((role) =>
      role.toUpperCase(),
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

  return allowedRoles.some(
    (role) =>
      normalizedRoles.includes(
        role.toUpperCase(),
      ),
  );
}

export function workspaceHome(
  roles: string[],
): string {
  const normalizedRoles =
    roles.map((role) =>
      role.toUpperCase(),
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
    return "/examinations";
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
