/**
 * ACADLYX — canonical RBAC configuration.
 *
 * This file is the single source of truth for:
 *
 *   1. System roles
 *   2. Permission catalogue
 *   3. Default role -> permission assignments
 *   4. Authority rank
 *   5. Legacy role aliases
 *
 * IMPORTANT:
 *
 * Role != permission != scope != workflow authority.
 *
 * A permission only says that a role may perform a class of operation.
 * Services/controllers must still enforce institution, department,
 * program, course, student, ownership and workflow scope.
 *
 * Frontend navigation is never a security boundary.
 */

/**
 * Workflow dependency catalogue.
 *
 * These are runtime capabilities required to complete an action safely.
 * They are NOT role grants and never expand write authority.
 */
export type PermissionDependencyAccess = "READ" | "WRITE" | "VERIFY";

export type PermissionDependency = {
  permission: string;
  dependencies: Array<{
    permission: string;
    access: PermissionDependencyAccess;
  }>;
};

export const PERMISSION_DEPENDENCIES: PermissionDependency[] = [
  { permission: "library.borrow", dependencies: [
    { permission: "students.read", access: "READ" },
    { permission: "library.read", access: "READ" },
  ]},
  { permission: "library.manage", dependencies: [
    { permission: "students.read", access: "READ" },
    { permission: "library.read", access: "READ" },
  ]},
  { permission: "exams.manage", dependencies: [
    { permission: "students.read", access: "READ" },
    { permission: "programs.read", access: "READ" },
    { permission: "departments.read", access: "READ" },
    { permission: "semesters.read", access: "READ" },
    { permission: "sections.read", access: "READ" },
    { permission: "courses.read", access: "READ" },
  ]},
  { permission: "exams.invigilate", dependencies: [
    { permission: "students.read", access: "READ" },
    { permission: "sections.read", access: "READ" },
  ]},
  { permission: "exams.approve", dependencies: [
    { permission: "marks.read", access: "READ" },
    { permission: "students.read", access: "READ" },
    { permission: "courses.read", access: "READ" },
  ]},
  { permission: "attendance.mark", dependencies: [
    { permission: "students.read", access: "READ" },
    { permission: "course-offerings.read", access: "READ" },
    { permission: "sections.read", access: "READ" },
  ]},
  { permission: "marks.enter", dependencies: [
    { permission: "students.read", access: "READ" },
    { permission: "course-offerings.read", access: "READ" },
  ]},
  { permission: "fees.assign", dependencies: [
    { permission: "students.read", access: "READ" },
    { permission: "programs.read", access: "READ" },
  ]},
  { permission: "fees.payment.record", dependencies: [
    { permission: "students.read", access: "READ" },
    { permission: "fees.invoice.read", access: "READ" },
  ]},
  { permission: "fees.concession.apply", dependencies: [
    { permission: "students.read", access: "READ" },
  ]},
  { permission: "admissions.manage", dependencies: [
    { permission: "programs.read", access: "READ" },
    { permission: "departments.read", access: "READ" },
    { permission: "documents.read", access: "READ" },
  ]},
  { permission: "obe.mapping.manage", dependencies: [
    { permission: "programs.read", access: "READ" },
    { permission: "courses.read", access: "READ" },
  ]},
  { permission: "obe.assessment.manage", dependencies: [
    { permission: "courses.read", access: "READ" },
    { permission: "course-offerings.read", access: "READ" },
  ]},
];

