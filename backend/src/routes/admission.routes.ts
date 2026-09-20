import { Router } from "express";
import { authenticate } from "../middleware/authenticate";
import { authorize } from "../middleware/authorize";
import { requireFeature } from "../middleware/requireFeature";
import {
  validateBody,
  validateParams,
  validateQuery,
} from "../middleware/validate";
import * as service from "../services/admission.service";
import { asyncHandler } from "../utils/asyncHandler";
import { auditMeta, searchTerm, sendOk } from "../utils/http";
import { parsePagination } from "../utils/pagination";
import { requireAuthenticatedUser, requireInstitution } from "../utils/requireInstitution";
import {
  admissionEnrollSchema,
  admissionListQuery,
  admissionStatusSchema,
  createAdmissionSchema,
  updateAdmissionSchema,
} from "../validators/admission.validators";
import { idParams } from "../validators/common";

const router = Router();

router.use(authenticate, requireFeature("admissions"));

router.get(
  "/",
  authorize("admissions.read"),
  validateQuery(admissionListQuery),
  asyncHandler(async (req, res) => {
    const pagination = parsePagination(req);
    const { items, total, summary } = await service.listApplications(
      requireInstitution(req),
      pagination,
      {
        search: searchTerm(req.query.search),
        status: typeof req.query.status === "string" ? req.query.status : undefined,
        programId: typeof req.query.programId === "string" ? req.query.programId : undefined,
        academicYearId:
          typeof req.query.academicYearId === "string" ? req.query.academicYearId : undefined,
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
  "/:id",
  authorize("admissions.read"),
  validateParams(idParams),
  asyncHandler(async (req, res) =>
    sendOk(res, await service.getApplication(requireInstitution(req), req.params.id))
  )
);

router.post(
  "/",
  authorize("admissions.manage"),
  validateBody(createAdmissionSchema),
  asyncHandler(async (req, res) =>
    sendOk(
      res,
      await service.createApplication(
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
  "/:id",
  authorize("admissions.manage"),
  validateParams(idParams),
  validateBody(updateAdmissionSchema),
  asyncHandler(async (req, res) =>
    sendOk(
      res,
      await service.updateApplication(
        requireInstitution(req),
        requireAuthenticatedUser(req),
        req.params.id,
        req.body,
        auditMeta(req)
      )
    )
  )
);

router.post(
  "/:id/status",
  authorize("admissions.manage"),
  validateParams(idParams),
  validateBody(admissionStatusSchema),
  asyncHandler(async (req, res) =>
    sendOk(
      res,
      await service.changeStatus(
        requireInstitution(req),
        requireAuthenticatedUser(req),
        req.params.id,
        req.body.status,
        req.body.remarks,
        auditMeta(req)
      )
    )
  )
);

router.post(
  "/:id/enroll",
  authorize("admissions.manage", "students.create"),
  validateParams(idParams),
  validateBody(admissionEnrollSchema),
  asyncHandler(async (req, res) =>
    sendOk(
      res,
      await service.enrollApplicant(
        requireInstitution(req),
        requireAuthenticatedUser(req),
        req.params.id,
        req.body,
        auditMeta(req)
      ),
      201
    )
  )
);


export default router;
