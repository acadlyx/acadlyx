import type { CanonicalRole } from "@/lib/authorization";
import {
  navigationForRole,
  primaryRole as primaryNavigationRole,
  ROLE_LABELS,
} from "@/lib/navigation";

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

const HOME_BY_ROLE: Record<
  CanonicalRole,
  string
> = {
  SUPER_ADMIN: "/superadmin",
  INSTITUTION_ADMIN: "/admin",
  CHAIRMAN: "/chairman",
  DIRECTOR: "/director",
  DEAN: "/dean",
  REGISTRAR: "/registrar",
  HOD: "/hod",
  FACULTY: "/faculty",
  ACCOUNTS: "/accounts",
  HR: "/hr",
  ADMISSIONS: "/admissions",
  EXAMINATION: "/examinations",
  LIBRARIAN: "/library",
  PLACEMENT: "/placements",
  IT: "/it",
  CMS: "/site-content",
  STUDENT: "/student",
  PARENT: "/parent",
  CLUB_PRESIDENT: "/club-president",
};

export const WORKSPACE_META: Record<
  CanonicalRole,
  WorkspaceMeta
> = {
  SUPER_ADMIN: {
    label: "Super Admin",
    title: "Platform Workspace",
    subtitle:
      "Institutions, platform administration and security",
    eyebrow:
      "Platform administration",
    home: HOME_BY_ROLE.SUPER_ADMIN,
  },

  INSTITUTION_ADMIN: {
    label: "Institution Admin",
    title: "Institution Workspace",
    subtitle:
      "Institution setup, users and academic administration",
    eyebrow:
      "Institution administration",
    home:
      HOME_BY_ROLE.INSTITUTION_ADMIN,
  },

  CHAIRMAN: {
    label: "Chairman / Management",
    title: "Management Workspace",
    subtitle:
      "Institution-wide oversight and strategic visibility",
    eyebrow:
      "Management oversight",
    home: HOME_BY_ROLE.CHAIRMAN,
  },

  DIRECTOR: {
    label: "Director",
    title: "Director Workspace",
    subtitle:
      "Institution-wide academic and operational oversight",
    eyebrow:
      "Institution leadership",
    home: HOME_BY_ROLE.DIRECTOR,
  },

  DEAN: {
    label: "Dean",
    title: "Dean Workspace",
    subtitle:
      "School-level academic leadership and performance",
    eyebrow:
      "Academic leadership",
    home: HOME_BY_ROLE.DEAN,
  },

  REGISTRAR: {
    label: "Registrar",
    title: "Registrar Workspace",
    subtitle:
      "Official student and academic lifecycle management",
    eyebrow:
      "Student lifecycle",
    home: HOME_BY_ROLE.REGISTRAR,
  },

  HOD: {
    label: "HOD",
    title: "Department Workspace",
    subtitle:
      "Department operations, faculty and academic review",
    eyebrow:
      "Department leadership",
    home: HOME_BY_ROLE.HOD,
  },

  FACULTY: {
    label: "Faculty",
    title: "Faculty Workspace",
    subtitle:
      "Your assigned classes, attendance and assessment work",
    eyebrow:
      "Teaching workspace",
    home: HOME_BY_ROLE.FACULTY,
  },

  ACCOUNTS: {
    label: "Accounts",
    title: "Finance Workspace",
    subtitle:
      "Fees, invoices, collections and financial operations",
    eyebrow:
      "Finance operations",
    home: HOME_BY_ROLE.ACCOUNTS,
  },

  HR: {
    label: "HR",
    title: "People Workspace",
    subtitle:
      "Employees, leave and people administration",
    eyebrow:
      "People operations",
    home: HOME_BY_ROLE.HR,
  },

  ADMISSIONS: {
    label: "Admissions",
    title: "Admissions Workspace",
    subtitle:
      "Enquiries, applications, verification and admission",
    eyebrow:
      "Admissions operations",
    home: HOME_BY_ROLE.ADMISSIONS,
  },

  EXAMINATION: {
    label: "Examination Cell",
    title: "Examination Workspace",
    subtitle:
      "Examination scheduling, marks and result publication",
    eyebrow:
      "Examination operations",
    home: HOME_BY_ROLE.EXAMINATION,
  },

  LIBRARIAN: {
    label: "Librarian",
    title: "Library Workspace",
    subtitle:
      "Catalogue, circulation, reservations and fines",
    eyebrow:
      "Library operations",
    home: HOME_BY_ROLE.LIBRARIAN,
  },

  PLACEMENT: {
    label: "Placement",
    title: "Placement Workspace",
    subtitle:
      "Companies, drives, eligibility and placements",
    eyebrow:
      "Placement operations",
    home: HOME_BY_ROLE.PLACEMENT,
  },

  IT: {
    label: "IT",
    title: "IT Workspace",
    subtitle:
      "Technical operations, integrations and platform support",
    eyebrow:
      "Technology operations",
    home: HOME_BY_ROLE.IT,
  },

  CMS: {
    label: "CMS",
    title: "Website Workspace",
    subtitle:
      "Public website content and publishing",
    eyebrow:
      "Website management",
    home: HOME_BY_ROLE.CMS,
  },

  STUDENT: {
    label: "Student",
    title: "Student Workspace",
    subtitle:
      "Your classes, progress, services and academic actions",
    eyebrow:
      "Student self-service",
    home: HOME_BY_ROLE.STUDENT,
  },

  PARENT: {
    label: "Parent",
    title: "Parent Workspace",
    subtitle:
      "Your linked children, academic progress and communication",
    eyebrow:
      "Family self-service",
    home: HOME_BY_ROLE.PARENT,
  },

  CLUB_PRESIDENT: {
    label: "Club President",
    title: "Club Workspace",
    subtitle:
      "Activities and events for your assigned student club",
    eyebrow:
      "Student club responsibility",
    home: HOME_BY_ROLE.CLUB_PRESIDENT,
  },
};

function toNavigationItem(
  item: ReturnType<
    typeof navigationForRole
  >[number],
): NavigationItem {
  return {
    label: item.label,
    description:
      `Open ${item.label.toLowerCase()}.`,
    href: item.href,
    icon: item.icon,
    permissions:
      item.permissions,
  };
}

function toGroups(
  role: CanonicalRole,
): NavigationGroup[] {
  const groups =
    new Map<
      string,
      NavigationItem[]
    >();

  for (
    const item of navigationForRole(role)
  ) {
    const group =
      item.group ||
      "Workspace";

    const current =
      groups.get(group) ||
      [];

    current.push(
      toNavigationItem(item),
    );

    groups.set(
      group,
      current,
    );
  }

  return Array.from(
    groups.entries(),
  ).map(
    ([label, items]) => ({
      label,
      items,
    }),
  );
}

export const ROLE_NAVIGATION =
  Object.fromEntries(
    ROLE_PRIORITY.map(
      (role) => [
        role,
        toGroups(role),
      ],
    ),
  ) as Record<
    CanonicalRole,
    NavigationGroup[]
  >;

export function getPrimaryRole(
  roles: CanonicalRole[],
): CanonicalRole {
  return primaryNavigationRole(
    roles,
  ) as CanonicalRole;
}

export { ROLE_LABELS };
