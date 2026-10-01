import { Router } from "express";

import { authenticate } from "../middleware/authenticate";
import { authorize } from "../middleware/authorize";
import { requireFeature } from "../middleware/requireFeature";
import {
  validateBody,
  validateParams,
  validateQuery,
} from "../middleware/validate";
import * as service from "../services/operations.service";
import { asyncHandler } from "../utils/asyncHandler";
import { auditMeta, searchTerm, sendOk, sendPage } from "../utils/http";
import { parsePagination } from "../utils/pagination";
import {
  requireAuthenticatedUser,
  requireInstitution,
} from "../utils/requireInstitution";
import { idParams } from "../validators/common";
import {
  assetCategorySchema,
  assetListQuery,
  createAssetSchema,
  createFacilitySchema,
  createMaintenanceSchema,
  facilityListQuery,
  maintenanceListQuery,
  updateAssetSchema,
  updateFacilitySchema,
  updateMaintenanceSchema,
} from "../validators/coreErp.validators";

/** Assets, facilities and the maintenance queue. */
const router = Router();

router.use(authenticate, requireFeature("operations"));

router.get(
  "/summary",
  authorize("operations.read"),
  asyncHandler(async (req, res) =>
    sendOk(res, await service.getOperationsSummary(requireInstitution(req)))
  )
);

// ---------- Asset categories ----------

router.get(
  "/asset-categories",
  authorize("operations.read"),
  asyncHandler(async (req, res) =>
    sendOk(res, await service.listAssetCategories(requireInstitution(req)))
  )
);

router.post(
  "/asset-categories",
  authorize("operations.manage"),
  validateBody(assetCategorySchema),
  asyncHandler(async (req, res) =>
    sendOk(
      res,
      await service.createAssetCategory(
        requireInstitution(req),
        requireAuthenticatedUser(req),
        req.body,
        auditMeta(req)
      ),
      201
    )
  )
);

// ---------- Assets ----------

router.get(
  "/assets",
  authorize("operations.read"),
  validateQuery(assetListQuery),
  asyncHandler(async (req, res) => {
    const pagination = parsePagination(req);
    const { items, total } = await service.listAssets(
      requireInstitution(req),
      requireAuthenticatedUser(req),
      pagination,
      {
        search: searchTerm(req.query.search),
        status: req.query.status as string | undefined,
        assetCategoryId: req.query.assetCategoryId as string | undefined,
        departmentId: req.query.departmentId as string | undefined,
      }
    );
    sendPage(res, items, total, pagination);
  })
);

router.post(
  "/assets",
  authorize("operations.manage"),
  validateBody(createAssetSchema),
  asyncHandler(async (req, res) =>
    sendOk(
      res,
      await service.createAsset(
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
  "/assets/:id",
  authorize("operations.manage"),
  validateParams(idParams),
  validateBody(updateAssetSchema),
  asyncHandler(async (req, res) =>
    sendOk(
      res,
      await service.updateAsset(
        requireInstitution(req),
        requireAuthenticatedUser(req),
        req.params.id,
        req.body,
        auditMeta(req)
      )
    )
  )
);

// ---------- Facilities ----------

router.get(
  "/facilities",
  authorize("operations.read"),
  validateQuery(facilityListQuery),
  asyncHandler(async (req, res) =>
    sendOk(
      res,
      await service.listFacilities(requireInstitution(req), {
        includeInactive: req.query.includeInactive === "true",
        facilityType: req.query.facilityType as string | undefined,
        search: searchTerm(req.query.search),
      })
    )
  )
);

router.post(
  "/facilities",
  authorize("operations.manage"),
  validateBody(createFacilitySchema),
  asyncHandler(async (req, res) =>
    sendOk(
      res,
      await service.createFacility(
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
  "/facilities/:id",
  authorize("operations.manage"),
  validateParams(idParams),
  validateBody(updateFacilitySchema),
  asyncHandler(async (req, res) =>
    sendOk(
      res,
      await service.updateFacility(
        requireInstitution(req),
        requireAuthenticatedUser(req),
        req.params.id,
        req.body,
        auditMeta(req)
      )
    )
  )
);

// ---------- Maintenance ----------

/*
 * Reading the maintenance queue is a *read* capability.
 *
 * This was gated by `maintenance.raise`, which denied the queue to
 * every role that oversees or triages it (DIRECTOR, CHAIRMAN, DEAN)
 * and to the operations manager itself (IT) — none of whom hold
 * `maintenance.raise` — so GET /operations/maintenance returned 403
 * and the Operations page could not render the queue for them.
 *
 * Row visibility is already scoped in the service: only triagers
 * (OPS_MANAGER_ROLES or operations.manage) see the whole queue;
 * everyone else sees just the requests they raised or are assigned
 * to.
 */
router.get(
  "/maintenance",
  authorize("operations.read"),
  validateQuery(maintenanceListQuery),
  asyncHandler(async (req, res) => {
    const pagination = parsePagination(req);
    const { items, total } = await service.listMaintenanceRequests(
      requireInstitution(req),
      requireAuthenticatedUser(req),
      pagination,
      {
        status: req.query.status as string | undefined,
        priority: req.query.priority as string | undefined,
        mine: req.query.mine === "true",
        assignedToMe: req.query.assignedToMe === "true",
      }
    );
    sendPage(res, items, total, pagination);
  })
);

router.post(
  "/maintenance",
  authorize("maintenance.raise"),
  validateBody(createMaintenanceSchema),
  asyncHandler(async (req, res) =>
    sendOk(
      res,
      await service.createMaintenanceRequest(
        requireInstitution(req),
        requireAuthenticatedUser(req),
        req.body,
        auditMeta(req)
      ),
      201
    )
  )
);

/*
 * Triaging a request (status, reassignment, reprioritisation) is an
 * operations-management action. The service re-checks authority and
 * additionally lets an assignee progress their own job, so this gate
 * only has to admit the management capability — not every role that
 * can raise a fault.
 */
router.patch(
  "/maintenance/:id",
  authorize("operations.manage"),
  validateParams(idParams),
  validateBody(updateMaintenanceSchema),
  asyncHandler(async (req, res) =>
    sendOk(
      res,
      await service.updateMaintenanceRequest(
        requireInstitution(req),
        requireAuthenticatedUser(req),
        req.params.id,
        req.body,
        auditMeta(req)
      )
    )
  )
);

export default router;
