import {
  AuthUser,
} from "./auth";

export type NavigationItem = {
  label: string;
  href: string;
  icon: string;
  roles: string[];
  permissions?: string[];
  group?: string;
};

const ROLE_PRIORITY = [
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
  "PARENT",
  "STUDENT",
];

export const ROLE_LABELS: Record<
  string,
  string
> = {
  SUPER_ADMIN:
    "Super Admin",

  INSTITUTION_ADMIN:
    "Institution Admin",

  CHAIRMAN:
    "Chairman",

  DIRECTOR:
    "Director",

  DEAN:
    "Dean",

  REGISTRAR:
    "Registrar",

  HOD:
    "Head of Department",

  FACULTY:
    "Faculty",

  ACCOUNTS:
    "Accounts",

  HR:
    "HR",

  ADMISSIONS:
    "Admissions",

  EXAMINATION:
    "Examination",

  LIBRARIAN:
    "Librarian",

  PLACEMENT:
    "Placement",

  IT:
    "IT",

  CMS:
    "CMS",

  PARENT:
    "Parent",

  STUDENT:
    "Student",
};

const NAVIGATION: NavigationItem[] = [
  {
    label:
      "Overview",
    href:
      "/superadmin",
    icon:
      "⌂",
    roles: [
      "SUPER_ADMIN",
    ],
    group:
      "Platform",
  },

  {
    label:
      "Institutions",
    href:
      "/superadmin/institutions",
    icon:
      "▦",
    roles: [
      "SUPER_ADMIN",
    ],
    permissions: [
      "institutions.manage",
    ],
    group:
      "Platform",
  },

  {
    label:
      "Platform users",
    href:
      "/superadmin/users",
    icon:
      "♙",
    roles: [
      "SUPER_ADMIN",
    ],
    permissions: [
      "users.read",
    ],
    group:
      "Platform",
  },

  {
    label:
      "Audit",
    href:
      "/superadmin/audit",
    icon:
      "▤",
    roles: [
      "SUPER_ADMIN",
    ],
    permissions: [
      "audit.read",
    ],
    group:
      "Platform",
  },

  /*
   * INSTITUTION ADMIN
   *
   * There is intentionally NO /erp entry here.
   */
  {
    label:
      "Overview",
    href:
      "/admin",
    icon:
      "⌂",
    roles: [
      "INSTITUTION_ADMIN",
    ],
    group:
      "Administration",
  },

  {
    label:
      "People & access",
    href:
      "/user-management",
    icon:
      "♙",
    roles: [
      "INSTITUTION_ADMIN",
    ],
    permissions: [
      "users.read",
    ],
    group:
      "Administration",
  },

  {
    label:
      "Academic structure",
    href:
      "/admin",
    icon:
      "▦",
    roles: [
      "INSTITUTION_ADMIN",
    ],
    permissions: [
      "departments.read",
    ],
    group:
      "Administration",
  },

  {
    label:
      "Campuses",
    href:
      "/admin",
    icon:
      "⌂",
    roles: [
      "INSTITUTION_ADMIN",
    ],
    permissions: [
      "campuses.read",
    ],
    group:
      "Administration",
  },

  {
    label:
      "Timetable",
    href:
      "/timetable",
    icon:
      "◷",
    roles: [
      "INSTITUTION_ADMIN",
    ],
    permissions: [
      "timetable.read",
    ],
    group:
      "Operations",
  },

  {
    label:
      "Notices",
    href:
      "/notices",
    icon:
      "◌",
    roles: [
      "INSTITUTION_ADMIN",
    ],
    permissions: [
      "notices.read",
    ],
    group:
      "Operations",
  },

  {
    label:
      "Admissions",
    href:
      "/admissions",
    icon:
      "↗",
    roles: [
      "INSTITUTION_ADMIN",
    ],
    permissions: [
      "admissions.read",
    ],
    group:
      "Operations",
  },

  {
    label:
      "Reports",
    href:
      "/reports",
    icon:
      "▤",
    roles: [
      "INSTITUTION_ADMIN",
    ],
    permissions: [
      "reports.read",
    ],
    group:
      "Insights",
  },

  {
    label:
      "Intelligence",
    href:
      "/intelligence",
    icon:
      "✦",
    roles: [
      "INSTITUTION_ADMIN",
    ],
    permissions: [
      "intelligence.read",
    ],
    group:
      "Insights",
  },

  {
    label:
      "Notifications",
    href:
      "/notifications",
    icon:
      "◉",
    roles: [
      "INSTITUTION_ADMIN",
    ],
    permissions: [
      "notifications.read",
    ],
    group:
      "Operations",
  },

  {
    label:
      "Calendar",
    href:
      "/calendar",
    icon:
      "◫",
    roles: [
      "INSTITUTION_ADMIN",
    ],
    permissions: [
      "calendar.read",
    ],
    group:
      "Operations",
  },

  {
    label:
      "Course registration",
    href:
      "/course-registration",
    icon:
      "✓",
    roles: [
      "INSTITUTION_ADMIN",
    ],
    permissions: [
      "registration.read",
    ],
    group:
      "Academic",
  },

  {
    label:
      "Student promotions",
    href:
      "/student-promotion",
    icon:
      "↑",
    roles: [
      "INSTITUTION_ADMIN",
    ],
    permissions: [
      "promotions.read",
    ],
    group:
      "Academic",
  },

  {
    label:
      "Certificates",
    href:
      "/certificates",
    icon:
      "▣",
    roles: [
      "INSTITUTION_ADMIN",
    ],
    permissions: [
      "certificates.read",
    ],
    group:
      "Academic",
  },

  {
    label:
      "Operations",
    href:
      "/operations",
    icon:
      "⚙",
    roles: [
      "INSTITUTION_ADMIN",
    ],
    permissions: [
      "operations.read",
    ],
    group:
      "Operations",
  },

  {
    label:
      "Account security",
    href:
      "/account-security",
    icon:
      "◉",
    roles: [
      "INSTITUTION_ADMIN",
    ],
    group:
      "Account",
  },

  {
    label:
      "Overview",
    href:
      "/chairman",
    icon:
      "⌂",
    roles: [
      "CHAIRMAN",
    ],
    group:
      "Workspace",
  },

  {
    label:
      "Intelligence",
    href:
      "/intelligence",
    icon:
      "✦",
    roles: [
      "CHAIRMAN",
      "DIRECTOR",
      "DEAN",
    ],
    permissions: [
      "intelligence.read",
    ],
    group:
      "Insights",
  },

  {
    label:
      "Reports",
    href:
      "/reports",
    icon:
      "▤",
    roles: [
      "CHAIRMAN",
      "DIRECTOR",
      "DEAN",
      "REGISTRAR",
    ],
    permissions: [
      "reports.read",
    ],
    group:
      "Insights",
  },

  {
    label:
      "ERP",
    href:
      "/erp",
    icon:
      "▦",
    roles: [
      "CHAIRMAN",
      "DIRECTOR",
      "DEAN",
      "REGISTRAR",
      "HOD",
      "ACCOUNTS",
      "HR",
      "ADMISSIONS",
      "EXAMINATION",
      "LIBRARIAN",
      "IT",
    ],
    group:
      "Workspace",
  },

  {
    label:
      "Overview",
    href:
      "/management",
    icon:
      "⌂",
    roles: [
      "DIRECTOR",
    ],
    group:
      "Workspace",
  },

  {
    label:
      "Overview",
    href:
      "/dean",
    icon:
      "⌂",
    roles: [
      "DEAN",
    ],
    group:
      "Workspace",
  },

  {
    label:
      "Overview",
    href:
      "/registrar",
    icon:
      "⌂",
    roles: [
      "REGISTRAR",
    ],
    group:
      "Workspace",
  },

  {
    label:
      "Overview",
    href:
      "/hod",
    icon:
      "⌂",
    roles: [
      "HOD",
    ],
    group:
      "Workspace",
  },

  {
    label:
      "Overview",
    href:
      "/faculty",
    icon:
      "⌂",
    roles: [
      "FACULTY",
    ],
    group:
      "Workspace",
  },

  {
    label:
      "Assignments",
    href:
      "/faculty/assignments",
    icon:
      "✓",
    roles: [
      "FACULTY",
    ],
    permissions: [
      "assignments.read",
    ],
    group:
      "Teaching",
  },

  {
    label:
      "Accounts",
    href:
      "/accounts",
    icon:
      "₹",
    roles: [
      "ACCOUNTS",
    ],
    group:
      "Workspace",
  },

  {
    label:
      "HR",
    href:
      "/hr",
    icon:
      "♙",
    roles: [
      "HR",
    ],
    group:
      "Workspace",
  },

  {
    label:
      "Admissions",
    href:
      "/admissions",
    icon:
      "↗",
    roles: [
      "ADMISSIONS",
    ],
    group:
      "Workspace",
  },

  {
    label:
      "Examinations",
    href:
      "/examinations",
    icon:
      "◉",
    roles: [
      "EXAMINATION",
    ],
    group:
      "Workspace",
  },

  {
    label:
      "Library",
    href:
      "/library",
    icon:
      "▤",
    roles: [
      "LIBRARIAN",
    ],
    group:
      "Workspace",
  },

  {
    label:
      "Placements",
    href:
      "/placements",
    icon:
      "↗",
    roles: [
      "PLACEMENT",
    ],
    group:
      "Workspace",
  },

  {
    label:
      "IT Operations",
    href:
      "/it",
    icon:
      "⌘",
    roles: [
      "IT",
    ],
    group:
      "Workspace",
  },

  {
    label:
      "Website CMS",
    href:
      "/site-content",
    icon:
      "◫",
    roles: [
      "CMS",
    ],
    permissions: [
      "site.manage",
    ],
    group:
      "Workspace",
  },

  {
    label:
      "Overview",
    href:
      "/student",
    icon:
      "⌂",
    roles: [
      "STUDENT",
    ],
    group:
      "Workspace",
  },

  {
    label:
      "Attendance",
    href:
      "/student/attendance",
    icon:
      "◷",
    roles: [
      "STUDENT",
    ],
    permissions: [
      "attendance.read",
    ],
    group:
      "Academics",
  },

  {
    label:
      "Assignments",
    href:
      "/student/assignments",
    icon:
      "✓",
    roles: [
      "STUDENT",
    ],
    permissions: [
      "assignments.read",
    ],
    group:
      "Academics",
  },

  {
    label:
      "Marks",
    href:
      "/student/marks",
    icon:
      "◈",
    roles: [
      "STUDENT",
    ],
    permissions: [
      "marks.read",
    ],
    group:
      "Academics",
  },

  {
    label:
      "Results",
    href:
      "/student/results",
    icon:
      "★",
    roles: [
      "STUDENT",
    ],
    permissions: [
      "marks.read",
    ],
    group:
      "Academics",
  },

  {
    label:
      "Examinations",
    href:
      "/student/examinations",
    icon:
      "◉",
    roles: [
      "STUDENT",
    ],
    permissions: [
      "marks.read",
    ],
    group:
      "Academics",
  },

  {
    label:
      "Fees",
    href:
      "/student/fees",
    icon:
      "₹",
    roles: [
      "STUDENT",
    ],
    group:
      "Services",
  },

  {
    label:
      "Profile",
    href:
      "/student/profile",
    icon:
      "◍",
    roles: [
      "STUDENT",
    ],
    group:
      "Account",
  },

  {
    label:
      "Overview",
    href:
      "/parent",
    icon:
      "⌂",
    roles: [
      "PARENT",
    ],
    group:
      "Workspace",
  },

  {
    label:
      "Children",
    href:
      "/parent/children",
    icon:
      "♧",
    roles: [
      "PARENT",
    ],
    group:
      "Workspace",
  },

  {
    label:
      "Profile",
    href:
      "/parent/profile",
    icon:
      "◍",
    roles: [
      "PARENT",
    ],
    group:
      "Account",
  },
];

