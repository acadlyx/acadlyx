import { Router } from "express";
import * as controller from "../controllers/erp.controller";
import { authenticate } from "../middleware/authenticate";
import { authorize } from "../middleware/authorize";

const router = Router();

router.use(authenticate);

/**
 * Every authenticated institution user may load the workspace,
 * but the workspace itself is still tenant-scoped by requireInstitution().
 */
router.get(
  "/me/workspace",
  authorize(
    "attendance.read",
    "assignments.read",
    "marks.read"
  ),
  controller.workspace
);

/**
 * Timetable management.
 */
router.post(
  "/timetable",
  authorize("sections.update", "course-offerings.update"),
  controller.timetable
);

/**
 * Institutional notices.
 */
router.post(
  "/notices",
  authorize("reports.read"),
  controller.notice
);

/**
 * Exams.
 */
router.post(
  "/exams",
  authorize("marks.enter"),
  controller.exam
);

/**
 * Exam results.
 */
router.put(
  "/exam-results",
  authorize("marks.enter"),
  controller.result
);

/**
 * Fee invoices.
 */
router.post(
  "/fee-invoices",
  authorize("students.update"),
  controller.invoice
);

/**
 * Fee payments are allowed for:
 * - institution administration/staff
 * - parents paying for their children
 * - students paying their own invoice
 *
 * The service performs the final scope check.
 */
router.post(
  "/fee-invoices/:id/payments",
  authorize("students.read"),
  controller.payment
);

/**
 * Parent/student relationship management.
 */
router.post(
  "/parent-links",
  authorize("students.update"),
  controller.parentLink
);

export default router;
