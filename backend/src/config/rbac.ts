/**
 * ACADLYX — Central RBAC configuration
 *
 * This file is the single source of truth for:
 * - Built-in system roles
 * - Grantable permissions
 * - Default role → permission mappings
 *
 * IMPORTANT:
 * - Permissions are capabilities, not routes.
 * - Backend middleware/services must enforce authorization.
 * - Frontend visibility must never be treated as security.
 * - Tenant/institution scope must come from the authenticated user,
 *   never from arbitrary client input.
 */

export const PERMISSIONS = [
  {
    key: "users.read",
    module: "users",
    description: "View users",
  },
  {
    key: "users.create",
    module: "users",
    description: "Create users",
  },
  {
    key: "users.update",
    module: "users",
    description: "Update users",
  },
  {
    key: "users.delete",
    module: "users",
    description: "Delete or deactivate users",
  },

  {
    key: "students.read",
    module: "students",
    description: "View students",
  },
  {
    key: "students.create",
    module: "students",
    description: "Create students",
  },
  {
    key: "students.update",
    module: "students",
    description: "Update students",
  },

  {
    key: "attendance.read",
    module: "attendance",
    description: "View attendance",
  },
  {
    key: "attendance.mark",
    module: "attendance",
    description: "Mark attendance",
  },

  {
    key: "assignments.read",
    module: "assignments",
    description: "View assignments",
  },
  {
    key: "assignments.create",
    module: "assignments",
    description: "Create assignments",
  },
  {
    key: "assignments.update",
    module: "assignments",
    description: "Edit or publish assignments",
  },
  {
    key: "assignments.review",
    module: "assignments",
    description: "Review or grade assignments",
  },
  {
    key: "assignments.submit",
    module: "assignments",
    description: "Submit assignment work",
  },

  {
    key: "marks.read",
    module: "marks",
    description: "View academic marks",
  },
  {
    key: "marks.enter",
    module: "marks",
    description: "Enter academic marks",
  },

  {
    key: "exams.manage",
    module: "exams",
    description: "Create, view, update, delete examinations and manage examination results",
  },

  {
    key: "site.manage",
    module: "site",
    description: "Manage the public institutional website",
  },
  {
    key: "imports.manage",
    module: "imports",
    description: "Import institutional data from spreadsheets",
  },
  {
    key: "reports.read",
    module: "reports",
    description: "View reports",
  },
  {
    key: "intelligence.read",
    module: "intelligence",
    description: "View institutional intelligence",
  },

  {
    key: "institutions.manage",
    module: "institutions",
    description: "Manage institutions at platform level",
  },

  {
    key: "departments.read",
    module: "academics",
    description: "View departments",
  },
  {
    key: "departments.create",
    module: "academics",
    description: "Create departments",
  },
  {
    key: "departments.update",
    module: "academics",
    description: "Update departments",
  },
  {
    key: "departments.delete",
    module: "academics",
    description: "Deactivate departments",
  },

  {
    key: "programs.read",
    module: "academics",
    description: "View programs",
  },
  {
    key: "programs.create",
    module: "academics",
    description: "Create programs",
  },
  {
    key: "programs.update",
    module: "academics",
    description: "Update programs",
  },
  {
    key: "programs.delete",
    module: "academics",
    description: "Deactivate programs",
  },

  {
    key: "academic-years.read",
    module: "academics",
    description: "View academic years",
  },
  {
    key: "academic-years.create",
    module: "academics",
    description: "Create academic years",
  },
  {
    key: "academic-years.update",
    module: "academics",
    description: "Update academic years",
  },

  {
    key: "semesters.read",
    module: "academics",
    description: "View semesters",
  },
  {
    key: "semesters.create",
    module: "academics",
    description: "Create semesters",
  },
  {
    key: "semesters.update",
    module: "academics",
    description: "Update semesters",
  },
  {
    key: "semesters.delete",
    module: "academics",
    description: "Deactivate semesters",
  },

  {
    key: "sections.read",
    module: "academics",
    description: "View sections",
  },
  {
    key: "sections.create",
    module: "academics",
    description: "Create sections",
  },
  {
    key: "sections.update",
    module: "academics",
    description: "Update sections",
  },
  {
    key: "sections.delete",
    module: "academics",
    description: "Deactivate sections",
  },

  {
    key: "courses.read",
    module: "academics",
    description: "View courses",
  },
  {
    key: "courses.create",
    module: "academics",
    description: "Create courses",
  },
  {
    key: "courses.update",
    module: "academics",
    description: "Update courses",
  },
  {
    key: "courses.delete",
    module: "academics",
    description: "Deactivate courses",
  },

  {
    key: "course-offerings.read",
    module: "academics",
    description: "View course offerings",
  },
  {
    key: "course-offerings.create",
    module: "academics",
    description: "Create course offerings",
  },
  {
    key: "course-offerings.update",
    module: "academics",
    description: "Update course offerings",
  },
  {
    key: "course-offerings.delete",
    module: "academics",
    description: "Close or deactivate course offerings",
  },
] as const;

