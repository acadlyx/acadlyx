/**
 * ACADLYX — canonical permission catalogue.
 *
 * Permissions answer:
 *
 *   "WHAT may this user do?"
 *
 * Permissions do NOT answer:
 *
 *   "WHICH records may this user access?"
 *
 * Record-level access is separately controlled through the authority,
 * scope and ownership layers.
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

  {
    key: "timetable.read",
    module: "timetable",
    description: "View timetables",
  },
  {
    key: "timetable.manage",
    module: "timetable",
    description: "Create and change timetable entries",
  },

  {
    key: "notices.read",
    module: "notices",
    description: "View notice administration",
  },
  {
    key: "notices.manage",
    module: "notices",
    description: "Publish and manage notices",
  },

  {
    key: "exams.read",
    module: "exams",
    description: "View examinations",
  },
  {
    key: "exams.manage",
    module: "exams",
    description: "Create examinations and enter results",
  },
  {
    key: "results.read",
    module: "exams",
    description: "View exam results, grades, SGPA and CGPA within scope",
  },

  {
    key: "fees.read",
    module: "fees",
    description: "View fee invoices within scope",
  },
  {
    key: "fees.manage",
    module: "fees",
    description: "Manage fee heads, structures and invoices",
  },
  {
    key: "fees.pay",
    module: "fees",
    description: "Record fee payments and issue receipts",
  },

  {
    key: "parent-links.read",
    module: "parent-portal",
    description: "View parent-student links",
  },
  {
    key: "parent-links.manage",
    module: "parent-portal",
    description: "Manage parent-student links",
  },
  {
    key: "parent-portal.read",
    module: "parent-portal",
    description: "Use the linked-student portal views",
  },

  {
    key: "notifications.read",
    module: "notifications",
    description: "Read own notifications",
  },
  {
    key: "notifications.manage",
    module: "notifications",
    description: "Send notifications to users in scope",
  },

  {
    key: "documents.read",
    module: "documents",
    description: "View documents within scope",
  },
  {
    key: "documents.manage",
    module: "documents",
    description: "Upload and remove documents",
  },

  {
    key: "admissions.read",
    module: "admissions",
    description: "View admission applications",
  },
  {
    key: "admissions.manage",
    module: "admissions",
    description: "Process admission applications",
  },

  {
    key: "hr.read",
    module: "hr",
    description: "View employee records",
  },
  {
    key: "hr.manage",
    module: "hr",
    description: "Manage employee records",
  },

  {
    key: "leave.apply",
    module: "leave",
    description: "Apply for leave",
  },
  {
    key: "leave.read",
    module: "leave",
    description: "View leave requests within scope",
  },
  {
    key: "leave.approve",
    module: "leave",
    description: "Approve or reject leave requests within authority",
  },
  {
    key: "leave.manage",
    module: "leave",
    description: "Manage leave types",
  },

  {
    key: "library.read",
    module: "library",
    description: "Browse the library catalogue",
  },
  {
    key: "library.borrow",
    module: "library",
    description: "View own library loans",
  },
  {
    key: "library.manage",
    module: "library",
    description: "Manage catalogue and circulation",
  },

  {
    key: "calendar.read",
    module: "calendar",
    description: "View the academic calendar",
  },
  {
    key: "calendar.manage",
    module: "calendar",
    description: "Manage the academic calendar",
  },

  {
    key: "registration.submit",
    module: "registration",
    description: "Register for course offerings",
  },
  {
    key: "registration.read",
    module: "registration",
    description: "View course registrations within scope",
  },
  {
    key: "registration.approve",
    module: "registration",
    description: "Approve course registrations within scope",
  },

  {
    key: "promotions.read",
    module: "promotions",
    description: "View promotion and transfer requests",
  },
  {
    key: "promotions.manage",
    module: "promotions",
    description: "Raise promotion and transfer requests",
  },
  {
    key: "promotions.approve",
    module: "promotions",
    description: "Approve promotion and transfer requests",
  },

  {
    key: "certificates.request",
    module: "certificates",
    description: "Request certificates",
  },
  {
    key: "certificates.read",
    module: "certificates",
    description: "View certificate requests within scope",
  },
  {
    key: "certificates.issue",
    module: "certificates",
    description: "Issue certificates",
  },

  {
    key: "audit.read",
    module: "audit",
    description: "View the institution audit trail",
  },

  {
    key: "exams.approve",
    module: "exams",
    description: "Approve, lock and publish examination marks",
  },
  {
    key: "exams.invigilate",
    module: "exams",
    description: "Record examination attendance and incidents",
  },
  {
    key: "exams.revaluate",
    module: "exams",
    description: "Request or decide revaluation",
  },

  {
    key: "attendance.correct",
    module: "attendance",
    description: "Raise attendance correction requests",
  },
  {
    key: "attendance.approve",
    module: "attendance",
    description: "Approve or reject attendance corrections",
  },
  {
    key: "attendance.lock",
    module: "attendance",
    description: "Finalise and lock attendance",
  },
  {
    key: "attendance.policy",
    module: "attendance",
    description: "Configure attendance shortage policy",
  },

  {
    key: "lms.read",
    module: "lms",
    description: "View course content and quizzes",
  },
  {
    key: "lms.manage",
    module: "lms",
    description: "Author modules, lessons, question banks and quizzes",
  },
  {
    key: "lms.attempt",
    module: "lms",
    description: "Attempt quizzes and record lesson progress",
  },
  {
    key: "lms.grade",
    module: "lms",
    description: "Grade quiz attempts",
  },

  {
    key: "fees.refund",
    module: "fees",
    description: "Request refunds",
  },
  {
    key: "fees.approve",
    module: "fees",
    description: "Approve concessions and refunds",
  },
  {
    key: "fees.reconcile",
    module: "fees",
    description: "Reconcile payments against provider statements",
  },

  {
    key: "operations.read",
    module: "operations",
    description: "View assets, facilities and maintenance",
  },
  {
    key: "operations.manage",
    module: "operations",
    description: "Manage assets, facilities and maintenance",
  },
  {
    key: "maintenance.raise",
    module: "operations",
    description: "Raise a maintenance request",
  },

  {
    key: "campuses.read",
    module: "campuses",
    description: "View campuses",
  },
  {
    key: "campuses.create",
    module: "campuses",
    description: "Create a campus",
  },
  {
    key: "campuses.update",
    module: "campuses",
    description: "Update a campus",
  },
  {
    key: "campuses.delete",
    module: "campuses",
    description: "Remove a campus",
  },

  {
    key: "plans.manage",
    module: "saas",
    description: "Manage subscription plans and tenant lifecycle",
  },
] as const;

export type PermissionKey =
  (typeof PERMISSIONS)[number]["key"];
