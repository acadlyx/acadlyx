import { Router } from "express";

import { authenticate } from "../middleware/authenticate";
import { authorize } from "../middleware/authorize";
import { validateBody, validateParams } from "../middleware/validate";
import * as service from "../services/subscriptionPlan.service";
import { asyncHandler } from "../utils/asyncHandler";
import { auditMeta, sendOk } from "../utils/http";
import { requireAuthenticatedUser } from "../utils/requireInstitution";
import {
  assignPlanSchema,
  institutionIdParams,
  planSchema,
  tenantStatusSchema,
} from "../validators/coreErp.validators";

/** Platform-level SaaS administration. */
const router = Router();

router.use(authenticate);

router.get(
  "/plans",
  asyncHandler(async (req, res) =>
    // The catalogue itself is not sensitive: an institution admin needs
    // it to see what their tenant could be upgraded to.
    sendOk(res, await service.listPlans(req.query.includeInactive === "true"))
  )
);

router.put(
  "/plans",
  authorize("plans.manage"),
  validateBody(planSchema),
  asyncHandler(async (req, res) =>
    sendOk(
      res,
      await service.upsertPlan(
        requireAuthenticatedUser(req),
        req.body,
        auditMeta(req)
      )
    )
  )
);

router.post(
  "/tenants/plan",
  authorize("plans.manage"),
  validateBody(assignPlanSchema),
  asyncHandler(async (req, res) =>
    sendOk(
      res,
      await service.assignPlan(
        requireAuthenticatedUser(req),
        req.body,
        auditMeta(req)
      )
    )
  )
);

router.post(
  "/tenants/status",
  authorize("plans.manage"),
  validateBody(tenantStatusSchema),
  asyncHandler(async (req, res) =>
    sendOk(
      res,
      await service.changeTenantStatus(
        requireAuthenticatedUser(req),
        req.body,
        auditMeta(req)
      )
    )
  )
);

router.get(
  "/tenants/:institutionId",
  validateParams(institutionIdParams),
  asyncHandler(async (req, res) =>
    sendOk(
      res,
      await service.getTenantLifecycle(
        requireAuthenticatedUser(req),
        req.params.institutionId
      )
    )
  )
);

router.post(
  "/tenants/expire-lapsed",
  authorize("plans.manage"),
  asyncHandler(async (req, res) =>
    sendOk(
      res,
      await service.expireLapsedTenants(
        requireAuthenticatedUser(req),
        auditMeta(req)
      )
    )
  )
);

export default router;