export function primaryRole(
  roles: readonly string[]
): string {
  return (
    ROLE_PRIORITY.find(
      (
        role
      ) =>
        roles.includes(
          role
        )
    ) ||
    roles[0] ||
    ""
  );
}

export function workspaceHome(
  roles: readonly string[]
): string {
  const role =
    primaryRole(
      roles
    );

  return (
    {
      SUPER_ADMIN:
        "/superadmin",

      INSTITUTION_ADMIN:
        "/admin",

      CHAIRMAN:
        "/chairman",

      DIRECTOR:
        "/management",

      DEAN:
        "/dean",

      REGISTRAR:
        "/registrar",

      HOD:
        "/hod",

      FACULTY:
        "/faculty",

      ACCOUNTS:
        "/accounts",

      HR:
        "/hr",

      ADMISSIONS:
        "/admissions",

      EXAMINATION:
        "/examinations",

      LIBRARIAN:
        "/library",

      PLACEMENT:
        "/placements",

      IT:
        "/it",

      CMS:
        "/site-content",

      STUDENT:
        "/student",

      PARENT:
        "/parent",
    } as Record<
      string,
      string
    >
  )[role] || "/login";
}

export function canUseNavigationItem(
  user: AuthUser,
  item: NavigationItem
): boolean {
  if (
    !item.roles.some(
      (
        role
      ) =>
        user.roles.includes(
          role
        )
    )
  ) {
    return false;
  }

  return (
    !item.permissions ||
    item.permissions.every(
      (
        permission
      ) =>
        user.permissions.includes(
          permission
        )
    )
  );
}

