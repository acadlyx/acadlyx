import { normalizeRoles, type CanonicalRole } from "@/lib/authorization";

export type NavigationItem = {
  label: string;
  description: string;
  href: string;
  icon: string;
  permissions?: string[];
};

export type NavigationGroup = {
  label: string;
  items: NavigationItem[];
};

export type WorkspaceMeta = {
  label: string;
  title: string;
  subtitle: string;
  eyebrow: string;
  home: string;
};

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
    subtitle: "Institutions, platform security and designated administration",
    eyebrow: "Platform administration",
    home: "/superadmin",
  },
  INSTITUTION_ADMIN: {
    label: "Institution Admin",
    title: "Institution Workspace",
    subtitle: "Institution setup, people and academic administration",
    eyebrow: "Institution administration",
    home: "/admin",
  },
  CHAIRMAN: {
    label: "Chairman / Management",
    title: "Leadership Workspace",
    subtitle: "Institution-wide oversight, performance and strategic visibility",
    eyebrow: "Executive oversight",
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
    subtitle: "Official student lifecycle, registration and academic records",
    eyebrow: "Academic records",
    home: "/registrar",
  },
  HOD: {
    label: "Head of Department",
    title: "Department Workspace",
    subtitle: "Department operations, faculty, courses and student performance",
    eyebrow: "Department leadership",
    home: "/hod",
  },
  FACULTY: {
    label: "Faculty",
    title: "Teaching Workspace",
    subtitle: "Assigned classes, attendance, assessment and learner progress",
    eyebrow: "Teaching workspace",
    home: "/faculty",
  },
  ACCOUNTS: {
    label: "Accounts",
    title: "Finance Workspace",
    subtitle: "Fees, payments, receipts, billing and financial reporting",
    eyebrow: "Finance operations",
    home: "/accounts",
  },
  HR: {
    label: "HR",
    title: "People Workspace",
    subtitle: "Employee lifecycle, leave and people operations",
    eyebrow: "People operations",
    home: "/hr",
  },
  ADMISSIONS: {
    label: "Admissions",
    title: "Admissions Workspace",
    subtitle: "Applications, verification, selection and admission workflow",
    eyebrow: "Admissions operations",
    home: "/admissions",
  },
  EXAMINATION: {
    label: "Examination Cell",
    title: "Examination Workspace",
    subtitle: "Exam setup, eligibility, marks verification and results",
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
    subtitle: "Companies, drives, applications and placement outcomes",
    eyebrow: "Career operations",
    home: "/placements",
  },
  IT: {
    label: "IT",
    title: "Technology Workspace",
    subtitle: "Technical operations, support, integrations and security",
    eyebrow: "Technology operations",
    home: "/it",
  },
  CMS: {
    label: "CMS",
    title: "Website Workspace",
    subtitle: "Public website content, media and publishing",
    eyebrow: "Content management",
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
): NavigationItem => ({ label, description, href, icon, permissions });