export type PermissionKey =
  (typeof PERMISSIONS)[number]["key"];

export const SYSTEM_ROLE_NAMES = [
  "SUPER_ADMIN",
  "INSTITUTION_ADMIN",
  "DIRECTOR",
  "MANAGEMENT",
  "HOD",
  "FACULTY",
  "STAFF",
  "STUDENT",
  "PARENT",
] as const;

export type SystemRoleName =
  (typeof SYSTEM_ROLE_NAMES)[number];

const ACADEMIC_READ: PermissionKey[] = [
  "departments.read",
  "programs.read",
  "academic-years.read",
  "semesters.read",
  "sections.read",
  "courses.read",
  "course-offerings.read",
];

const ALL_PERMISSIONS: PermissionKey[] =
  PERMISSIONS.map(
    (permission) => permission.key
  );

/**
 * Default permissions for every built-in role.
 *
 * SUPER_ADMIN:
 *   Platform-level administrator.
 *
 * INSTITUTION_ADMIN:
 *   Full institutional administration without platform-level
 *   institution management.
 *
 * DIRECTOR / MANAGEMENT:
 *   Institution-wide operational visibility and intelligence.
 *
 * HOD:
 *   Department-oriented academic/operational access.
 *
 * FACULTY:
 *   Teaching, attendance, assignments and assessment.
 *
 * STAFF:
 *   Basic administrative/read access.
 *
 * STUDENT:
 *   Self-service academic access.
 *
 * PARENT:
 *   Read-only visibility into linked student information.
 *
 * IMPORTANT:
 * Permission checks alone do not establish data ownership.
 * Services must additionally enforce tenant, department,
 * student, parent-child and other resource-level boundaries.
 */
export const ROLE_PERMISSIONS: Record<
  SystemRoleName,
  PermissionKey[]
> = {
  SUPER_ADMIN: [...ALL_PERMISSIONS],

  INSTITUTION_ADMIN:
    ALL_PERMISSIONS.filter(
      (permission) =>
        permission !==
        "institutions.manage"
    ),

  DIRECTOR: [
    "users.read",
    "students.read",
    "attendance.read",
    "assignments.read",
    "marks.read",
    "reports.read",
    "intelligence.read",
    "site.manage",
    "imports.manage",
    "exams.manage",
    ...ACADEMIC_READ,
  ],

  MANAGEMENT: [
    "users.read",
    "students.read",
    "attendance.read",
    "assignments.read",
    "marks.read",
    "reports.read",
    "intelligence.read",
    "site.manage",
    "imports.manage",
    "exams.manage",
    ...ACADEMIC_READ,
  ],

  HOD: [
    "students.read",
    "attendance.read",
    "assignments.read",
    "assignments.review",
    "marks.read",
    "reports.read",
    "intelligence.read",
    "exams.manage",
    ...ACADEMIC_READ,
    "sections.update",
    "course-offerings.update",
  ],

  FACULTY: [
    "students.read",
    "attendance.read",
    "attendance.mark",
    "assignments.read",
    "assignments.create",
    "assignments.update",
    "assignments.review",
    "marks.read",
    "marks.enter",
    "exams.manage",
    ...ACADEMIC_READ,
  ],

  STAFF: [
    "students.read",
    "users.read",
    ...ACADEMIC_READ,
  ],

  STUDENT: [
    "attendance.read",
    "assignments.read",
    "assignments.submit",
    "marks.read",
    ...ACADEMIC_READ,
  ],

  PARENT: [
    "attendance.read",
    "assignments.read",
    "marks.read",
    ...ACADEMIC_READ,
  ],
};