export const PERMISSIONS = [
  { key: "users.read", module: "users", description: "View users" },
  { key: "users.create", module: "users", description: "Create users" },
  { key: "users.update", module: "users", description: "Update users" },
  { key: "users.delete", module: "users", description: "Delete or deactivate users" },

  { key: "students.read", module: "students", description: "View students within scope" },
  { key: "students.create", module: "students", description: "Create students through institutional student administration" },
  { key: "students.update", module: "students", description: "Update student master records within scope" },

  { key: "attendance.read", module: "attendance", description: "View attendance within scope" },
  { key: "attendance.mark", module: "attendance", description: "Mark attendance for assigned classes" },
  { key: "attendance.correct", module: "attendance", description: "Raise attendance correction requests" },
  { key: "attendance.approve", module: "attendance", description: "Approve attendance corrections within authority" },
  { key: "attendance.lock", module: "attendance", description: "Finalise and lock attendance" },
  { key: "attendance.policy", module: "attendance", description: "Configure attendance policy" },

  { key: "assignments.read", module: "assignments", description: "View assignments within scope" },
  { key: "assignments.create", module: "assignments", description: "Create assignments" },
  { key: "assignments.update", module: "assignments", description: "Edit or publish assignments" },
  { key: "assignments.review", module: "assignments", description: "Review or grade assignments" },
  { key: "assignments.submit", module: "assignments", description: "Submit assignment work" },

  { key: "marks.read", module: "marks", description: "View academic marks within scope" },
  { key: "marks.enter", module: "marks", description: "Enter academic marks for assigned courses" },

  {
    key: "site.manage",
    module: "site",
    description: "Manage public institutional website content",
  },

  { key: "imports.manage", module: "imports", description: "Import institutional data" },
  { key: "people.import", module: "people", description: "Bulk import students, faculty and staff within authorized scope" },
  { key: "reports.read", module: "reports", description: "View reports within scope" },
  { key: "intelligence.read", module: "intelligence", description: "View institutional intelligence" },

  {
    key: "institutions.manage",
    module: "institutions",
    description: "Manage institutions at platform level",
  },

  { key: "departments.read", module: "academics", description: "View departments" },
  { key: "departments.create", module: "academics", description: "Create departments" },
  { key: "departments.update", module: "academics", description: "Update departments" },
  { key: "departments.delete", module: "academics", description: "Deactivate departments" },

  { key: "programs.read", module: "academics", description: "View programs" },
  { key: "programs.create", module: "academics", description: "Create programs" },
  { key: "programs.update", module: "academics", description: "Update programs" },
  { key: "programs.delete", module: "academics", description: "Deactivate programs" },

  { key: "batches.read", module: "academics", description: "View student batches" },
  { key: "batches.create", module: "academics", description: "Create student batches" },
  { key: "batches.update", module: "academics", description: "Update student batches" },
  { key: "batches.delete", module: "academics", description: "Deactivate student batches" },

  { key: "academic-years.read", module: "academics", description: "View academic years" },
  { key: "academic-years.create", module: "academics", description: "Create academic years" },
  { key: "academic-years.update", module: "academics", description: "Update academic years" },

  { key: "semesters.read", module: "academics", description: "View semesters" },
  { key: "semesters.create", module: "academics", description: "Create semesters" },
  { key: "semesters.update", module: "academics", description: "Update semesters" },
  { key: "semesters.delete", module: "academics", description: "Deactivate semesters" },

  { key: "sections.read", module: "academics", description: "View sections" },
  { key: "sections.create", module: "academics", description: "Create sections" },
  { key: "sections.update", module: "academics", description: "Update sections" },
  { key: "sections.delete", module: "academics", description: "Deactivate sections" },

  { key: "courses.read", module: "academics", description: "View courses" },
  { key: "courses.create", module: "academics", description: "Create courses" },
  { key: "courses.update", module: "academics", description: "Update courses" },
  { key: "courses.delete", module: "academics", description: "Deactivate courses" },

  { key: "course-offerings.read", module: "academics", description: "View course offerings" },
  { key: "course-offerings.create", module: "academics", description: "Create course offerings" },
  { key: "course-offerings.update", module: "academics", description: "Update course offerings" },
  { key: "course-offerings.delete", module: "academics", description: "Close course offerings" },

  { key: "obe.read", module: "obe", description: "View outcome based education data" },
  { key: "obe.manage", module: "obe", description: "Manage OBE configuration and records within scope" },
  { key: "obe.programme-outcomes.manage", module: "obe", description: "Create and update programme outcomes and PSOs within scope" },
  { key: "obe.mapping.manage", module: "obe", description: "Create and update CO-PO/PSO mappings" },
  { key: "obe.mapping.submit", module: "obe", description: "Submit CO-PO/PSO mappings for review" },
  { key: "obe.assessment.manage", module: "obe", description: "Manage OBE assessments and CO question mapping" },
  { key: "obe.attainment.calculate", module: "obe", description: "Calculate CO and PO/PSO attainment" },
  { key: "obe.attainment.approve", module: "obe", description: "Approve OBE mappings and attainment runs" },
  { key: "obe.policy.manage", module: "obe", description: "Configure OBE attainment policies" },
  { key: "obe.indirect.manage", module: "obe", description: "Manage indirect OBE evidence" },
  { key: "obe.reports.read", module: "obe", description: "View OBE reports and analytics" },

  { key: "timetable.read", module: "timetable", description: "View timetables" },
  { key: "timetable.manage", module: "timetable", description: "Manage timetables" },

  { key: "notices.read", module: "notices", description: "View notices" },
  { key: "notices.manage", module: "notices", description: "Publish and manage notices" },

  { key: "exams.read", module: "exams", description: "View examinations" },
  { key: "exams.manage", module: "exams", description: "Manage examination operations" },
  { key: "exams.approve", module: "exams", description: "Approve, lock and publish examination marks" },
  { key: "exams.invigilate", module: "exams", description: "Record examination attendance and incidents" },
  { key: "exams.revaluate", module: "exams", description: "Handle examination revaluation authority" },

  { key: "results.read", module: "exams", description: "View examination results within scope" },

  { key: "fees.read", module: "fees", description: "View fee records within scope" },
  { key: "fees.collection.read", module: "fees", description: "View authorized fee collection summaries" },
  { key: "fees.structure.read", module: "fees", description: "View fee structures and heads" },
  { key: "fees.structure.manage", module: "fees", description: "Create and update fee structures and heads" },
  { key: "fees.structure.approve", module: "fees", description: "Approve fee structures for institutional billing" },
  { key: "fees.assign", module: "fees", description: "Assign fees and generate invoices" },
  { key: "fees.invoice.read", module: "fees", description: "View authorized invoices" },
  { key: "fees.invoice.manage", module: "fees", description: "Create, update and cancel invoices" },
  { key: "fees.payment.read", module: "fees", description: "View authorized payments" },
  { key: "fees.payment.record", module: "fees", description: "Record and reconcile payments" },
  { key: "fees.receipt.read", module: "fees", description: "View authorized receipts" },
  { key: "fees.receipt.generate", module: "fees", description: "Generate receipts for valid payments" },
  { key: "fees.concession.read", module: "fees", description: "View concessions" },
  { key: "fees.concession.manage", module: "fees", description: "Create concession requests" },
  { key: "fees.concession.approve", module: "fees", description: "Approve concessions" },
  { key: "fees.refund.read", module: "fees", description: "View refunds" },
  { key: "fees.refund.request", module: "fees", description: "Request refunds" },
  { key: "fees.refund.approve", module: "fees", description: "Approve refunds" },
  { key: "fees.refund.process", module: "fees", description: "Process approved refunds" },
  { key: "fees.reports.read", module: "fees", description: "View financial reports" },
  { key: "fees.reports.export", module: "fees", description: "Export authorized financial reports" },

  { key: "fees.manage", module: "fees", description: "Manage fee heads, structures and invoices" },
  { key: "fees.pay", module: "fees", description: "Record fee payments and issue receipts" },
  { key: "fees.refund", module: "fees", description: "Process or request fee refunds" },
  { key: "fees.approve", module: "fees", description: "Approve fee concessions and refunds" },
  { key: "fees.reconcile", module: "fees", description: "Reconcile financial payments" },

  { key: "parent-links.read", module: "parent-portal", description: "View parent-student links" },
  { key: "parent-links.manage", module: "parent-portal", description: "Manage parent-student links" },
  { key: "parent-portal.read", module: "parent-portal", description: "Use linked-student portal views" },

  { key: "notifications.read", module: "notifications", description: "Read own notifications" },
  { key: "notifications.manage", module: "notifications", description: "Send notifications within scope" },

  { key: "documents.read", module: "documents", description: "View documents within scope" },
  { key: "documents.manage", module: "documents", description: "Manage documents within scope" },

  { key: "admissions.read", module: "admissions", description: "View admission applications" },
  { key: "admissions.manage", module: "admissions", description: "Process admission applications" },

  { key: "placements.read", module: "placements", description: "View placement opportunities, applications and placement intelligence" },
  { key: "placements.manage", module: "placements", description: "Manage placement opportunities and application workflow" },
  { key: "placements.apply", module: "placements", description: "Apply to eligible placement opportunities" },

  { key: "hr.read", module: "hr", description: "View employee records" },
  { key: "hr.manage", module: "hr", description: "Manage employee records" },

  { key: "leave.apply", module: "leave", description: "Apply for leave" },
  { key: "leave.read", module: "leave", description: "View leave requests within scope" },
  { key: "leave.approve", module: "leave", description: "Approve or reject leave within configured authority" },
  { key: "leave.manage", module: "leave", description: "Manage leave types and leave administration" },

  { key: "library.read", module: "library", description: "Browse library catalogue" },
  { key: "library.borrow", module: "library", description: "Use personal library services" },
  { key: "library.manage", module: "library", description: "Manage library catalogue and circulation" },
  { key: "library.fines.waive.request", module: "library", description: "Request library fine waivers" },
  { key: "library.fines.waive.approve", module: "library", description: "Approve library fine waivers" },

  { key: "calendar.read", module: "calendar", description: "View academic calendar" },
  { key: "calendar.manage", module: "calendar", description: "Manage academic calendar" },
  { key: "events.read", module: "events", description: "View institutional events" },
  { key: "events.manage", module: "events", description: "Manage institutional events" },
  { key: "club.read", module: "clubs", description: "View assigned club within scope" },
  { key: "club.manage", module: "clubs", description: "Manage assigned club within scope" },

  { key: "enrollment.submit", module: "enrollment", description: "Submit own academic enrollment requests" },
  { key: "enrollment.read", module: "enrollment", description: "View academic enrollment requests within scope" },
  { key: "enrollment.approve", module: "enrollment", description: "Approve or reject academic enrollment requests within scope" },

  { key: "registration.submit", module: "registration", description: "Submit course registration" },
  { key: "registration.read", module: "registration", description: "View registrations within scope" },
  { key: "registration.approve", module: "registration", description: "Approve course registrations" },

  { key: "promotions.read", module: "promotions", description: "View student movement requests" },
  { key: "promotions.manage", module: "promotions", description: "Create student movement requests" },
  { key: "promotions.approve", module: "promotions", description: "Approve student movement requests" },

  { key: "certificates.request", module: "certificates", description: "Request certificates" },
  { key: "certificates.read", module: "certificates", description: "View certificate requests" },
  { key: "certificates.issue", module: "certificates", description: "Issue certificates" },

  { key: "audit.read", module: "audit", description: "View audit trail" },

  { key: "lms.read", module: "lms", description: "View LMS content" },
  { key: "lms.manage", module: "lms", description: "Manage LMS content" },
  { key: "lms.attempt", module: "lms", description: "Attempt LMS assessments" },
  { key: "lms.grade", module: "lms", description: "Grade LMS assessments" },

  { key: "operations.read", module: "operations", description: "View operational records" },
  { key: "operations.manage", module: "operations", description: "Manage operational records" },
  { key: "maintenance.raise", module: "operations", description: "Raise maintenance requests" },

  { key: "campuses.read", module: "campuses", description: "View campuses" },
  { key: "campuses.create", module: "campuses", description: "Create campuses" },
  { key: "campuses.update", module: "campuses", description: "Update campuses" },
  { key: "campuses.delete", module: "campuses", description: "Remove campuses" },

  { key: "plans.manage", module: "saas", description: "Manage platform subscription plans" },
] as const;

