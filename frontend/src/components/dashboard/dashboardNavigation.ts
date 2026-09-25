import type { CanonicalRole } from "@/lib/authorization";

import {
  NAVIGATION,
  navigationForRole,
  primaryRole,
  ROLE_LABELS,
  workspaceHome,
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
    home: "/superadmin",
  },

  INSTITUTION_ADMIN: {
    label: "Institution Admin",
    title: "Institution Workspace",
    subtitle:
      "Institution setup, users and academic administration",
    eyebrow:
      "Institution administration",
    home: "/admin",
  },

  CHAIRMAN: {
    label: "Chairman / Management",
    title: "Management Workspace",
    subtitle:
      "Institution-wide oversight and strategic visibility",
    eyebrow:
      "Management oversight",
    home: "/chairman",
  },

  DIRECTOR: {
    label: "Director",
    title: "Director Workspace",
    subtitle:
      "Institution-wide academic and operational oversight",
    eyebrow:
      "Institution leadership",
    home: "/director",
  },

  DEAN: {
    label: "Dean",
    title: "Dean Workspace",
    subtitle:
      "School-level academic leadership and performance",
    eyebrow:
      "Academic leadership",
    home: "/dean",
  },

  REGISTRAR: {
    label: "Registrar",
    title: "Registrar Workspace",
    subtitle:
      "Official student and academic lifecycle management",
    eyebrow:
      "Student lifecycle",
    home: "/registrar",
  },

  HOD: {
    label: "HOD",
    title: "Department Workspace",
    subtitle:
      "Department operations, faculty and academic review",
    eyebrow:
      "Department leadership",
    home: "/hod",
  },

  FACULTY: {
    label: "Faculty",
    title: "Faculty Workspace",
    subtitle:
      "Your assigned classes, attendance and assessment work",
    eyebrow:
      "Teaching workspace",
    home: "/faculty",
  },

  ACCOUNTS: {
    label: "Accounts",
    title: "Finance Workspace",
    subtitle:
      "Fees, invoices, collections and financial operations",
    eyebrow:
      "Finance operations",
    home: "/accounts",
  },

  HR: {
    label: "HR",
    title: "People Workspace",
    subtitle:
      "Employees, leave and people administration",
    eyebrow:
      "People operations",
    home: "/hr",
  },

  ADMISSIONS: {
    label: "Admissions",
    title: "Admissions Workspace",
    subtitle:
      "Enquiries, applications, verification and admission",
    eyebrow:
      "Admissions operations",
    home: "/admissions",
  },

  EXAMINATION: {
    label: "Examination Cell",
    title: "Examination Workspace",
    subtitle:
      "Examination scheduling, marks and result publication",
    eyebrow:
      "Examination operations",
    home: "/examinations",
  },

  LIBRARIAN: {
    label: "Librarian",
    title: "Library Workspace",
    subtitle:
      "Catalogue, circulation, reservations and fines",
    eyebrow:
      "Library operations",
    home: "/library",
  },

  PLACEMENT: {
    label: "Placement",
    title: "Placement Workspace",
    subtitle:
      "Companies, drives, eligibility and placements",
    eyebrow:
      "Placement operations",
    home: "/placements",
  },

  IT: {
    label: "IT",
    title: "IT Workspace",
    subtitle:
      "Technical operations, integrations and platform support",
    eyebrow:
      "Technology operations",
    home: "/it",
  },

  CMS: {
    label: "CMS",
    title: "Website Workspace",
    subtitle:
      "Public website content and publishing",
    eyebrow:
      "Website management",
    home: "/site-content",
  },

  STUDENT: {
    label: "Student",
    title: "Student Workspace",
    subtitle:
      "Your classes, progress, services and academic actions",
    eyebrow:
      "Student self-service",
    home: "/student",
  },

  PARENT: {
    label: "Parent",
    title: "Parent Workspace",
    subtitle:
      "Your linked children, academic progress and communication",
    eyebrow:
      "Family self-service",
    home: "/parent",
  },

  CLUB_PRESIDENT: {
    label: "Club President",
    title: "Club Workspace",
    subtitle:
      "Activities and events for your assigned student club",
    eyebrow:
      "Student club responsibility",
    home: "/club-president",
  },
};

function toGroups(
  role: CanonicalRole,
): NavigationGroup[] {
  const groups =
    new Map<
      string,
      NavigationItem[]
    >();

  for (const entry of navigationForRole(
    role,
  )) {
    const mapped: NavigationItem = {
      label: entry.label,
      description:
        entry.description ||
        `${entry.label} workspace`,
      href: entry.href,
      icon: entry.icon,
      permissions:
        entry.permissions
          ? [...entry.permissions]
          : undefined,
    };

    groups.set(
      entry.group,
      [
        ...(groups.get(
          entry.group,
        ) || []),
        mapped,
      ],
    );
  }

  return [...groups.entries()].map(
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
  return primaryRole(
    roles,
  ) as CanonicalRole;
}

export {
  NAVIGATION,
  ROLE_LABELS,
  workspaceHome,
};
