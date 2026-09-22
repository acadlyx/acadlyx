import type { CanonicalRole } from "@/lib/authorization";

export interface NavigationItem {
  label: string;
  description: string;
  href: string;
  icon: string;
  permissions?: string[];
}

export interface NavigationGroup {
  label: string;
  items: NavigationItem[];
}

export interface WorkspaceMeta {
  label: string;
  title: string;
  subtitle: string;
  eyebrow: string;
  home: string;
}

export const ROLE_PRIORITY: CanonicalRole[] = [
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
];

export const WORKSPACE_META: Record<CanonicalRole, WorkspaceMeta> = {
  SUPER_ADMIN: {
    label: "Super Admin",
    title: "Platform Workspace",
    subtitle: "Institutions, platform administration and security",
    eyebrow: "Platform administration",
    home: "/superadmin",
  },

  INSTITUTION_ADMIN: {
    label: "Institution Admin",
    title: "Institution Workspace",
    subtitle: "Institution setup, users and academic administration",
    eyebrow: "Institution administration",
    home: "/admin",
  },

  CHAIRMAN: {
    label: "Chairman / Management",
    title: "Management Workspace",
    subtitle: "Institution-wide oversight and strategic visibility",
    eyebrow: "Management oversight",
    home: "/chairman",
  },

  DIRECTOR: {
    label: "Director",
    title: "Director Workspace",
    subtitle: "Institution-wide academic and operational oversight",
    eyebrow: "Institution leadership",
    home: "/director",
  },

  DEAN: {
    label: "Dean",
    title: "Dean Workspace",
    subtitle: "School-level academic leadership and performance",
    eyebrow: "Academic leadership",
    home: "/dean",
  },

  REGISTRAR: {
    label: "Registrar",
    title: "Registrar Workspace",
    subtitle: "Official student and academic lifecycle management",
    eyebrow: "Student lifecycle",
    home: "/registrar",
  },

  HOD: {
    label: "HOD",
    title: "Department Workspace",
    subtitle: "Department operations, faculty and academic review",
    eyebrow: "Department leadership",
    home: "/hod",
  },

  FACULTY: {
    label: "Faculty",
    title: "Faculty Workspace",
    subtitle: "Your assigned classes, attendance and assessment work",
    eyebrow: "Teaching workspace",
    home: "/faculty",
  },

  ACCOUNTS: {
    label: "Accounts",
    title: "Finance Workspace",
    subtitle: "Fees, invoices, collections and financial operations",
    eyebrow: "Finance operations",
    home: "/accounts",
  },

  HR: {
    label: "HR",
    title: "People Workspace",
    subtitle: "Employees, leave and people administration",
    eyebrow: "People operations",
    home: "/hr",
  },

  ADMISSIONS: {
    label: "Admissions",
    title: "Admissions Workspace",
    subtitle: "Enquiries, applications, verification and admission",
    eyebrow: "Admissions operations",
    home: "/admissions",
  },

  EXAMINATION: {
    label: "Examination Cell",
    title: "Examination Workspace",
    subtitle: "Examination scheduling, marks and result publication",
    eyebrow: "Examination operations",
    home: "/examinations",
  },

  LIBRARIAN: {
    label: "Librarian",
    title: "Library Workspace",
    subtitle: "Catalogue, circulation, reservations and fines",
    eyebrow: "Library operations",
    home: "/library",
  },

  PLACEMENT: {
    label: "Placement",
    title: "Placement Workspace",
    subtitle: "Companies, drives, eligibility and placements",
    eyebrow: "Placement operations",
    home: "/placements",
  },

  IT: {
    label: "IT",
    title: "IT Workspace",
    subtitle: "Technical operations, integrations and platform support",
    eyebrow: "Technology operations",
    home: "/it",
  },

  CMS: {
    label: "CMS",
    title: "Website Workspace",
    subtitle: "Public website content and publishing",
    eyebrow: "Website management",
    home: "/site-content",
  },

  STUDENT: {
    label: "Student",
    title: "Student Workspace",
    subtitle: "Your classes, progress, services and academic actions",
    eyebrow: "Student self-service",
    home: "/student",
  },

  PARENT: {
    label: "Parent",
    title: "Parent Workspace",
    subtitle: "Your linked children, academic progress and communication",
    eyebrow: "Family self-service",
    home: "/parent",
  },

  CLUB_PRESIDENT: {
    label: "Club President",
    title: "Club Workspace",
    subtitle: "Activities and events for your assigned student club",
    eyebrow: "Student club responsibility",
    home: "/club-president",
  },
};