export type PermissionKey =
  (typeof PERMISSIONS)[number]["key"];

/**
 * Canonical application roles. Legacy MANAGEMENT/STAFF values are accepted
 * only as database/input compatibility aliases and are never canonical roles.
 */
export const SYSTEM_ROLE_NAMES = [
  "SUPER_ADMIN",
  "INSTITUTION_ADMIN",
  "CHAIRMAN",
  "MANAGEMENT",
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

export type SystemRoleName =
  (typeof SYSTEM_ROLE_NAMES)[number];

/**
 * Roles that may exist only at platform level.
 */
export const PLATFORM_ROLES = [
  "SUPER_ADMIN",
] as const;

/**
 * Roles that are institution scoped.
 */
export const INSTITUTION_ROLES = SYSTEM_ROLE_NAMES.filter(
  (role) =>
    role !== "SUPER_ADMIN"
) as readonly SystemRoleName[];

/**
 * Legacy aliases.
 *
 * Existing production records are not silently destroyed.
 * New application logic should use the canonical role names.
 */
export const LEGACY_ROLE_ALIASES: Record<string, SystemRoleName> = {};

export function normalizeRoleName(
  role: string
): SystemRoleName | null {
  const canonicalAlias = LEGACY_ROLE_ALIASES[role];
  if (canonicalAlias) return canonicalAlias;

  if (SYSTEM_ROLE_NAMES.includes(role as SystemRoleName)) {
    return role as SystemRoleName;
  }

  return null;
}

export function isSupportedRole(
  role: string
): boolean {
  return (
    normalizeRoleName(
      role
    ) !== null
  );
}

export function isPlatformRole(
  role: string
): boolean {
  return (
    normalizeRoleName(
      role
    ) === "SUPER_ADMIN"
  );
}

export function isInstitutionRole(
  role: string
): boolean {
  const normalized =
    normalizeRoleName(
      role
    );

  return Boolean(
    normalized &&
      normalized !== "SUPER_ADMIN"
  );
}

export function getCanonicalRoleNames(
  roles: readonly string[]
): SystemRoleName[] {
  const result =
    new Set<SystemRoleName>();

  for (
    const role of roles
  ) {
    const normalized =
      normalizeRoleName(
        role
      );

    if (normalized) {
      result.add(
        normalized
      );
    }
  }

  return [
    ...result,
  ];
}


const ACADEMIC_READ: PermissionKey[] = [
  "departments.read",
  "programs.read",
  "batches.read",
  "academic-years.read",
  "semesters.read",
  "sections.read",
  "courses.read",
  "course-offerings.read",
];

const LEADERSHIP_READ: PermissionKey[] = [
  "students.read",
  "attendance.read",
  "assignments.read",
  "marks.read",
  "reports.read",
  "intelligence.read",
  "users.read",

  ...ACADEMIC_READ,

  "timetable.read",
  "notices.read",
  "exams.read",
  "results.read",
  "fees.read",
  "parent-links.read",
  "parent-portal.read",
  "notifications.read",
  "documents.read",
  "admissions.read",
  "hr.read",
  "leave.read",
  "library.read",
  "calendar.read",
  "registration.read",
  "promotions.read",
  "certificates.read",
  "operations.read",
  "campuses.read",
];

/**
 * Default permissions by role.
 *
 * IMPORTANT:
 *
 * SUPER_ADMIN deliberately does NOT receive every institutional permission.
 *
 * Platform administration and institution administration are separate
 * authority domains.
 *
 * Super Admin can provision institutions, manage platform security and
 * designate institution administrators/CMS users, but does not become the
 * operational Accounts/HR/Faculty/Student/etc. operator merely by virtue
 * of being Super Admin.
 */
const EVENTS_READ: PermissionKey[] = ["events.read"];

export const ROLE_PERMISSIONS: Record<
  SystemRoleName,
  PermissionKey[]
> = {
  SUPER_ADMIN: [
    "users.read",
    "users.create",
    "users.update",
    "users.delete",

    "institutions.manage",
    "plans.manage",

    "site.manage",

    "reports.read",
    "audit.read",
  ],

    INSTITUTION_ADMIN: [
    ...EVENTS_READ,
    "events.manage",
    "fees.structure.read",
    "fees.structure.manage",
    /*
     * Institution-wide administrative role.
     *
     * Institution Admin manages the institution's people,
     * academic structure, institutional configuration and
     * examination operations.
     *
     * Platform-only permissions remain excluded.
     */

    "users.read",
    "users.create",
    "users.update",
    "users.delete",

    "students.read",
    "students.create",
    "students.update",
    "people.import",
    "imports.manage",

    ...ACADEMIC_READ,

    "departments.create",
    "departments.update",
    "departments.delete",

    "programs.create",
    "programs.update",
    "programs.delete",

    "batches.create",
    "batches.update",
    "batches.delete",

    "academic-years.create",
    "academic-years.update",

    "semesters.create",
    "semesters.update",
    "semesters.delete",

    "sections.create",
    "sections.update",
    "sections.delete",

    "courses.create",
    "courses.update",
    "courses.delete",

    "course-offerings.create",
    "course-offerings.update",
    "course-offerings.delete",

    "notices.read",
    "notices.manage",

    "notifications.read",
    "notifications.manage",

    "documents.read",
    "documents.manage",

    "calendar.read",
    "calendar.manage",

    "parent-links.read",
    "parent-links.manage",

    /*
     * Examination oversight (read-only).
     *
     * Institution Admin needs to *see* the examination lifecycle
     * for institutional governance, which is what backs the
     * "Examinations" navigation entry and the read endpoints
     * (GET /examinations/sessions, /rooms, /schedules/:id,
     * /sessions/:id/hall-ticket, /students/:studentId).
     *
     * Deliberately NOT granted — these are specialist operations
     * owned by the EXAMINATION role (and approval by DIRECTOR):
     *
     *   exams.manage    create/patch sessions, rooms, schedules,
     *                   seating, invigilator and hall-ticket
     *                   allocation
     *   exams.approve   session status, marks approval, schedule
     *                   lock and result publication
     *   exams.invigilate  invigilation duty / incident reporting
     *   exams.revaluate  revaluation requests and decisions
     *   marks.enter     entering student marks
     *   results.read    result processing
     *
     * Granting these would let an institution administrator
     * authorise and publish the same results they oversee, so the
     * backend keeps the real security boundary here. The frontend
     * /examinations workspace renders read-only for this role.
     */
    "operations.read",
    "operations.manage",
    "maintenance.raise",

    "campuses.read",
    "campuses.create",
    "campuses.update",
    "campuses.delete",
    "lms.read",
  ],

  CHAIRMAN: [
    ...EVENTS_READ,
    "fees.collection.read",
    "fees.reports.read",
    "fees.reports.export",
    "fees.structure.read",
    "fees.structure.manage",
    "fees.structure.approve",
    "obe.read", "obe.reports.read",
    ...LEADERSHIP_READ,

    "audit.read",
    "lms.read",
  ],

  MANAGEMENT: [
    ...EVENTS_READ,
    "fees.collection.read",
    "fees.reports.read",
    "fees.reports.export",
    "fees.structure.read",
    "fees.structure.manage",
    "fees.structure.approve",
    "obe.read", "obe.reports.read",
    ...LEADERSHIP_READ,

    "audit.read",
    "lms.read",
  ],

  DIRECTOR: [
    ...EVENTS_READ,
    "events.manage",
    "fees.collection.read",
    "fees.reports.read",
    "fees.reports.export",
    "obe.read", "obe.programme-outcomes.manage", "obe.reports.read", "obe.attainment.approve",
    ...LEADERSHIP_READ,

    "registration.approve",
    "enrollment.read",
    "enrollment.approve",
    "promotions.approve",
    "certificates.issue",

    "exams.approve",
    "exams.revaluate",

    "attendance.approve",
    "attendance.lock",

    "fees.approve",
    "library.fines.waive.approve",

    "audit.read",
    "lms.read",
  ],

  DEAN: [
    ...EVENTS_READ,
    "fees.collection.read",
    "fees.reports.read",
    "fees.read",
    "obe.read", "obe.reports.read", "obe.attainment.approve",
    "students.read",
    "attendance.read",
    "assignments.read",
    "assignments.review",
    "marks.read",
    "reports.read",
    "intelligence.read",

    ...ACADEMIC_READ,

    "timetable.read",

    "notices.read",
    "notices.manage",

    "exams.read",
    "results.read",

    "parent-portal.read",

    "notifications.read",
    "documents.read",

    "leave.read",

    "calendar.read",

    "registration.read",
    "registration.approve",
    "enrollment.read",
    "enrollment.approve",

    "promotions.read",
    "promotions.approve",

    "certificates.read",

    "attendance.approve",
    "attendance.lock",

    "operations.read",
    "lms.read",
  ],


  REGISTRAR: [
    ...EVENTS_READ,
    "events.manage",
    "obe.read", "obe.programme-outcomes.manage", "obe.reports.read",
    "students.read",
    "students.update",

    "users.read",

    ...ACADEMIC_READ,

    "departments.create",
    "departments.update",

    "programs.create",
    "programs.update",

    "academic-years.create",
    "academic-years.update",

    "semesters.create",
    "semesters.update",

    "sections.create",
    "sections.update",

    "courses.create",
    "courses.update",

    "course-offerings.create",
    "course-offerings.update",

    "registration.read",
    "registration.approve",
    "enrollment.read",
    "enrollment.approve",

    "promotions.read",
    "promotions.manage",
    "promotions.approve",

    "certificates.read",
    "certificates.issue",

    "results.read",

    "exams.read",

    "reports.read",

    "notifications.read",
    "notifications.manage",

    "documents.read",
    "documents.manage",

    "calendar.read",
    "calendar.manage",

    "audit.read",
    "lms.read",
  ],

  HOD: [
    ...EVENTS_READ,
    "fees.collection.read",
    "fees.reports.read",
    "fees.read",
    "obe.read", "obe.attainment.calculate", "obe.indirect.manage", "obe.attainment.approve", "obe.reports.read",
    "students.read",
    "people.import",

    "attendance.read",
    "attendance.approve",
    "attendance.lock",

    "assignments.read",
    "assignments.review",

    "marks.read",

    "reports.read",
    "intelligence.read",

    "departments.read",
    "programs.read",
    "academic-years.read",
    "semesters.read",
    "sections.read",
    "sections.update",
    "courses.read",
    "course-offerings.read",
    "course-offerings.update",

    "timetable.read",
    "timetable.manage",

    "notices.read",
    "notices.manage",

    "exams.read",
    "results.read",

    "notifications.read",
    "notifications.manage",

    "documents.read",

    "leave.read",

    "library.read",
    "library.borrow",

    "calendar.read",

    "registration.read",
    "registration.approve",
    "enrollment.read",
    "enrollment.approve",

    "promotions.read",
    "promotions.manage",

    "lms.read",
    "lms.manage",
    "lms.grade",

    "operations.read",
    "maintenance.raise",
  ],

  FACULTY: [
    ...EVENTS_READ,
    "obe.read", "obe.mapping.manage", "obe.mapping.submit", "obe.assessment.manage", "obe.attainment.calculate", "obe.indirect.manage", "obe.reports.read",
    "students.read",

    "attendance.read",
    "attendance.mark",
    "attendance.correct",

    "assignments.read",
    "assignments.create",
    "assignments.update",
    "assignments.review",

    "marks.read",
    "marks.enter",

    "courses.read",
    "course-offerings.read",
    "sections.read",
    "programs.read",
    "academic-years.read",
    "semesters.read",

    "timetable.read",

    "exams.read",
    "exams.invigilate",

    "results.read",

    "notifications.read",
    "documents.read",

    "leave.apply",

    "library.read",
    "library.borrow",

    "calendar.read",

    "lms.read",
    "lms.manage",
    "lms.grade",

    "maintenance.raise",
  ],

  ACCOUNTS: [
    ...EVENTS_READ,
    "students.read",
    "programs.read",
    "fees.collection.read",
    "fees.structure.read",
    "fees.structure.manage",
    "fees.assign",
    "fees.invoice.read",
    "fees.invoice.manage",
    "fees.payment.read",
    "fees.payment.record",
    "fees.receipt.read",
    "fees.receipt.generate",
    "fees.concession.read",
    "fees.concession.manage",
    "fees.concession.approve",
    "fees.refund.read",
    "fees.refund.request",
    "fees.refund.approve",
    "fees.refund.process",
    "fees.reports.read",
    "fees.reports.export",

    "fees.read",
    "fees.manage",
    "fees.pay",
    "fees.refund",
    "fees.approve",
    "fees.reconcile",

    "reports.read",

    "users.read",

    "notifications.read",

    "documents.read",

    "calendar.read",

    "operations.read",
  ],

  HR: [
    ...EVENTS_READ,
    "users.read",
    "users.create",
    "users.update",

    "hr.read",
    "hr.manage",

    "leave.read",
    "leave.approve",
    "leave.manage",

    "reports.read",

    "notifications.read",
    "notifications.manage",

    "documents.read",
    "documents.manage",

    "audit.read",
  ],

  ADMISSIONS: [
    ...EVENTS_READ,
    "admissions.read",
    "admissions.manage",

    "students.read",

    "documents.read",
    "documents.manage",

    "notifications.read",
    "notifications.manage",

    "reports.read",

    "calendar.read",
  ],

  EXAMINATION: [
    ...EVENTS_READ,
    "obe.read", "obe.assessment.manage", "obe.reports.read",

    // Examination workspace needs read access to the people and
    // academic context it operates on (students, faculty/invigilators,
    // programmes, semesters, sections and course offerings).
    "users.read",
    "students.read",
    ...ACADEMIC_READ,
    "timetable.read",
    "attendance.read",
    "registration.read",
    "calendar.read",

    "exams.read",
    "exams.manage",
    "exams.approve",
    "exams.invigilate",
    "exams.revaluate",

    /*
     * Exam-paper mark entry.
     *
     * `PUT /examinations/schedules/:id/marks` is gated by
     * `marks.enter`, which is the only gate on that route (the
     * service records enteredById and enforces workflow state:
     * APPROVED/PUBLISHED marks are immutable, 409).
     *
     * Without this permission the Examination Cell could open the
     * marks sheet but every save returned 403, so the
     * marks -> approval -> publication lifecycle could never
     * complete. Entering exam-paper marks is examination-cell
     * work, which is why it is granted here and not to
     * INSTITUTION_ADMIN.
     */
    "marks.read",
    "marks.enter",

    "results.read",

    "reports.read",

    "notifications.read",
    "notifications.manage",

    "documents.read",

    "audit.read",
    "lms.read",
  ],

  LIBRARIAN: [
    ...EVENTS_READ,
    // Library circulation is a people-facing workflow: librarians need
    // to resolve borrowers and their academic context without gaining
    // user-management or academic-management authority.
    "users.read",
    "students.read",
    ...ACADEMIC_READ,
    "registration.read",
    "calendar.read",
    "operations.read",

    "library.read",
    "library.borrow",
    "library.manage",
    "library.fines.waive.request",

    "notifications.read",

    "reports.read",

    "documents.read",

    "maintenance.raise",
  ],

  PLACEMENT: [
    ...EVENTS_READ,
    "students.read",
    "placements.read",
    "placements.manage",

    "reports.read",

    "notifications.read",
    "notifications.manage",

    "documents.read",
    "documents.manage",

    "calendar.read",
  ],

  IT: [
    ...EVENTS_READ,
    "users.read",
    "users.update",

    "reports.read",
    "audit.read",

    "operations.read",
    "operations.manage",

    "notifications.read",
    "notifications.manage",

    "documents.read",
  ],

  CMS: [
    ...EVENTS_READ,
    "events.manage",
    "site.manage",
  ],

  STUDENT: [
    ...EVENTS_READ,
    "placements.read",
    "placements.apply",
    "obe.read",
    "attendance.read",

    "assignments.read",
    "assignments.submit",

    "marks.read",

    "courses.read",
    "course-offerings.read",
    "sections.read",
    "programs.read",
    "academic-years.read",
    "semesters.read",

    "timetable.read",

    "exams.read",
    "results.read",

    "fees.read",

    "notifications.read",

    "documents.read",

    "leave.apply",

    "library.read",
    "library.borrow",

    "calendar.read",

    "registration.submit",
    "enrollment.submit",
    "enrollment.read",

    "certificates.request",

    "attendance.correct",

    "lms.read",
    "lms.attempt",

    "maintenance.raise",
  ],

  PARENT: [
    ...EVENTS_READ,
    "attendance.read",

    "assignments.read",

    "marks.read",

    "courses.read",
    "course-offerings.read",
    "sections.read",
    "programs.read",
    "academic-years.read",
    "semesters.read",

    "timetable.read",

    "fees.read",

    "results.read",

    "parent-portal.read",

    "notifications.read",

    "documents.read",

    "calendar.read",

    "lms.read",
  ],

  CLUB_PRESIDENT: [
    ...EVENTS_READ,
    "club.read",
    "club.manage",
    "calendar.read",
  ],
};

export const ROLE_RANK: Record<
  SystemRoleName,
  number
> = {
  SUPER_ADMIN: 100,

  INSTITUTION_ADMIN: 90,

  CHAIRMAN: 80,

  MANAGEMENT: 80,

  DIRECTOR: 75,

  DEAN: 65,

  REGISTRAR: 65,

  HOD: 55,

  ACCOUNTS: 45,
  HR: 45,
  ADMISSIONS: 45,
  EXAMINATION: 45,
  LIBRARIAN: 45,
  PLACEMENT: 45,
  IT: 45,

  FACULTY: 40,

  CMS: 20,

  CLUB_PRESIDENT: 20,

  STUDENT: 10,
  PARENT: 10,

};

export function highestRoleRank(
  roles: readonly string[]
): number {
  return roles.reduce(
    (highest, role) => {
      const normalized =
        normalizeRoleName(
          role
        );

      if (!normalized) {
        return highest;
      }

      return Math.max(
        highest,
        ROLE_RANK[
          normalized
        ] ?? 0
      );
    },
    0
  );
}

export function outranks(
  approverRoles: readonly string[],
  applicantRoles: readonly string[]
): boolean {
  return (
    highestRoleRank(
      approverRoles
    ) >
    highestRoleRank(
      applicantRoles
    )
  );
}

export function getRolePermissions(
  roleName: string
): PermissionKey[] {
  const normalized =
    normalizeRoleName(
      roleName
    );

  if (!normalized) {
    return [];
  }

  return [
    ...(
      ROLE_PERMISSIONS[
        normalized
      ] ?? []
    ),
  ];
}

export function getEffectivePermissions(
  roles: readonly string[]
): PermissionKey[] {
  const permissions =
    new Set<PermissionKey>();

  for (
    const role of roles
  ) {
    for (
      const permission of
        getRolePermissions(
          role
        )
    ) {
      permissions.add(
        permission
      );
    }
  }

  return [
    ...permissions,
  ];
}

export function hasRole(
  roles: readonly string[],
  role: SystemRoleName
): boolean {
  return roles.some(
    (candidate) =>
      normalizeRoleName(
        candidate
      ) === role
  );
}

export function hasPermission(
  roles: readonly string[],
  permission: PermissionKey
): boolean {
  return getEffectivePermissions(
    roles
  ).includes(
    permission
  );
}

/**
 * Platform-only permissions.
 *
 * These must never be inherited by institution roles.
 */
export const PLATFORM_PERMISSIONS: PermissionKey[] = [
  "institutions.manage",
  "plans.manage",
];

export function isPlatformPermission(
  permission: PermissionKey
): boolean {
  return PLATFORM_PERMISSIONS.includes(
    permission
  );
}

/**
 * Institution permissions that must never be granted merely because
 * somebody has the Super Admin role.
 *
 * This is intentionally separate from platform permissions.
 */
export const INSTITUTION_OPERATION_PERMISSIONS: PermissionKey[] = [
  "students.create",
  "students.update",

  "fees.manage",
  "fees.pay",
  "fees.refund",
  "fees.approve",
  "fees.reconcile",

  "hr.manage",

  "leave.approve",
  "leave.manage",

  "admissions.manage",

  "exams.manage",
  "exams.approve",
  "exams.invigilate",
  "exams.revaluate",

  "library.manage",

  "registration.approve",

  "promotions.approve",

  "certificates.issue",

  "operations.manage",
];

/**
 * Returns only canonical roles.
 */
export function getCanonicalRoles(
  roles: readonly string[]
): SystemRoleName[] {
  return getCanonicalRoleNames(
    roles
  );
}
