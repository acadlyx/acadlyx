import { Router } from "express";

import * as controller from "../controllers/erp.controller";
import * as feeController from "../controllers/feeStructure.controller";

import { authenticate } from "../middleware/authenticate";
import { authorize } from "../middleware/authorize";
import { requireFeature } from "../middleware/requireFeature";
import {
  validateBody,
  validateParams,
  validateQuery,
} from "../middleware/validate";

import {
  createExamSchema,
  createInvoiceSchema,
  createNoticeSchema,
  createParentLinkSchema,
  createTimetableEntrySchema,
  examListQuerySchema,
  idParamSchema,
  invoiceListQuerySchema,
  noticeListQuerySchema,
  parentLinkListQuerySchema,
  parentLinkParamsSchema,
  recordPaymentSchema,
  timetableListQuerySchema,
  updateExamSchema,
  updateInvoiceSchema,
  updateNoticeSchema,
  updateTimetableEntrySchema,
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

router.get(
  "/me/workspace",
  requireFeature("notices"),
  authorize(
    "attendance.read",
    "assignments.read",
    "marks.read"
  ),
  controller.workspace
);

/* Timetable */
router.get(
  "/timetable",
  requireFeature("timetable"),
  authorize("timetable.manage"),
  validateQuery(timetableListQuerySchema),
  controller.timetableList
);
router.post(
  "/timetable",
  requireFeature("timetable"),
  authorize("timetable.manage"),
  validateBody(createTimetableEntrySchema),
  controller.timetable
);
router.patch(
  "/timetable/:id",
  requireFeature("timetable"),
  authorize("timetable.manage"),
  validateParams(idParamSchema),
  validateBody(updateTimetableEntrySchema),
  controller.timetableUpdate
);
router.delete(
  "/timetable/:id",
  requireFeature("timetable"),
  authorize("timetable.manage"),
  validateParams(idParamSchema),
  controller.timetableDelete
);

/* Notices */
router.get(
  "/notices",
  requireFeature("notices"),
  authorize("notices.manage"),
  validateQuery(noticeListQuerySchema),
  controller.noticeList
);
router.post(
  "/notices",
  requireFeature("notices"),
  authorize("notices.manage"),
  validateBody(createNoticeSchema),
  controller.notice
);
router.patch(
  "/notices/:id",
  requireFeature("notices"),
  authorize("notices.manage"),
  validateParams(idParamSchema),
  validateBody(updateNoticeSchema),
  controller.noticeUpdate
);
router.delete(
  "/notices/:id",
  requireFeature("notices"),
  authorize("notices.manage"),
  validateParams(idParamSchema),
  controller.noticeDelete
);

/* Exams and results */
router.get(
  "/exams",
  requireFeature("exams"),
  authorize("exams.manage"),
  validateQuery(examListQuerySchema),
  controller.examList
);
router.get(
  "/exams/:id",
  requireFeature("exams"),
  authorize("exams.manage"),
  validateParams(idParamSchema),
  controller.examDetails
);
router.post(
  "/exams",
  requireFeature("exams"),
  authorize("exams.manage"),
  validateBody(createExamSchema),
  controller.exam
);
router.patch(
  "/exams/:id",
  requireFeature("exams"),
  authorize("exams.manage"),
  validateParams(idParamSchema),
  validateBody(updateExamSchema),
  controller.examUpdate
);
router.delete(
  "/exams/:id",
  requireFeature("exams"),
  authorize("exams.manage"),
  validateParams(idParamSchema),
  controller.examDelete
);
router.put(
  "/exam-results",
  requireFeature("results"),
  authorize("exams.manage"),
  validateBody(upsertExamResultSchema),
  controller.result
);

/* Fee invoices and payments */
router.get(
  "/fee-invoices",
  requireFeature("fees"),
  authorize("fees.manage"),
  validateQuery(invoiceListQuerySchema),
  controller.invoiceList
);
router.get(
  "/fee-invoices/:id",
  requireFeature("fees"),
  authorize("fees.manage"),
  validateParams(idParamSchema),
  controller.invoiceDetails
);
router.post(
  "/fee-invoices",
  requireFeature("fees"),
  authorize("fees.manage"),
  validateBody(createInvoiceSchema),
  controller.invoice
);
router.patch(
  "/fee-invoices/:id",
  requireFeature("fees"),
  authorize("fees.manage"),
  validateParams(idParamSchema),
  validateBody(updateInvoiceSchema),
  controller.invoiceUpdate
);
router.delete(
  "/fee-invoices/:id",
  requireFeature("fees"),
  authorize("fees.manage"),
  validateParams(idParamSchema),
  controller.invoiceDelete
);
router.post(
  "/fee-invoices/:id/payments",
  requireFeature("payments"),
  authorize("fees.pay"),
  validateParams(idParamSchema),
  validateBody(recordPaymentSchema),
  controller.payment
);

/* Parent links */
router.get(
  "/parent-links",
  requireFeature("parent_portal"),
  authorize("parent-links.manage"),
  validateQuery(parentLinkListQuerySchema),
  controller.parentLinkList
);
router.post(
  "/parent-links",
  requireFeature("parent_portal"),
  authorize("parent-links.manage"),
  validateBody(createParentLinkSchema),
  controller.parentLink
);
router.delete(
  "/parent-links/:parentId/:studentId",
  requireFeature("parent_portal"),
  authorize("parent-links.manage"),
  validateParams(parentLinkParamsSchema),
  controller.parentLinkDelete
);

/* Fee heads */
router.get(
  "/fee-heads",
  authorize("fees.manage"),
  validateQuery(feeStructureListSchema),
  feeController.listFeeHeads
);
router.post(
  "/fee-heads",
  authorize("fees.manage"),
  validateBody(feeHeadCreateSchema),
  feeController.createFeeHead
);
router.patch(
  "/fee-heads/:id",
  authorize("fees.manage"),
  validateParams(idParamSchema),
  validateBody(feeHeadUpdateSchema),
  feeController.updateFeeHead
);

/* Fee structures */
router.get(
  "/fee-structures",
  authorize("fees.manage"),
  validateQuery(feeStructureListSchema),
  feeController.listFeeStructures
);
router.post(
  "/fee-structures",
  authorize("fees.manage"),
  validateBody(feeStructureCreateSchema),
  feeController.createFeeStructure
);
router.patch(
  "/fee-structures/:id",
  authorize("fees.manage"),
  validateParams(idParamSchema),
  validateBody(feeStructureUpdateSchema),
  feeController.updateFeeStructure
);

export default router;