const item = (
  label: string,
  description: string,
  href: string,
  icon: string,
  permissions?: string[],
): NavigationItem => ({
  label,
  description,
  href,
  icon,
  permissions,
});

export const ROLE_NAVIGATION: Record<CanonicalRole, NavigationGroup[]> = {
  SUPER_ADMIN: [
    {
      label: "Workspace",
      items: [
        item(
          "Overview",
          "Platform status and administration",
          "/superadmin",
          "⌂",
        ),
      ],
    },
    {
      label: "Platform",
      items: [
        item(
          "Platform administration",
          "Institutions and designated administrators",
          "/superadmin",
          "◆",
        ),
        item(
          "Account security",
          "Protect your account and sign-in",
          "/account-security",
          "◉",
        ),
      ],
    },
  ],

  INSTITUTION_ADMIN: [
    {
      label: "Workspace",
      items: [
        item(
          "Overview",
          "Your institution at a glance",
          "/admin",
          "⌂",
        ),
      ],
    },
    {
      label: "Administration",
      items: [
        item(
          "People & users",
          "Manage institution users and responsibilities",
          "/admin",
          "♙",
          ["users.read"],
        ),
        item(
          "Institution settings",
          "Institution profile and configuration",
          "/institution-settings",
          "⚙",
          ["institutions.manage"],
        ),
        item(
          "Academic setup",
          "Programs, departments and academic masters",
          "/erp?tab=overview",
          "▦",
          ["academic-masters.read"],
        ),
      ],
    },
    {
      label: "Account",
      items: [
        item(
          "Account security",
          "Protect your account and sign-in",
          "/account-security",
          "◉",
        ),
      ],
    },
  ],

  CHAIRMAN: [
    {
      label: "Workspace",
      items: [
        item(
          "Overview",
          "Institutional performance at a glance",
          "/chairman",
          "⌂",
        ),
      ],
    },
    {
      label: "Oversight",
      items: [
        item(
          "Intelligence",
          "Institutional trends and performance",
          "/intelligence",
          "◈",
        ),
        item(
          "Reports",
          "Leadership reporting and analysis",
          "/reports",
          "▤",
        ),
        item(
          "Calendar",
          "Institution-wide dates and events",
          "/calendar",
          "◷",
          ["calendar.read"],
        ),
      ],
    },
    {
      label: "Account",
      items: [
        item(
          "Account security",
          "Protect your account and sign-in",
          "/account-security",
          "◉",
        ),
      ],
    },
  ],

  DIRECTOR: [
    {
      label: "Workspace",
      items: [
        item(
          "Overview",
          "Institution-wide operational view",
          "/director",
          "⌂",
        ),
      ],
    },
    {
      label: "Oversight",
      items: [
        item(
          "Intelligence",
          "Institutional trends and performance",
          "/intelligence",
          "◈",
        ),
        item(
          "Admissions",
          "Admissions activity and pipeline",
          "/admissions",
          "♙",
          ["admissions.read"],
        ),
        item(
          "Examinations",
          "Examination oversight",
          "/examinations",
          "✍",
          ["exams.read"],
        ),
        item(
          "Reports",
          "Institutional reports",
          "/reports",
          "▤",
        ),
        item(
          "Calendar",
          "Institution-wide dates and events",
          "/calendar",
          "◷",
          ["calendar.read"],
        ),
      ],
    },
    {
      label: "Account",
      items: [
        item(
          "Account security",
          "Protect your account and sign-in",
          "/account-security",
          "◉",
        ),
      ],
    },
  ],

  DEAN: [
    {
      label: "Workspace",
      items: [
        item(
          "Overview",
          "School-level performance and academics",
          "/dean",
          "⌂",
        ),
      ],
    },
    {
      label: "Academic leadership",
      items: [
        item(
          "Intelligence",
          "School-level academic trends",
          "/intelligence",
          "◈",
        ),
        item(
          "Examinations",
          "Examination review",
          "/examinations",
          "✍",
          ["exams.read"],
        ),
        item(
          "Results",
          "Academic results",
          "/results",
          "◉",
          ["results.read"],
        ),
        item(
          "Calendar",
          "Academic calendar",
          "/calendar",
          "◷",
          ["calendar.read"],
        ),
      ],
    },
    {
      label: "Account",
      items: [
        item(
          "Account security",
          "Protect your account and sign-in",
          "/account-security",
          "◉",
        ),
      ],
    },
  ],

  REGISTRAR: [
    {
      label: "Workspace",
      items: [
        item(
          "Overview",
          "Student lifecycle and official records",
          "/registrar",
          "⌂",
        ),
      ],
    },
    {
      label: "Student lifecycle",
      items: [
        item(
          "Students",
          "Official student master records",
          "/students",
          "♙",
          ["students.read"],
        ),
        item(
          "Enrollment",
          "Registration and enrollment lifecycle",
          "/enrollment",
          "⊞",
          ["registration.read"],
        ),
        item(
          "Course registration",
          "Institutional registration workflow",
          "/course-registration",
          "▦",
          ["registration.read"],
        ),
        item(
          "Promotion",
          "Student progression and promotion",
          "/student-promotion",
          "↗",
          ["promotion.manage"],
        ),
        item(
          "Certificates",
          "Official student certificates",
          "/certificates",
          "❖",
          ["certificates.read"],
        ),
      ],
    },
    {
      label: "Account",
      items: [
        item(
          "Account security",
          "Protect your account and sign-in",
          "/account-security",
          "◉",
        ),
      ],
    },
  ],

  HOD: [
    {
      label: "Workspace",
      items: [
        item(
          "Overview",
          "Department performance and workload",
          "/hod",
          "⌂",
        ),
      ],
    },
    {
      label: "Department",
      items: [
        item(
          "Academic operations",
          "Department academic setup",
          "/erp",
          "▦",
          ["academic-masters.read"],
        ),
        item(
          "Examinations",
          "Department examination review",
          "/examinations",
          "✍",
          ["exams.read"],
        ),
        item(
          "Promotion",
          "Department student progression",
          "/student-promotion",
          "↗",
          ["promotion.manage"],
        ),
        item(
          "Intelligence",
          "Department performance insights",
          "/intelligence",
          "◈",
        ),
        item(
          "Calendar",
          "Department academic dates",
          "/calendar",
          "◷",
          ["calendar.read"],
        ),
      ],
    },
    {
      label: "Account",
      items: [
        item(
          "Account security",
          "Protect your account and sign-in",
          "/account-security",
          "◉",
        ),
      ],
    },
  ],

  FACULTY: [
    {
      label: "Workspace",
      items: [
        item(
          "Overview",
          "Your assigned teaching workload",
          "/faculty",
          "⌂",
        ),
      ],
    },
    {
      label: "Teaching",
      items: [
        item(
          "Attendance",
          "Take and review attendance",
          "/faculty/attendance",
          "◷",
          ["attendance.read"],
        ),
        item(
          "Assignments",
          "Manage your assigned coursework",
          "/faculty/assignments",
          "✓",
          ["assignments.read"],
        ),
        item(
          "Marks",
          "Enter and review assessment marks",
          "/faculty/marks",
          "◈",
          ["marks.read"],
        ),
        item(
          "Examinations",
          "Your examination responsibilities",
          "/examinations",
          "✍",
          ["exams.read"],
        ),
        item(
          "Calendar",
          "Your academic schedule",
          "/calendar",
          "◷",
          ["calendar.read"],
        ),
        item(
          "Leave",
          "Your own leave requests",
          "/leave-management",
          "◌",
          ["leave.read"],
        ),
      ],
    },
    {
      label: "Account",
      items: [
        item(
          "Account security",
          "Protect your account and sign-in",
          "/account-security",
          "◉",
        ),
      ],
    },
  ],

  ACCOUNTS: [
    {
      label: "Workspace",
      items: [
        item(
          "Overview",
          "Financial operations at a glance",
          "/accounts",
          "⌂",
        ),
      ],
    },
    {
      label: "Finance",
      items: [
        item(
          "Fees & collections",
          "Invoices, collections and receipts",
          "/fees",
          "₹",
          ["fees.read"],
        ),
        item(
          "ERP finance",
          "Fee structures and financial configuration",
          "/erp?tab=fees",
          "▦",
          ["fees.manage"],
        ),
        item(
          "Reports",
          "Financial reports and analysis",
          "/reports",
          "▤",
          ["reports.read"],
        ),
      ],
    },
    {
      label: "Account",
      items: [
        item(
          "Account security",
          "Protect your account and sign-in",
          "/account-security",
          "◉",
        ),
      ],
    },
  ],

  HR: [
    {
      label: "Workspace",
      items: [
        item(
          "Overview",
          "People operations at a glance",
          "/hr",
          "⌂",
        ),
      ],
    },
    {
      label: "People",
      items: [
        item(
          "Employees",
          "Employee lifecycle and records",
          "/hr/employees",
          "♙",
          ["employees.read"],
        ),
        item(
          "Leave",
          "Leave administration and approvals",
          "/leave-management",
          "◌",
          ["leave.read"],
        ),
        item(
          "Calendar",
          "People and institutional dates",
          "/calendar",
          "◷",
          ["calendar.read"],
        ),
      ],
    },
    {
      label: "Account",
      items: [
        item(
          "Account security",
          "Protect your account and sign-in",
          "/account-security",
          "◉",
        ),
      ],
    },
  ],

  ADMISSIONS: [
    {
      label: "Workspace",
      items: [
        item(
          "Overview",
          "Admissions pipeline at a glance",
          "/admissions",
          "⌂",
        ),
      ],
    },
    {
      label: "Admissions",
      items: [
        item(
          "Applications",
          "Enquiries, applications and verification",
          "/applications",
          "♙",
          ["admissions.read"],
        ),
        item(
          "Admissions operations",
          "Selection and admission workflow",
          "/admissions",
          "⊞",
          ["admissions.manage"],
        ),
      ],
    },
    {
      label: "Account",
      items: [
        item(
          "Account security",
          "Protect your account and sign-in",
          "/account-security",
          "◉",
        ),
      ],
    },
  ],

  EXAMINATION: [
    {
      label: "Workspace",
      items: [
        item(
          "Overview",
          "Examination operations at a glance",
          "/examinations",
          "⌂",
        ),
      ],
    },
    {
      label: "Examinations",
      items: [
        item(
          "Examinations",
          "Sessions, schedules and result workflow",
          "/examinations",
          "✍",
          ["exams.read"],
        ),
        item(
          "Results",
          "Published and controlled academic results",
          "/results",
          "◉",
          ["results.read"],
        ),
        item(
          "Calendar",
          "Examination dates and events",
          "/calendar",
          "◷",
          ["calendar.read"],
        ),
      ],
    },
    {
      label: "Account",
      items: [
        item(
          "Account security",
          "Protect your account and sign-in",
          "/account-security",
          "◉",
        ),
      ],
    },
  ],

  LIBRARIAN: [
    {
      label: "Workspace",
      items: [
        item(
          "Overview",
          "Library operations at a glance",
          "/library",
          "⌂",
        ),
      ],
    },
    {
      label: "Library",
      items: [
        item(
          "Catalogue & circulation",
          "Books, loans, reservations and fines",
          "/library",
          "❏",
          ["library.read"],
        ),
        item(
          "Calendar",
          "Library and institutional dates",
          "/calendar",
          "◷",
          ["calendar.read"],
        ),
      ],
    },
    {
      label: "Account",
      items: [
        item(
          "Account security",
          "Protect your account and sign-in",
          "/account-security",
          "◉",
        ),
      ],
    },
  ],

  PLACEMENT: [
    {
      label: "Workspace",
      items: [
        item(
          "Overview",
          "Placement operations at a glance",
          "/placements",
          "⌂",
        ),
      ],
    },
    {
      label: "Placement",
      items: [
        item(
          "Placement operations",
          "Companies, drives and applications",
          "/placements",
          "♙",
          ["placement.read"],
        ),
        item(
          "Intelligence",
          "Placement performance and insights",
          "/intelligence",
          "◈",
        ),
      ],
    },
    {
      label: "Account",
      items: [
        item(
          "Account security",
          "Protect your account and sign-in",
          "/account-security",
          "◉",
        ),
      ],
    },
  ],

  IT: [
    {
      label: "Workspace",
      items: [
        item(
          "Overview",
          "Technology operations at a glance",
          "/it",
          "⌂",
        ),
      ],
    },
    {
      label: "Technology",
      items: [
        item(
          "Operations",
          "Technical administration and support",
          "/operations",
          "⚙",
          ["operations.read"],
        ),
      ],
    },
    {
      label: "Account",
      items: [
        item(
          "Account security",
          "Protect your account and sign-in",
          "/account-security",
          "◉",
        ),
      ],
    },
  ],

  CMS: [
    {
      label: "Workspace",
      items: [
        item(
          "Website CMS",
          "Manage public website content",
          "/site-content",
          "◆",
        ),
      ],
    },
    {
      label: "Account",
      items: [
        item(
          "Account security",
          "Protect your account and sign-in",
          "/account-security",
          "◉",
        ),
      ],
    },
  ],

  STUDENT: [
    {
      label: "My workspace",
      items: [
        item(
          "Overview",
          "Your academic day at a glance",
          "/student",
          "⌂",
        ),
      ],
    },

    {
      label: "Academics",
      items: [
        item(
          "Timetable",
          "Your enrolled classes",
          "/student/timetable",
          "▦",
          ["timetable.read"],
        ),
        item(
          "Attendance",
          "Your attendance record",
          "/student/attendance",
          "◷",
          ["attendance.read"],
        ),
        item(
          "Assignments",
          "Your assigned work",
          "/student/assignments",
          "✓",
          ["assignments.read"],
        ),
        item(
          "Marks",
          "Your assessment marks",
          "/student/marks",
          "◈",
          ["marks.read"],
        ),
        item(
          "Results",
          "Your published academic results",
          "/student/results",
          "◉",
          ["results.read"],
        ),
        item(
          "Examinations",
          "Your examination information",
          "/student/examinations",
          "✍",
          ["exams.read"],
        ),
      ],
    },

    {
      label: "Student services",
      items: [
        item(
          "Fees",
          "Your invoices and payments",
          "/student/fees",
          "₹",
          ["fees.read", "fees.pay"],
        ),
        item(
          "Course registration",
          "Register for available courses",
          "/student/course-registration",
          "⊞",
          ["registration.read", "registration.manage"],
        ),
        item(
          "Library",
          "Borrowing and library services",
          "/student/library",
          "❏",
          ["library.read", "library.borrow"],
        ),
        item(
          "Certificates",
          "Your certificate requests",
          "/student/certificates",
          "❖",
          ["certificates.read"],
        ),
        item(
          "Leave",
          "Your leave requests and status",
          "/student/leave",
          "◌",
          ["leave.read", "leave.manage"],
        ),
      ],
    },

    {
      label: "Account",
      items: [
        item(
          "Account security",
          "Protect your account and sign-in",
          "/account-security",
          "◉",
        ),
      ],
    },
  ],

  PARENT: [
    {
      label: "My workspace",
      items: [
        item(
          "Overview",
          "Your linked children at a glance",
          "/parent",
          "⌂",
        ),
      ],
    },
    {
      label: "Family",
      items: [
        item(
          "Children",
          "View your linked children",
          "/parent/children",
          "♙",
          ["parent-links.read"],
        ),
        item(
          "Calendar",
          "Relevant academic dates",
          "/calendar",
          "◷",
          ["calendar.read"],
        ),
      ],
    },
    {
      label: "Account",
      items: [
        item(
          "Account security",
          "Protect your account and sign-in",
          "/account-security",
          "◉",
        ),
      ],
    },
  ],

  CLUB_PRESIDENT: [
    {
      label: "My workspace",
      items: [
        item(
          "Club workspace",
          "Manage your assigned club activities",
          "/club-president",
          "⌂",
          ["club.read", "club.manage"],
        ),
      ],
    },
    {
      label: "Club",
      items: [
        item(
          "Calendar",
          "Club and institutional events",
          "/calendar",
          "◷",
          ["calendar.read"],
        ),
      ],
    },
    {
      label: "Account",
      items: [
        item(
          "Account security",
          "Protect your account and sign-in",
          "/account-security",
          "◉",
        ),
      ],
    },
  ],
};

export function getPrimaryRole(roles: CanonicalRole[]): CanonicalRole {
  return (
    ROLE_PRIORITY.find((role) => roles.includes(role)) ??
    "STUDENT"
  );
}