export function navigationForUser(
  user: AuthUser
): NavigationItem[] {
  const seen =
    new Set<string>();

  return NAVIGATION
    .filter(
      (
        item
      ) =>
        canUseNavigationItem(
          user,
          item
        )
    )
    .filter(
      (
        item
      ) => {
        if (
          seen.has(
            item.href
          )
        ) {
          return false;
        }

        seen.add(
          item.href
        );

        return true;
      }
    );
}

export function navigationGroups(
  items: NavigationItem[]
) {
  const groups =
    new Map<
      string,
      NavigationItem[]
    >();

  for (
    const item of items
  ) {
    const group =
      item.group ||
      "Workspace";

    groups.set(
      group,
      [
        ...(groups.get(
          group
        ) || []),
        item,
      ]
    );
  }

  return [
    ...groups.entries(),
  ].map(
    ([
      label,
      groupedItems,
    ]) => ({
      label,
      items:
        groupedItems,
    })
  );
}

export function activeNavigationHref(
  pathname: string,
  items: NavigationItem[]
): string | null {
  return items
    .filter(
      (
        item
      ) =>
        pathname ===
          item.href ||
        (
          item.href !==
            "/" &&
          pathname.startsWith(
            `${item.href}/`
          )
        )
    )
    .sort(
      (
        left,
        right
      ) =>
        right.href.length -
        left.href.length
    )[0]?.href || null;
}

