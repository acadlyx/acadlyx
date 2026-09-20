import { Router } from "express";

import { authenticate } from "../middleware/authenticate";
import { authorize } from "../middleware/authorize";
import { requireFeature } from "../middleware/requireFeature";
import {
  validateBody,
  validateParams,
  validateQuery,
} from "../middleware/validate";
import * as service from "../services/feeBilling.service";
import { asyncHandler } from "../utils/asyncHandler";
import { auditMeta, searchTerm, sendOk, sendPage } from "../utils/http";
import { parsePagination } from "../utils/pagination";
import {
  requireAuthenticatedUser,
  requireInstitution,
} from "../utils/requireInstitution";
import { idParams } from "../validators/common";
import {
  cancelInvoiceSchema,
  concessionListQuery,
  confirmPaymentSchema,
  createConcessionSchema,
  decideConcessionSchema,
  decideRefundSchema,
  generateInvoicesSchema,
  invoiceListQuery,
  lateFeeRuleSchema,
  offlinePaymentSchema,
  reconciliationSchema,
  refundListQuery,
  refundRequestSchema,
  studentIdParams,
} from "../validators/coreErp.validators";

/**
 * Fee billing: invoicing, collection, receipts, refunds and
 * reconciliation. Configuration of heads and structures stays on
 * the existing fee-structure endpoints.
 */
const router = Router();

router.use(authenticate, requireFeature("fees"));

// ---------- Concessions / scholarships ----------

router.get(
  "/concessions",
  authorize("fees.read"),
  validateQuery(concessionListQuery),
  asyncHandler(async (req, res) => {
    const pagination = parsePagination(req);
    const { items, total } = await service.listConcessions(
      requireInstitution(req),
      requireAuthenticatedUser(req),
      pagination,
      {
        studentId: req.query.studentId as string | undefined,
        status: req.query.status as string | undefined,
      }
    );
    sendPage(res, items, total, pagination);
  })
);

router.post(
  "/concessions",
  authorize("fees.manage"),
  validateBody(createConcessionSchema),
  asyncHandler(async (req, res) =>
    sendOk(
      res,
      await service.createConcession(
        requireInstitution(req),
        requireAuthenticatedUser(req),
        req.body,
        auditMeta(req)
      ),
      201
    )
  )
);

router.patch(
  "/concessions/:id",
  authorize("fees.approve"),
  validateParams(idParams),
  validateBody(decideConcessionSchema),
  asyncHandler(async (req, res) =>
    sendOk(
      res,
      await service.decideConcession(
        requireInstitution(req),
        requireAuthenticatedUser(req),
        req.params.id,
        req.body.status,
        auditMeta(req)
      )
    )
  )
);

// ---------- Invoicing ----------

router.post(
  "/invoices/generate",
  authorize("fees.manage"),
  validateBody(generateInvoicesSchema),
  asyncHandler(async (req, res) =>
    sendOk(
      res,
      await service.generateInvoicesFromStructure(
        requireInstitution(req),
        requireAuthenticatedUser(req),
        req.body,
        auditMeta(req)
      ),
      201
    )
  )
);

router.get(
  "/invoices",
  authorize("fees.read"),
  validateQuery(invoiceListQuery),
  asyncHandler(async (req, res) => {
    const pagination = parsePagination(req);
    const { items, total, summary } = await service.listInvoices(
      requireInstitution(req),
      requireAuthenticatedUser(req),
      pagination,
      {
        studentId: req.query.studentId as string | undefined,
        status: req.query.status as string | undefined,
        overdueOnly: req.query.overdueOnly === "true",
        search: searchTerm(req.query.search),
      }
    );
    res.status(200).json({
      success: true,
      data: items,
      summary,
      meta: {
        page: pagination.page,
        pageSize: pagination.pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / pagination.pageSize)),
      },
    });
  })
);

router.get(
  "/invoices/:id",
  authorize("fees.read"),
  validateParams(idParams),
  asyncHandler(async (req, res) =>
    sendOk(
      res,
      await service.getInvoice(
        requireInstitution(req),
        requireAuthenticatedUser(req),
        req.params.id
      )
    )
  )
);

router.post(
  "/invoices/:id/cancel",
  authorize("fees.approve"),
  validateParams(idParams),
  validateBody(cancelInvoiceSchema),
  asyncHandler(async (req, res) =>
    sendOk(
      res,
      await service.cancelInvoice(
        requireInstitution(req),
        requireAuthenticatedUser(req),
        req.params.id,
        req.body.reason,
        auditMeta(req)
      )
    )
  )
);

// ---------- Late fees ----------

router.get(
  "/late-fee-rules",
  authorize("fees.read"),
  asyncHandler(async (req, res) =>
    sendOk(res, await service.listLateFeeRules(requireInstitution(req)))
  )
);

