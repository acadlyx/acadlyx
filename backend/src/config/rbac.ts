/**
 * ACADLYX system permission catalog and default role matrix.
 *
 * This file is the source of truth for built-in permissions.
 * Route authorization is still enforced independently through
 * middleware.
 */

export const PERMISSIONS = [
  /*
   * USERS
   */
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
    description:
      "Delete or deactivate users",
  },

  /*
   * STUDENTS
   */
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

  /*
   * ATTENDANCE
   */
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

  /*
   * ASSIGNMENTS
   */
  {
    key: "assignments.read",
    module: "assignments",
    description: "View assignments",
  },
  {
    key: "assignments.create",
    module: "assignments",
    description:
      "Create assignments",
  },
  {
    key: "assignments.update",
    module: "assignments",
    description:
      "Edit or publish assignments",
  },
  {
    key: "assignments.review",
    module: "assignments",
    description:
      "Review or grade assignments",
  },
  {
    key: "assignments.submit",
    module: "assignments",
    description:
      "Submit assignment work",
  },

  /*
   * MARKS
   */
  {
    key: "marks.read",
    module: "marks",
    description:
      "View academic marks",
  },
  {
    key: "marks.enter",
    module: "marks",
    description:
      "Enter academic marks",
  },

  /*
   * SITE / IMPORTS / REPORTING
   */
  {
    key: "site.manage",
    module: "site",
    description:
      "Manage the public institutional website",
  },
  {
    key: "imports.manage",
    module: "imports",
    description:
      "Import institutional data from spreadsheets",
  },
  {
    key: "reports.read",
    module: "reports",
    description:
      "View reports",
  },
  {
    key: "intelligence.read",
    module: "intelligence",
    description:
      "View institutional intelligence",
  },

  /*
   * PLATFORM
   */
  {
    key: "institutions.manage",
    module: "institutions",
    description:
      "Manage institutions at platform level",
  },

  /*
   * CAMPUSES
   */
  {
    key: "campuses.read",
    module: "academics",
    description:
      "View campuses",
  },
  {
    key: "campuses.create",
    module: "academics",
    description:
      "Create campuses",
  },
  {
    key: "campuses.update",
    module: "academics",
    description:
      "Update campuses",
  },
  {
    key: "campuses.delete",
    module: "academics",
    description:
      "Deactivate campuses",
  },

  /*
   * DEPARTMENTS
   */
  {
    key: "departments.read",
    module: "academics",
    description:
      "View departments",
  },
  {
    key: "departments.create",
    module: "academics",
    description:
      "Create departments",
  },
  {
    key: "departments.update",
    module: "academics",
    description:
      "Update departments",
  },
  {
    key: "departments.delete",
    module: "academics",
    description:
      "Deactivate departments",
  },

  /*
   * PROGRAMS
   */
  {
    key: "programs.read",
    module: "academics",
    description:
      "View programs",
  },
  {
    key: "programs.create",
    module: "academics",
    description:
      "Create programs",
  },
  {
    key: "programs.update",
    module: "academics",
    description:
      "Update programs",
  },
  {
    key: "programs.delete",
    module: "academics",
    description:
      "Deactivate programs",
  },

  /*
   * ACADEMIC YEARS
   */
  {
    key: "academic-years.read",
    module: "academics",
    description:
      "View academic years",
  },
  {
    key: "academic-years.create",
    module: "academics",
    description:
      "Create academic years",
  },
  {
    key: "academic-years.update",
    module: "academics",
    description:
      "Update academic years",
  },

  /*
   * SEMESTERS
   */
  {
    key: "semesters.read",
    module: "academics",
    description:
      "View semesters",
  },
  {
    key: "semesters.create",
    module: "academics",
    description:
      "Create semesters",
  },
  {
    key: "semesters.update",
    module: "academics",
    description:
      "Update semesters",
  },
  {
    key: "semesters.delete",
    module: "academics",
    description:
      "Deactivate semesters",
  },

  /*
   * SECTIONS
   */
  {
    key: "sections.read",
    module: "academics",
    description:
      "View sections",
  },
  {
    key: "sections.create",
    module: "academics",
    description:
      "Create sections",
  },
  {
    key: "sections.update",
    module: "academics",
    description:
      "Update sections",
  },
  {
    key: "sections.delete",
    module: "academics",
    description:
      "Deactivate sections",
  },

  /*
   * COURSES
   */
  {
    key: "courses.read",
    module: "academics",
    description:
      "View courses",
  },
  {
    key: "courses.create",
    module: "academics",
    description:
      "Create courses",
  },
  {
    key: "courses.update",
    module: "academics",
    description:
      "Update courses",
  },
  {
    key: "courses.delete",
    module: "academics",
    description:
      "Deactivate courses",
  },

  /*
   * COURSE OFFERINGS
   */
  {
    key: "course-offerings.read",
    module: "academics",
    description:
      "View course offerings",
  },
  {
    key: "course-offerings.create",
    module: "academics",
    description:
      "Create course offerings",
  },
  {
    key: "course-offerings.update",
    module: "academics",
    description:
      "Update course offerings",
  },
  {
    key: "course-offerings.delete",
    module: "academics",
    description:
      "Close or deactivate course offerings",
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

/**
 * Common academic read permissions.
 */
const ACADEMIC_READ = [
  "campuses.read",
  "departments.read",
  "programs.read",
  "academic-years.read",
  "semesters.read",
  "sections.read",
  "courses.read",
  "course-offerings.read",
];

const ALL_PERMISSIONS =
  PERMISSIONS.map(
    (permission) => permission.key
  );

export const ROLE_PERMISSIONS: Record<
  string,
  string[]
> = {
  /*
   * PLATFORM ADMINISTRATOR
   *
   * SUPER_ADMIN receives the complete
   * permission catalog.
   */
  SUPER_ADMIN: [
    ...ALL_PERMISSIONS,
  ],

  /*
   * INSTITUTION ADMINISTRATOR
   *
   * Receives every institutional permission
   * except platform-level institution management.
   */
  INSTITUTION_ADMIN:
    ALL_PERMISSIONS.filter(
      (permission) =>
        permission !==
        "institutions.manage"
    ),

  /*
   * DIRECTOR
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

  /*
   * MANAGEMENT
   */
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
   * HOD
   *
   * Department boundaries must additionally
   * be enforced by DepartmentAccess and
   * service-level tenant/department checks.
   */
  HOD: [
    "users.read",
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
   * FACULTY
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
   * STAFF
   */
  STAFF: [
    "students.read",
    "users.read",

    ...ACADEMIC_READ,
  ],

  /*
   * STUDENT
   */
  STUDENT: [
    "attendance.read",

    "assignments.read",
    "assignments.submit",

    "marks.read",

    ...ACADEMIC_READ,
  ],

  /*
   * PARENT
   */
  PARENT: [
    "attendance.read",

    "assignments.read",

    "marks.read",

    ...ACADEMIC_READ,
  ],
};
