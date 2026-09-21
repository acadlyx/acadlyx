import {
  getCanonicalRoleNames,
  SystemRoleName,
} from "./roles";

/**
 * Every dedicated stakeholder workspace in Acadlyx.
 *
 * LMS is deliberately not included in this dashboard architecture phase.
 */
export const DASHBOARD_IDS = [
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
] as const;

export type DashboardId =
  (typeof DASHBOARD_IDS)[number];

export interface DashboardDefinition {
  id: DashboardId;
  label: string;
  description: string;

  /**
   * Roles that can own this workspace.
   */
  roles: readonly SystemRoleName[];

  /**
   * Whether the workspace normally operates within an institution.
   */
  institutionScoped: boolean;

  /**
   * Whether the workspace is fundamentally self-scoped.
   */
  selfScoped: boolean;
}

export const DASHBOARDS: Record<
  DashboardId,
  DashboardDefinition
> = {
  SUPER_ADMIN: {
    id: "SUPER_ADMIN",
    label: "Super Admin",
    description:
      "Platform administration and institution provisioning",
    roles: ["SUPER_ADMIN"],
    institutionScoped: false,
    selfScoped: false,
  },

  INSTITUTION_ADMIN: {
    id: "INSTITUTION_ADMIN",
    label: "Institution Admin",
    description:
      "Institution-wide administration and configuration",
    roles: ["INSTITUTION_ADMIN"],
    institutionScoped: true,
    selfScoped: false,
  },

  CHAIRMAN: {
    id: "CHAIRMAN",
    label: "Chairman / Management",
    description:
      "Institutional oversight, analytics and governance",
    roles: ["CHAIRMAN"],
    institutionScoped: true,
    selfScoped: false,
  },

  DIRECTOR: {
    id: "DIRECTOR",
    label: "Director",
    description:
      "Institution-wide academic and operational leadership",
    roles: ["DIRECTOR"],
    institutionScoped: true,
    selfScoped: false,
  },

  DEAN: {
    id: "DEAN",
    label: "Dean",
    description:
      "School-level academic leadership",
    roles: ["DEAN"],
    institutionScoped: true,
    selfScoped: false,
  },

  REGISTRAR: {
    id: "REGISTRAR",
    label: "Registrar",
    description:
      "Official academic records and student lifecycle administration",
    roles: ["REGISTRAR"],
    institutionScoped: true,
    selfScoped: false,
  },

  HOD: {
    id: "HOD",
    label: "HOD",
    description:
      "Department-level academic management",
    roles: ["HOD"],
    institutionScoped: true,
    selfScoped: false,
  },

  FACULTY: {
    id: "FACULTY",
    label: "Faculty",
    description:
      "Teaching, attendance, assessment and assigned classes",
    roles: ["FACULTY"],
    institutionScoped: true,
    selfScoped: false,
  },

  ACCOUNTS: {
    id: "ACCOUNTS",
    label: "Accounts",
    description:
      "Fees, billing, collections, refunds and reconciliation",
    roles: ["ACCOUNTS"],
    institutionScoped: true,
    selfScoped: false,
  },

  HR: {
    id: "HR",
    label: "HR",
    description:
      "Employee records, leave and HR workflows",
    roles: ["HR"],
    institutionScoped: true,
    selfScoped: false,
  },

  ADMISSIONS: {
    id: "ADMISSIONS",
    label: "Admissions",
    description:
      "Applicant and admission lifecycle management",
    roles: ["ADMISSIONS"],
    institutionScoped: true,
    selfScoped: false,
  },

  EXAMINATION: {
    id: "EXAMINATION",
    label: "Examination Cell",
    description:
      "Examination administration and official result workflow",
    roles: ["EXAMINATION"],
    institutionScoped: true,
    selfScoped: false,
  },

  LIBRARIAN: {
    id: "LIBRARIAN",
    label: "Librarian",
    description:
      "Library catalogue and circulation operations",
    roles: ["LIBRARIAN"],
    institutionScoped: true,
    selfScoped: false,
  },

  PLACEMENT: {
    id: "PLACEMENT",
    label: "Placement",
    description:
      "Employers, drives, applications and placement operations",
    roles: ["PLACEMENT"],
    institutionScoped: true,
    selfScoped: false,
  },

  IT: {
    id: "IT",
    label: "IT",
    description:
      "Institution technical administration and support",
    roles: ["IT"],
    institutionScoped: true,
    selfScoped: false,
  },

  CMS: {
    id: "CMS",
    label: "CMS",
    description:
      "Public institutional website management",
    roles: ["CMS"],
    institutionScoped: true,
    selfScoped: false,
  },

  STUDENT: {
    id: "STUDENT",
    label: "Student",
    description:
      "Student self-service workspace",
    roles: ["STUDENT"],
    institutionScoped: true,
    selfScoped: true,
  },

  PARENT: {
    id: "PARENT",
    label: "Parent",
    description:
      "Linked-child parent/guardian workspace",
    roles: ["PARENT"],
    institutionScoped: true,
    selfScoped: false,
  },

  CLUB_PRESIDENT: {
    id: "CLUB_PRESIDENT",
    label: "Student Club President",
    description:
      "Student-led club management workspace",
    roles: ["CLUB_PRESIDENT"],
    institutionScoped: true,
    selfScoped: false,
  },
};

/**
 * Determines the primary dashboard for a user with one or more roles.
 *
 * The order is deliberate. Platform/institution leadership takes precedence
 * over specialist or self-service roles when multiple roles exist.
 */
const DASHBOARD_PRIORITY: DashboardId[] = [
  "SUPER_ADMIN",
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
  "LIBRARIAN",
  "PLACEMENT",
  "IT",
  "CMS",
  "FACULTY",
  "CLUB_PRESIDENT",
  "STUDENT",
  "PARENT",
];

export function getPrimaryDashboard(
  roles: readonly string[]
): DashboardId | null {
  const canonicalRoles =
    getCanonicalRoleNames(
      roles
    );

  return (
    DASHBOARD_PRIORITY.find(
      (dashboard) =>
        canonicalRoles.includes(
          dashboard
        )
    ) ?? null
  );
}

export function getDashboardDefinition(
  roles: readonly string[]
): DashboardDefinition | null {
  const dashboard =
    getPrimaryDashboard(
      roles
    );

  if (!dashboard) {
    return null;
  }

  return DASHBOARDS[
    dashboard
  ];
}
