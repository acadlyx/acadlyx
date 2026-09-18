import { Router } from "express";
import * as controller from "../controllers/erp.controller";
import { authenticate } from "../middleware/authenticate";
import { authorize } from "../middleware/authorize";
import { validateBody } from "../middleware/validate";
import {
  createExamSchema,
  createInvoiceSchema,
  createNoticeSchema,
  createParentLinkSchema,
  createTimetableEntrySchema,
  recordPaymentSchema,
  upsertExamResultSchema,
} from "../validators/erp.validators";

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
  authorize("timetable.manage"),
  validateBody(createTimetableEntrySchema),
  controller.timetable
);

/**
 * Institutional notices.
 */
router.post(
  "/notices",
  authorize("notices.manage"),
  validateBody(createNoticeSchema),
  controller.notice
);

/**
 * Exams.
 */
router.post(
  "/exams",
  authorize("exams.manage"),
  validateBody(createExamSchema),
  controller.exam
);

/**
 * Exam results.
 */
router.put(
  "/exam-results",
  authorize("exams.manage"),
  validateBody(upsertExamResultSchema),
  controller.result
);

/**
 * Fee invoices.
 */
router.post(
  "/fee-invoices",
  authorize("fees.manage"),
  validateBody(createInvoiceSchema),
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
  authorize("fees.pay"),
  validateBody(recordPaymentSchema),
  controller.payment
);

/**
 * Parent/student relationship management.
 */
router.post(
  "/parent-links",
  authorize("parent-links.manage"),
  validateBody(createParentLinkSchema),
  controller.parentLink
);

export default router;
