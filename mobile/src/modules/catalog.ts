import { AuthUser } from "../auth/AuthProvider";

export type MobileModule = {
  id: string;
  title: string;
  category: string;
  description: string;
  endpoint: string;
  requiredAnyPermissions?: string[];
  allowedRoles?: string[];
};

// These entries provide read-only discovery until dedicated, schema-validated workflows exist.
export const MODULES: MobileModule[] = [
  { id: "student-dashboard", title: "My Dashboard", category: "My Learning", description: "Personal academic overview.", endpoint: "/students/me/dashboard", allowedRoles: ["STUDENT"] },
  { id: "student-attendance", title: "My Attendance", category: "My Learning", description: "Attendance records for the signed-in student.", endpoint: "/students/me/attendance", allowedRoles: ["STUDENT"] },
  { id: "student-marks", title: "My Performance", category: "My Learning", description: "Approved examination performance and internal assessment marks.", endpoint: "/examinations/my/performance", allowedRoles: ["STUDENT"] },
  { id: "student-results", title: "Published Results", category: "My Learning", description: "Official examination marks published by the institution.", endpoint: "/examinations/my/results", allowedRoles: ["STUDENT"] },
  { id: "student-assignments", title: "My Assignments", category: "My Learning", description: "Assignments visible to the signed-in student.", endpoint: "/students/me/assignments", allowedRoles: ["STUDENT"] },
  { id: "student-timetable", title: "My Timetable", category: "My Learning", description: "Timetable for the signed-in student.", endpoint: "/students/me/timetable", allowedRoles: ["STUDENT"] },
  { id: "students", title: "Students", category: "People & Structure", description: "Student master records within your authorized scope.", endpoint: "/students", requiredAnyPermissions: ["students.read"] },
  { id: "faculty", title: "Faculty Workspace", category: "People & Structure", description: "Faculty dashboard and teaching workspace.", endpoint: "/faculty/me/dashboard", allowedRoles: ["FACULTY"] },
  { id: "users", title: "Users", category: "People & Structure", description: "User administration records.", endpoint: "/users", requiredAnyPermissions: ["users.read"] },
  { id: "campuses", title: "Campuses", category: "People & Structure", description: "Campus records within your authorized scope.", endpoint: "/campuses", requiredAnyPermissions: ["campuses.read"] },
  { id: "departments", title: "Departments", category: "People & Structure", description: "Department records within your authorized scope.", endpoint: "/departments", requiredAnyPermissions: ["departments.read"] },
  { id: "programs", title: "Programmes", category: "People & Structure", description: "Programme records within your authorized scope.", endpoint: "/programs", requiredAnyPermissions: ["programs.read"] },
  { id: "academic-years", title: "Academic Years", category: "People & Structure", description: "Academic-year configuration.", endpoint: "/academic-years", requiredAnyPermissions: ["academic-years.read"] },
  { id: "batches", title: "Batches", category: "People & Structure", description: "Batch records within your authorized scope.", endpoint: "/batches", requiredAnyPermissions: ["batches.read"] },
  { id: "semesters", title: "Semesters", category: "People & Structure", description: "Semester records within your authorized scope.", endpoint: "/semesters", requiredAnyPermissions: ["semesters.read"] },
  { id: "sections", title: "Sections", category: "People & Structure", description: "Section records within your authorized scope.", endpoint: "/sections", requiredAnyPermissions: ["sections.read"] },
  { id: "courses", title: "Courses", category: "Academics", description: "Course catalogue within your authorized scope.", endpoint: "/courses", requiredAnyPermissions: ["courses.read"] },
  { id: "course-offerings", title: "Course Offerings", category: "Academics", description: "Teaching offerings within your authorized scope.", endpoint: "/course-offerings", requiredAnyPermissions: ["course-offerings.read"] },
  { id: "attendance", title: "Attendance", category: "Academics", description: "Attendance sessions; write and approval workflows remain in progress.", endpoint: "/attendance-sessions", requiredAnyPermissions: ["attendance.read", "attendance.mark"] },
  { id: "assignments", title: "Assignments", category: "Learning", description: "Assignment list and details.", endpoint: "/assignments", requiredAnyPermissions: ["assignments.read", "assignments.create", "assignments.update", "assignments.submit", "assignments.review"] },
  { id: "internal-marks", title: "Internal Marks", category: "Examinations", description: "View scoped marks or save component marks for your assigned course offerings.", endpoint: "/internal-marks", requiredAnyPermissions: ["marks.read"], allowedRoles: ["SUPER_ADMIN", "CHAIRMAN", "MANAGEMENT", "REGISTRAR", "EXAMINATION", "DIRECTOR", "DEAN", "HOD", "FACULTY"] },
  { id: "examinations", title: "Examinations", category: "Examinations", description: "Examination sessions and records.", endpoint: "/examinations/sessions", requiredAnyPermissions: ["exams.read"] },
  { id: "grades", title: "Grade Scale", category: "Examinations", description: "Configured grade scale.", endpoint: "/grades/scale", requiredAnyPermissions: ["marks.read"] },
  { id: "timetable", title: "Timetable", category: "Academics", description: "Timetable entries within your authorized scope.", endpoint: "/erp/timetable", requiredAnyPermissions: ["timetable.read", "timetable.manage"] },
  { id: "calendar", title: "Calendar", category: "Campus Life", description: "Institution calendar with event creation, editing, filtering and deletion when authorized.", endpoint: "/calendar/events", requiredAnyPermissions: ["calendar.read", "calendar.manage"] },
  { id: "registrations", title: "Registrations", category: "Academics", description: "Registration records and status.", endpoint: "/registrations", requiredAnyPermissions: ["registration.read"] },
  { id: "enrollment-requests", title: "Enrollment Requests", category: "Academics", description: "Enrollment requests within your authorized scope.", endpoint: "/enrollment-requests", requiredAnyPermissions: ["enrollment.read"] },
  { id: "admissions", title: "Admissions", category: "Administration", description: "Manage applications, validated status transitions and authorized student enrollment.", endpoint: "/admissions", requiredAnyPermissions: ["admissions.read", "admissions.manage"] },
  { id: "placements", title: "Placements", category: "Career & HR", description: "Placement opportunities; application and offer workflows remain in progress.", endpoint: "/placements/opportunities", requiredAnyPermissions: ["placements.read"] },
  { id: "hr", title: "Human Resources", category: "Career & HR", description: "Employee records and authorized employee management.", endpoint: "/hr/employees", requiredAnyPermissions: ["hr.read", "hr.manage"] },
  { id: "leave", title: "Leave", category: "Career & HR", description: "Apply for leave, review balances, decide authorized requests and manage leave types.", endpoint: "/leave/requests/mine", requiredAnyPermissions: ["leave.apply", "leave.approve", "leave.read", "leave.manage"] },
  { id: "fee-structures", title: "Fee Structures & Approvals", category: "Finance", description: "Review fee structures and authorized approval transitions.", endpoint: "/erp/fee-structures", requiredAnyPermissions: ["fees.structure.read"] },
  { id: "finance-refunds", title: "Refund Requests", category: "Finance", description: "Review refunds and run permitted state transitions.", endpoint: "/finance/refunds", requiredAnyPermissions: ["fees.read", "fees.refund.read", "fees.refund.approve", "fees.refund.process"] },
  { id: "finance-overview", title: "Finance Overview", category: "Finance", description: "Read-only finance overview.", endpoint: "/finance/overview", requiredAnyPermissions: ["fees.read", "fees.collection.read"] },
  { id: "finance-invoices", title: "Fee Invoices", category: "Finance", description: "Fee invoices within your authorized scope.", endpoint: "/finance/invoices", requiredAnyPermissions: ["fees.read", "fees.invoice.read"] },
  { id: "finance-payments", title: "Payments & Receipts", category: "Finance", description: "Payment records within your authorized scope.", endpoint: "/finance/payments", requiredAnyPermissions: ["fees.read", "fees.payment.read"] },
  { id: "notices", title: "Notices", category: "Communication", description: "Institutional notices with authorized create/edit/delete actions.", endpoint: "/erp/notices", requiredAnyPermissions: ["notices.read", "notices.manage"] },
  { id: "notifications", title: "Notifications", category: "Communication", description: "Notifications and read status.", endpoint: "/portal/notifications", requiredAnyPermissions: ["notifications.read"] },
  { id: "documents", title: "My Documents", category: "Communication", description: "Documents visible to the signed-in user.", endpoint: "/portal/documents/me", requiredAnyPermissions: ["documents.read"] },
  { id: "library", title: "Library", category: "Campus Life", description: "Book catalogue, reservations, circulation, inventory maintenance and fines.", endpoint: "/library/books", requiredAnyPermissions: ["library.read", "library.borrow", "library.manage"] },
  { id: "events", title: "Events", category: "Campus Life", description: "Institutional events within your authorized scope.", endpoint: "/events", requiredAnyPermissions: ["events.read"] },
  { id: "certificates", title: "Certificates", category: "Administration", description: "Certificate records within your authorized scope.", endpoint: "/certificates", requiredAnyPermissions: ["certificates.read"] },
  { id: "operations", title: "Operations", category: "Administration", description: "Operations records within your authorized scope.", endpoint: "/operations/summary", requiredAnyPermissions: ["operations.read"] },
  { id: "obe", title: "Outcome-Based Education", category: "Academics", description: "OBE records; mapping and attainment workflows remain in progress.", endpoint: "/obe/course-offerings", requiredAnyPermissions: ["obe.read"] },
  { id: "lms", title: "Learning Management", category: "Learning", description: "Learning-management records within your authorized scope.", endpoint: "/lms/catalog", requiredAnyPermissions: ["lms.read"] },
  { id: "intelligence", title: "Institutional Intelligence", category: "Reports & Governance", description: "Intelligence data within your authorized scope.", endpoint: "/intelligence/command-center", requiredAnyPermissions: ["intelligence.read"] },
  { id: "reports", title: "Finance Command Center", category: "Reports & Governance", description: "Finance command-center summary.", endpoint: "/finance/command-center", requiredAnyPermissions: ["fees.read", "fees.collection.read"] },
  { id: "parent-children", title: "My Children", category: "Parent Portal", description: "Children linked to the authenticated parent account.", endpoint: "/parent/children", requiredAnyPermissions: ["parent-portal.read"], allowedRoles: ["PARENT"] },
  { id: "institutions", title: "Institutions", category: "Platform", description: "Institution records, subject to platform and institution permissions.", endpoint: "/institutions", requiredAnyPermissions: ["institutions.manage"] }
];

export function canOpenModule(module: MobileModule, user: AuthUser): boolean {
  if (module.allowedRoles?.length && !module.allowedRoles.some((role) => user.roles.includes(role))) return false;
  if (module.requiredAnyPermissions?.length && !module.requiredAnyPermissions.some((permission) => user.permissions.includes(permission))) return false;
  return true;
}
export function getModule(moduleId: string): MobileModule | undefined {
  return MODULES.find((item) => item.id === moduleId);
}