router.post(
  "/late-fee-rules",
  authorize("fees.manage"),
  validateBody(lateFeeRuleSchema),
  asyncHandler(async (req, res) =>
    sendOk(
      res,
      await service.createLateFeeRule(
        requireInstitution(req),
        requireAuthenticatedUser(req),
        req.body,
        auditMeta(req)
      ),
      201
    )
  )
);

router.post(
  "/late-fees/apply",
  authorize("fees.manage"),
  asyncHandler(async (req, res) =>
    sendOk(
      res,
      await service.applyLateFees(
        requireInstitution(req),
        requireAuthenticatedUser(req),
        auditMeta(req)
      )
    )
  )
);

// ---------- Payments ----------

router.post(
  "/payments/offline",
  authorize("fees.pay"),
  requireFeature("payments"),
  validateBody(offlinePaymentSchema),
  asyncHandler(async (req, res) =>
    sendOk(
      res,
      await service.recordOfflinePayment(
        requireInstitution(req),
        requireAuthenticatedUser(req),
        req.body,
        auditMeta(req)
      ),
      201
    )
  )
);

router.post(
  "/invoices/:id/checkout",
  authorize("fees.read"),
  requireFeature("payments"),
  validateParams(idParams),
  asyncHandler(async (req, res) =>
    sendOk(
      res,
      await service.createPaymentOrder(
        requireInstitution(req),
        requireAuthenticatedUser(req),
        req.params.id
      )
    )
  )
);

router.post(
  "/payments/confirm",
  authorize("fees.read"),
  requireFeature("payments"),
  validateBody(confirmPaymentSchema),
  asyncHandler(async (req, res) =>
    sendOk(
      res,
      await service.confirmPaymentOrder(
        requireInstitution(req),
        requireAuthenticatedUser(req),
        req.body,
        auditMeta(req)
      )
    )
  )
);

router.get(
  "/payments/:id/receipt",
  authorize("fees.read"),
  validateParams(idParams),
  asyncHandler(async (req, res) =>
    sendOk(
      res,
      await service.getReceipt(
        requireInstitution(req),
        requireAuthenticatedUser(req),
        req.params.id
      )
    )
  )
);

// ---------- Refunds ----------

router.get(
  "/refunds",
  authorize("fees.read"),
  validateQuery(refundListQuery),
  asyncHandler(async (req, res) => {
    const pagination = parsePagination(req);
    const { items, total } = await service.listRefunds(
      requireInstitution(req),
      requireAuthenticatedUser(req),
      pagination,
      { status: req.query.status as string | undefined }
    );
    sendPage(res, items, total, pagination);
  })
);

router.post(
  "/refunds",
  authorize("fees.refund"),
  validateBody(refundRequestSchema),
  asyncHandler(async (req, res) =>
    sendOk(
      res,
      await service.requestRefund(
        requireInstitution(req),
        requireAuthenticatedUser(req),
        req.body,
        auditMeta(req)
      ),
      201
    )
  )
);

router.patch(
  "/refunds/:id",
  authorize("fees.approve"),
  validateParams(idParams),
  validateBody(decideRefundSchema),
  asyncHandler(async (req, res) =>
    sendOk(
      res,
      await service.decideRefund(
        requireInstitution(req),
        requireAuthenticatedUser(req),
        req.params.id,
        req.body,
        auditMeta(req)
      )
    )
  )
);

// ---------- Reconciliation ----------

router.get(
  "/reconciliations",
  authorize("fees.reconcile"),
  asyncHandler(async (req, res) => {
    const pagination = parsePagination(req);
    const { items, total } = await service.listReconciliations(
      requireInstitution(req),
      requireAuthenticatedUser(req),
      pagination
    );
    sendPage(res, items, total, pagination);
  })
);

router.post(
  "/reconciliations",
  authorize("fees.reconcile"),
  validateBody(reconciliationSchema),
  asyncHandler(async (req, res) =>
    sendOk(
      res,
      await service.createReconciliation(
        requireInstitution(req),
        requireAuthenticatedUser(req),
        req.body,
        auditMeta(req)
      ),
      201
    )
  )
);

router.get(
  "/reconciliations/:id",
  authorize("fees.reconcile"),
  validateParams(idParams),
  asyncHandler(async (req, res) =>
    sendOk(
      res,
      await service.getReconciliation(
        requireInstitution(req),
        requireAuthenticatedUser(req),
        req.params.id
      )
    )
  )
);

// ---------- Student view ----------

router.get(
  "/students/:studentId",
  authorize("fees.read"),
  validateParams(studentIdParams),
  asyncHandler(async (req, res) =>
    sendOk(
      res,
      await service.getStudentFeeSummary(
        requireInstitution(req),
        requireAuthenticatedUser(req),
        req.params.studentId
      )
    )
  )
);

export default router;
