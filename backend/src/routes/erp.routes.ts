import { Router } from "express";

import * as controller from "../controllers/erp.controller";
import * as feeController from "../controllers/feeStructure.controller";

import { authenticate } from "../middleware/authenticate";
import { authorize } from "../middleware/authorize";
import {
  validateBody,
  validateQuery,
} from "../middleware/validate";

import {
  createExamSchema,
  createInvoiceSchema,
  createNoticeSchema,
  createParentLinkSchema,
  createTimetableEntrySchema,
  recordPaymentSchema,
  upsertExamResultSchema,
} from "../validators/erp.validators";

import {
  feeHeadCreateSchema,
  feeHeadUpdateSchema,
  feeStructureCreateSchema,
  feeStructureListSchema,
  feeStructureUpdateSchema,
} from "../validators/feeStructure.validators";

const router = Router();

router.use(authenticate);

/*
 * Workspace
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

/*
 * Timetable
 */
router.post(
  "/timetable",
  authorize("timetable.manage"),
  validateBody(
    createTimetableEntrySchema
  ),
  controller.timetable
);

/*
 * Notices
 */
router.post(
  "/notices",
  authorize("notices.manage"),
  validateBody(
    createNoticeSchema
  ),
  controller.notice
);

/*
 * Exams
 */
router.post(
  "/exams",
  authorize("exams.manage"),
  validateBody(
    createExamSchema
  ),
  controller.exam
);

/*
 * Exam results
 */
router.put(
  "/exam-results",
  authorize("exams.manage"),
  validateBody(
    upsertExamResultSchema
  ),
  controller.result
);

/*
 * Existing fee invoices
 */
router.post(
  "/fee-invoices",
  authorize("fees.manage"),
  validateBody(
    createInvoiceSchema
  ),
  controller.invoice
);

/*
 * Existing fee payments
 */
router.post(
  "/fee-invoices/:id/payments",
  authorize("fees.pay"),
  validateBody(
    recordPaymentSchema
  ),
  controller.payment
);

/*
 * Parent links
 */
router.post(
  "/parent-links",
  authorize("parent-links.manage"),
  validateBody(
    createParentLinkSchema
  ),
  controller.parentLink
);

/*
 * ============================================================
 * M5-A — FEE HEADS
 * ============================================================
 */

router.get(
  "/fee-heads",
  authorize(
    "fees.manage"
  ),
  validateQuery(
    feeStructureListSchema
  ),
  feeController.listFeeHeads
);

router.post(
  "/fee-heads",
  authorize(
    "fees.manage"
  ),
  validateBody(
    feeHeadCreateSchema
  ),
  feeController.createFeeHead
);

router.patch(
  "/fee-heads/:id",
  authorize(
    "fees.manage"
  ),
  validateBody(
    feeHeadUpdateSchema
  ),
  feeController.updateFeeHead
);

/*
 * ============================================================
 * M5-A — FEE STRUCTURES
 * ============================================================
 */

router.get(
  "/fee-structures",
  authorize(
    "fees.manage"
  ),
  validateQuery(
    feeStructureListSchema
  ),
  feeController.listFeeStructures
);

router.post(
  "/fee-structures",
  authorize(
    "fees.manage"
  ),
  validateBody(
    feeStructureCreateSchema
  ),
  feeController.createFeeStructure
);

router.patch(
  "/fee-structures/:id",
  authorize(
    "fees.manage"
  ),
  validateBody(
    feeStructureUpdateSchema
  ),
  feeController.updateFeeStructure
);

export default router;