export const ROLE_NAVIGATION: Record<CanonicalRole, NavigationGroup[]> = {
  SUPER_ADMIN: [
    {
      label: "Workspace",
      items: [item("Overview", "Platform status and administration", "/superadmin", "⌂")],
    },
    {
      label: "Platform",
      items: [
        item("Platform administration", "Institutions and designated administrators", "/superadmin", "◆"),
        item("Account security", "Protect your account and sign-in", "/account-security", "◉"),
      ],
    },
  ],
  INSTITUTION_ADMIN: [
    {
      label: "Workspace",
      items: [item("Overview", "Your institution at a glance", "/admin", "⌂")],
    },
    {
      label: "Administration",
      items: [
        item("People & users", "Manage institution users and responsibilities", "/admin", "♙", ["users.read"]),
        item("Institution settings", "Institution profile and configuration", "/institution-settings", "⚙", ["institutions.manage"]),
        item("Academic setup", "Programs, departments and academic masters", "/erp?tab=overview", "▦", ["academic-masters.read"]),
      ],
    },
    {
      label: "Account",
      items: [item("Account security", "Protect your account and sign-in", "/account-security", "◉")],
    },
  ],
  CHAIRMAN: [
    { label: "Workspace", items: [item("Overview", "Institutional performance at a glance", "/chairman", "⌂")] },
    {
      label: "Oversight",
      items: [
        item("Institution intelligence", "Performance and strategic indicators", "/intelligence", "✦", ["intelligence.read", "reports.read"]),
        item("Reports", "Authorized institutional reports", "/reports", "▤", ["reports.read"]),
        item("Academic calendar", "Key institutional dates", "/calendar", "◫", ["calendar.read"]),
      ],
    },
    { label: "Account", items: [item("Account security", "Protect your account and sign-in", "/account-security", "◉")] },
  ],
  DIRECTOR: [
    { label: "Workspace", items: [item("Overview", "Institution-wide priorities", "/director", "⌂")] },
    {
      label: "Oversight",
      items: [
        item("Institution intelligence", "Academic and operational performance", "/intelligence", "✦", ["intelligence.read", "reports.read"]),
        item("Admissions", "Admission pipeline and decisions", "/admissions", "✎", ["admissions.read"]),
        item("Examinations", "Institution examination status", "/examinations", "✍", ["exams.read"]),
        item("Reports", "Authorized institutional reports", "/reports", "▤", ["reports.read"]),
      ],
    },
    { label: "Account", items: [item("Account security", "Protect your account and sign-in", "/account-security", "◉")] },
  ],
  DEAN: [
    { label: "Workspace", items: [item("Overview", "Your school at a glance", "/dean", "⌂")] },
    {
      label: "Academic leadership",
      items: [
        item("Academic intelligence", "School-level performance", "/intelligence", "✦", ["intelligence.read", "reports.read"]),
        item("Examinations", "Examination information and status", "/examinations", "✍", ["exams.read", "results.read"]),
        item("Results", "Authorized result information", "/results", "◉", ["results.read"]),
        item("Academic calendar", "School and institution dates", "/calendar", "◫", ["calendar.read"]),
      ],
    },
    { label: "Account", items: [item("Account security", "Protect your account and sign-in", "/account-security", "◉")] },
  ],
  REGISTRAR: [
    { label: "Workspace", items: [item("Overview", "Official academic records at a glance", "/registrar", "⌂")] },
    {
      label: "Student lifecycle",
      items: [
        item("Enrollment", "Enrollment and official student records", "/enrollment", "♙", ["students.read", "students.manage", "registration.read", "registration.manage"]),
        item("Course registration", "Registration workflows", "/course-registration", "⊞", ["registration.read", "registration.manage"]),
        item("Student movement", "Promotion, transfer and movement", "/student-promotion", "⇗", ["promotions.read", "promotions.manage"]),
        item("Certificates", "Academic record and certificate requests", "/certificates", "❖", ["certificates.read", "certificates.manage"]),
      ],
    },
    { label: "Account", items: [item("Account security", "Protect your account and sign-in", "/account-security", "◉")] },
  ],
  HOD: [
    { label: "Workspace", items: [item("Overview", "Department priorities and performance", "/hod", "⌂")] },
    {
      label: "Department",
      items: [
        item("Academic operations", "Department courses and academic setup", "/erp", "▦", ["academic-masters.read", "timetable.read"]),
        item("Examinations", "Department examination workflows", "/examinations", "✍", ["exams.read", "marks.read", "results.read"]),
        item("Student movement", "Authorized promotion and transfer workflows", "/student-promotion", "⇗", ["promotions.read", "promotions.manage"]),
        item("Department intelligence", "Performance and risk indicators", "/intelligence", "✦", ["intelligence.read", "reports.read"]),
      ],
    },
    { label: "Account", items: [item("Account security", "Protect your account and sign-in", "/account-security", "◉")] },
  ],
  FACULTY: [
    { label: "Workspace", items: [item("Overview", "Today’s teaching work", "/faculty", "⌂")] },
    {
      label: "Teaching",
      items: [
        item("Attendance", "Mark and review assigned attendance", "/faculty/attendance", "◷", ["attendance.read", "attendance.manage"]),
        item("Assignments", "Create and review assigned work", "/faculty/assignments", "✓", ["assignments.read", "assignments.manage"]),
        item("Marks", "Enter and review assigned marks", "/faculty/marks", "◈", ["marks.read", "marks.manage"]),
        item("Examinations", "Your assigned examination work", "/examinations", "✍", ["exams.read"]),
      ],
    },
    {
      label: "Schedule",
      items: [item("Academic calendar", "Teaching and academic dates", "/calendar", "◫", ["calendar.read"]), item("Leave", "Your leave requests and status", "/leave-management", "◌", ["leave.read", "leave.manage"])],
    },
    { label: "Account", items: [item("Account security", "Protect your account and sign-in", "/account-security", "◉")] },
  ],
  ACCOUNTS: [
    { label: "Workspace", items: [item("Overview", "Financial activity at a glance", "/accounts", "⌂")] },
    {
      label: "Finance",
      items: [
        item("Fees & billing", "Collections, invoices and payments", "/fees", "₹", ["fees.read", "fees.manage", "fees.pay"]),
        item("Fee configuration", "Fee heads and authorized structures", "/erp?tab=fees", "▦", ["fees.manage"]),
        item("Financial reports", "Authorized financial reports", "/reports", "▤", ["reports.read"]),
      ],
    },
    { label: "Account", items: [item("Account security", "Protect your account and sign-in", "/account-security", "◉")] },
  ],
  HR: [
    { label: "Workspace", items: [item("Overview", "People operations at a glance", "/hr", "⌂")] },
    {
      label: "People",
      items: [
        item("Employees", "Employee lifecycle and records", "/hr", "♙", ["hr.read", "hr.manage"]),
        item("Leave management", "Process assigned leave workflows", "/leave-management", "◌", ["leave.read", "leave.manage"]),
        item("Academic calendar", "Institution dates relevant to HR", "/calendar", "◫", ["calendar.read"]),
      ],
    },
    { label: "Account", items: [item("Account security", "Protect your account and sign-in", "/account-security", "◉")] },
  ],
  ADMISSIONS: [
    { label: "Workspace", items: [item("Overview", "Admission pipeline at a glance", "/admissions", "⌂")] },
    {
      label: "Admissions",
      items: [
        item("Applications", "Review and process applications", "/applications", "✎", ["admissions.read", "admissions.manage"]),
        item("Admission workflow", "Verification, selection and onboarding", "/admissions", "♙", ["admissions.read", "admissions.manage"]),
      ],
    },
    { label: "Account", items: [item("Account security", "Protect your account and sign-in", "/account-security", "◉")] },
  ],
  EXAMINATION: [
    { label: "Workspace", items: [item("Overview", "Examination work at a glance", "/examinations", "⌂")] },
    {
      label: "Examinations",
      items: [
        item("Examination operations", "Schedules, eligibility and marks", "/examinations", "✍", ["exams.read", "exams.manage"]),
        item("Results", "Process and publish authorized results", "/results", "◉", ["results.read", "results.manage"]),
        item("Academic calendar", "Examination dates and events", "/calendar", "◫", ["calendar.read"]),
      ],
    },
    { label: "Account", items: [item("Account security", "Protect your account and sign-in", "/account-security", "◉")] },
  ],
  LIBRARIAN: [
    { label: "Workspace", items: [item("Overview", "Library activity at a glance", "/library", "⌂")] },
    {
      label: "Library",
      items: [
        item("Library operations", "Catalogue, circulation and fines", "/library", "❏", ["library.read", "library.manage", "library.borrow"]),
        item("Academic calendar", "Relevant institutional dates", "/calendar", "◫", ["calendar.read"]),
      ],
    },
    { label: "Account", items: [item("Account security", "Protect your account and sign-in", "/account-security", "◉")] },
  ],
  PLACEMENT: [
    { label: "Workspace", items: [item("Overview", "Placement activity at a glance", "/placements", "⌂")] },
    {
      label: "Placement",
      items: [
        item("Placement operations", "Companies, drives and applications", "/placements", "◈", ["placement.read", "placement.manage"]),
        item("Placement intelligence", "Authorized outcome analytics", "/intelligence", "✦", ["intelligence.read", "reports.read"]),
      ],
    },
    { label: "Account", items: [item("Account security", "Protect your account and sign-in", "/account-security", "◉")] },
  ],
  IT: [
    { label: "Workspace", items: [item("Overview", "Technical operations at a glance", "/it", "⌂")] },
    {
      label: "Technology",
      items: [
        item("Operations", "Support, maintenance and technical workflows", "/operations", "⚒", ["operations.read", "operations.manage", "maintenance.read", "maintenance.manage"]),
      ],
    },
    { label: "Account", items: [item("Account security", "Protect your account and sign-in", "/account-security", "◉")] },
  ],
  CMS: [
    { label: "Workspace", items: [item("Website content", "Manage public website content", "/site-content", "◫", ["site.manage"])] },
    { label: "Account", items: [item("Account security", "Protect your account and sign-in", "/account-security", "◉")] },
  ],
  STUDENT: [
    { label: "My workspace", items: [item("Overview", "Your academic day at a glance", "/student", "⌂")] },
    {
      label: "Academics",
      items: [
        item("Timetable", "Your enrolled classes", "/student/timetable", "▦", ["timetable.read"]),
        item("Attendance", "Your attendance record", "/student/attendance", "◷", ["attendance.read"]),
        item("Assignments", "Your assigned work", "/student/assignments", "✓", ["assignments.read"]),
        item("Marks", "Your assessment marks", "/student/marks", "◈", ["marks.read"]),
        item("Results", "Published academic results", "/results", "◉", ["results.read"]),
        item("Examinations", "Your examination information", "/examinations", "✍", ["exams.read"]),
      ],
    },
    {
      label: "Student services",
      items: [
        item("Fees", "Your invoices and payments", "/fees", "₹", ["fees.read", "fees.pay"]),
        item("Course registration", "Register for available courses", "/course-registration", "⊞", ["registration.read", "registration.manage"]),
        item("Library", "Borrowing and library services", "/library", "❏", ["library.read", "library.borrow"]),
        item("Certificates", "Your certificate requests", "/certificates", "❖", ["certificates.read"]),
        item("Leave", "Your leave requests and status", "/leave-management", "◌", ["leave.read", "leave.manage"]),
      ],
    },
    { label: "Account", items: [item("Account security", "Protect your account and sign-in", "/account-security", "◉")] },
  ],
  PARENT: [
    { label: "My workspace", items: [item("Overview", "Your linked children at a glance", "/parent", "⌂")] },
    {
      label: "Family",
      items: [
        item("My children", "Open your linked student profiles", "/parent/children", "♙", ["parent-links.read"]),
        item("Academic calendar", "Important academic dates", "/calendar", "◫", ["calendar.read"]),
      ],
    },
    { label: "Account", items: [item("Account security", "Protect your account and sign-in", "/account-security", "◉")] },
  ],
  CLUB_PRESIDENT: [
    { label: "My workspace", items: [item("Overview", "Your assigned club at a glance", "/club-president", "⌂")] },
    {
      label: "Club",
      items: [
        item("Club workspace", "Manage work within your assigned club", "/club-president", "♣", ["club.read", "club.manage"]),
        item("Calendar", "View relevant institution and club events", "/calendar", "◫", ["calendar.read"]),
      ],
    },
    { label: "Account", items: [item("Account security", "Protect your account and sign-in", "/account-security", "◉")] },
  ],
};

export function getPrimaryRole(roles: readonly string[]): CanonicalRole | null {
  const normalized = new Set(normalizeRoles(roles));
  return ROLE_PRIORITY.find((role) => normalized.has(role)) ?? null;
}
