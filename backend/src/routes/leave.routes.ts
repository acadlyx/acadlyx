import { Router } from "express";
import { authenticate } from "../middleware/authenticate";
import { authorize } from "../middleware/authorize";
import { requireFeature } from "../middleware/requireFeature";
import { validateBody, validateParams, validateQuery } from "../middleware/validate";
import * as service from "../services/leave.service";
import { asyncHandler } from "../utils/asyncHandler";
import { auditMeta, sendOk } from "../utils/http";
import { buildPaginationMeta, parsePagination } from "../utils/pagination";
import { requireAuthenticatedUser, requireInstitution } from "../utils/requireInstitution";
import { idParams } from "../validators/common";
import {
  applyLeaveSchema,
  createLeaveTypeSchema,
  decideLeaveSchema,
  leaveListQuery,
  updateLeaveTypeSchema,
} from "../validators/leave.validators";

const router = Router();

router.use(authenticate, requireFeature("leave"));

const filtersOf = (query: Record<string, unknown>) => ({
  status: typeof query.status === "string" ? query.status : undefined,
  leaveTypeId: typeof query.leaveTypeId === "string" ? query.leaveTypeId : undefined,
});

router.get(
  "/types",
  authorize("leave.apply"),
  asyncHandler(async (req, res) =>
    sendOk(
      res,
      await service.listLeaveTypes(
        requireInstitution(req),
        requireAuthenticatedUser(req),
        false
      )
    )
  )
);

router.get(
  "/types/manage",
  authorize("leave.manage"),
  asyncHandler(async (req, res) =>
    sendOk(
      res,
      await service.listLeaveTypes(
        requireInstitution(req),
        requireAuthenticatedUser(req),
        true
      )
    )
  )
);

router.post(
  "/types",
  authorize("leave.manage"),
  validateBody(createLeaveTypeSchema),
  asyncHandler(async (req, res) =>
    sendOk(
      res,
      await service.createLeaveType(
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
  "/types/:id",
  authorize("leave.manage"),
  validateParams(idParams),
  validateBody(updateLeaveTypeSchema),
  asyncHandler(async (req, res) =>
    sendOk(
      res,
      await service.updateLeaveType(
        requireInstitution(req),
        requireAuthenticatedUser(req),
        req.params.id,
        req.body,
        auditMeta(req)
      )
    )
  )
);

router.get(
  "/balances",
  authorize("leave.apply"),
  asyncHandler(async (req, res) =>
    sendOk(res, await service.getBalances(requireInstitution(req), requireAuthenticatedUser(req)))
  )
);

router.post(
  "/requests",
  authorize("leave.apply"),
  validateBody(applyLeaveSchema),
  asyncHandler(async (req, res) =>
    sendOk(
      res,
      await service.applyLeave(
        requireInstitution(req),
        requireAuthenticatedUser(req),
        req.body,
        auditMeta(req)
      ),
      201
    )
  )
);

function paged(
  fetch: (
    req: Parameters<typeof parsePagination>[0]
  ) => Promise<{ items: unknown[]; total: number }>
) {
  return asyncHandler(async (req, res) => {
    const pagination = parsePagination(req);
    const { items, total } = await fetch(req);
    res.status(200).json({
      success: true,
      data: items,
      meta: buildPaginationMeta(total, pagination),
    });
  });
}

router.get(
  "/requests/mine",
  authorize("leave.apply"),
  validateQuery(leaveListQuery),
  paged((req) =>
    service.listMine(
      requireInstitution(req),
      requireAuthenticatedUser(req),
      parsePagination(req),
      filtersOf(req.query)
    )
  )
);

router.get(
  "/requests/approvals",
  authorize("leave.approve"),
  validateQuery(leaveListQuery),
  paged((req) =>
    service.listApprovals(
      requireInstitution(req),
      requireAuthenticatedUser(req),
      parsePagination(req),
      filtersOf(req.query)
    )
  )
);

router.get(
  "/requests/all",
  authorize("leave.read"),
  validateQuery(leaveListQuery),
  paged((req) =>
    service.listAll(requireInstitution(req), parsePagination(req), filtersOf(req.query))
  )
);

router.post(
  "/requests/:id/decision",
  authorize("leave.approve"),
  validateParams(idParams),
  validateBody(decideLeaveSchema),
  asyncHandler(async (req, res) =>
    sendOk(
      res,
      await service.decide(
        requireInstitution(req),
        requireAuthenticatedUser(req),
        req.params.id,
        req.body.decision,
        req.body.note,
        auditMeta(req)
      )
    )
  )
);

router.post(
  "/requests/:id/cancel",
  authorize("leave.apply"),
  validateParams(idParams),
  asyncHandler(async (req, res) =>
    sendOk(
      res,
      await service.cancel(
        requireInstitution(req),
        requireAuthenticatedUser(req),
        req.params.id,
        auditMeta(req)
      )
    )
  )
);

export default router;