export function canAccessWorkspace(
  user: AuthUser,
  allowedRoles?:
    readonly string[]
): boolean {
  return (
    !allowedRoles?.length ||
    allowedRoles.some(
      (
        role
      ) =>
        user.roles.includes(
          role
        )
    )
  );
}

export function canAccessRoute(
  user: AuthUser,
  pathname: string,
  allowedRoles?:
    readonly string[]
): boolean {
  if (
    !canAccessWorkspace(
      user,
      allowedRoles
    )
  ) {
    return false;
  }

  if (
    user.roles.includes(
      "INSTITUTION_ADMIN"
    ) &&
    !user.roles.includes(
      "SUPER_ADMIN"
    )
  ) {
    const directWorkspace =
      navigationForUser(
        user
      ).some(
        (
          item
        ) =>
          pathname ===
            item.href ||
          pathname.startsWith(
            `${item.href}/`
          )
      );

    const adminRoutes = [
      "/admin",
      "/user-management",
      "/account-security",
      "/timetable",
      "/notices",
      "/admissions",
      "/reports",
      "/intelligence",
      "/notifications",
      "/calendar",
      "/course-registration",
      "/student-promotion",
      "/certificates",
      "/operations",
    ];

    if (
      !adminRoutes.some(
        (
          route
        ) =>
          pathname ===
            route ||
          pathname.startsWith(
            `${route}/`
          )
      ) &&
      !directWorkspace
    ) {
      return false;
    }
  }

  const namespaceOwners:
    Array<
      [string, string[]]
    > = [
      [
        "/student",
        ["STUDENT"],
      ],

      [
        "/faculty",
        ["FACULTY"],
      ],

      [
        "/parent",
        ["PARENT"],
      ],

      [
        "/management",
        [
          "DIRECTOR",
          "CHAIRMAN",
        ],
      ],

      [
        "/dean",
        ["DEAN"],
      ],

      [
        "/registrar",
        ["REGISTRAR"],
      ],

      [
        "/hod",
        ["HOD"],
      ],

      [
        "/admin",
        [
          "INSTITUTION_ADMIN",
        ],
      ],

      [
        "/superadmin",
        ["SUPER_ADMIN"],
      ],
    ];

  const owner =
    namespaceOwners.find(
      (
        [
          prefix,
        ]
      ) =>
        pathname ===
          prefix ||
        pathname.startsWith(
          `${prefix}/`
        )
    );

  return (
    !owner ||
    owner[1].some(
      (
        role
      ) =>
        user.roles.includes(
          role
        )
    )
  );
}
