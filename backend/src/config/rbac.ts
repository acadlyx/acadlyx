/**
 * ACADLYX system permission catalog and default role matrix.
 *
 * This is the central source of truth for the platform's built-in roles.
 * Route authorization is still enforced by middleware; this file defines
 * which capabilities each system role receives.
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

const ACADEMIC_READ = [
  "departments.read",
  "programs.read",
  "academic-years.read",
  "semesters.read",
  "sections.read",
  "courses.read",
  "course-offerings.read",
];

const ALL_PERMISSIONS = PERMISSIONS.map(
  (permission) => permission.key
);

export const ROLE_PERMISSIONS: Record<string, string[]> = {
  /*
   * Platform administrator.
   * This is the ONLY built-in role receiving institutions.manage.
   */
  SUPER_ADMIN: [...ALL_PERMISSIONS],

  /*
   * Institution administrator gets everything inside its own tenant,
   * but never the platform-only institutions.manage permission.
   */
  INSTITUTION_ADMIN: ALL_PERMISSIONS.filter(
    (permission) => permission !== "institutions.manage"
  ),

  /*
   * Executive institution-wide read/analytics access.
   */
  DIRECTOR: [
    "users.read",
    "students.read",
    "attendance.read",
    "assignments.read",
    "marks.read",
    "reports.read",
    "intelligence.read",
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
    ...ACADEMIC_READ,
  ],

  /*
   * HOD is institution-scoped and department-scoped by the services
   * that use these permissions.
   */
  HOD: [
    "students.read",
    "attendance.read",
    "assignments.read",
    "assignments.review",
    "marks.read",
    "reports.read",
    "intelligence.read",
    ...ACADEMIC_READ,
    "sections.update",
    "course-offerings.update",
  ],

  /*
   * Faculty gets teaching/assessment capabilities.
   */
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
    ...ACADEMIC_READ,
  ],

  /*
   * Administrative staff has read-oriented operational access.
   */
  STAFF: [
    "users.read",
    "students.read",
    ...ACADEMIC_READ,
  ],

  /*
   * Student self-service permissions. The /students/me endpoints
   * additionally scope data to the authenticated student.
   */
  STUDENT: [
    "attendance.read",
    "assignments.read",
    "assignments.submit",
    "marks.read",
    ...ACADEMIC_READ,
  ],

  /*
   * Parent read-only academic visibility. Parent-child data isolation
   * will be enforced by the parent portal services.
   */
  PARENT: [
    "attendance.read",
    "assignments.read",
    "marks.read",
    ...ACADEMIC_READ,
  ],
};
