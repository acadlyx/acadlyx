import { Router } from "express";
import { authenticate } from "../middleware/authenticate";
import { authorize } from "../middleware/authorize";
import { requireFeature } from "../middleware/requireFeature";
import { validateBody, validateParams, validateQuery } from "../middleware/validate";
import * as service from "../services/hr.service";
import { asyncHandler } from "../utils/asyncHandler";
import { auditMeta, searchTerm, sendOk } from "../utils/http";
import { parsePagination } from "../utils/pagination";
import { requireAuthenticatedUser, requireInstitution } from "../utils/requireInstitution";
import { idParams } from "../validators/common";
import {
  createEmployeeSchema,
  employeeListQuery,
  updateEmployeeSchema,
} from "../validators/hr.validators";

const router = Router();

router.use(authenticate, requireFeature("hr"));

/** Own employee record — self scope only, no permission grant needed. */
router.get(
  "/me",
  asyncHandler(async (req, res) =>
    sendOk(
      res,
      await service.getMyProfile(requireInstitution(req), requireAuthenticatedUser(req).id)
    )
  )
);

router.get(
  "/eligible-users",
  authorize("hr.manage"),
  asyncHandler(async (req, res) =>
    sendOk(res, await service.listEligibleUsers(requireInstitution(req)))
  )
);

router.get(
  "/employees",
  authorize("hr.read"),
  validateQuery(employeeListQuery),
  asyncHandler(async (req, res) => {
    const pagination = parsePagination(req);
    const { items, total, summary } = await service.listEmployees(
      requireInstitution(req),
      pagination,
      {
        search: searchTerm(req.query.search),
        departmentId:
          typeof req.query.departmentId === "string" ? req.query.departmentId : undefined,
        status: typeof req.query.status === "string" ? req.query.status : undefined,
        employmentType:
          typeof req.query.employmentType === "string" ? req.query.employmentType : undefined,
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
  "/employees/:id",
  authorize("hr.read"),
  validateParams(idParams),
  asyncHandler(async (req, res) =>
    sendOk(res, await service.getEmployee(requireInstitution(req), req.params.id))
  )
);

router.post(
  "/employees",
  authorize("hr.manage"),
  validateBody(createEmployeeSchema),
  asyncHandler(async (req, res) =>
    sendOk(
      res,
      await service.createEmployee(
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
  "/employees/:id",
  authorize("hr.manage"),
  validateParams(idParams),
  validateBody(updateEmployeeSchema),
  asyncHandler(async (req, res) =>
    sendOk(
      res,
      await service.updateEmployee(
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
