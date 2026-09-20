import { Router } from "express";
import { authenticate } from "../middleware/authenticate";
import { authorize } from "../middleware/authorize";
import { requireFeature } from "../middleware/requireFeature";
import {
  validateBody,
  validateParams,
  validateQuery,
} from "../middleware/validate";
import * as service from "../services/movement.service";
import { asyncHandler } from "../utils/asyncHandler";
import { auditMeta, searchTerm, sendOk } from "../utils/http";
import { buildPaginationMeta, parsePagination } from "../utils/pagination";
import {
  requireAuthenticatedUser,
  requireInstitution,
} from "../utils/requireInstitution";
import { idParams } from "../validators/common";
import {
  bulkPromotionSchema,
  createMovementSchema,
  decideMovementSchema,
  movementListQuery,
} from "../validators/movement.validators";

const router = Router();

router.use(authenticate, requireFeature("promotions"));

router.get(
  "/requests",
  authorize("promotions.read"),
  validateQuery(movementListQuery),
  asyncHandler(async (req, res) => {
    const pagination = parsePagination(req);
    const { items, total, summary } = await service.listRequests(
      requireInstitution(req),
      pagination,
      {
        status: typeof req.query.status === "string" ? req.query.status : undefined,
        requestType:
          typeof req.query.requestType === "string" ? req.query.requestType : undefined,
        studentId:
          typeof req.query.studentId === "string" ? req.query.studentId : undefined,
        search: searchTerm(req.query.search),
      }
    );
    res.status(200).json({
      success: true,
      data: items,
      summary,
      meta: buildPaginationMeta(total, pagination),
    });
  })
);

router.get(
  "/candidates",
  authorize("promotions.read"),
  asyncHandler(async (req, res) =>
    sendOk(
      res,
      await service.listPromotionCandidates(requireInstitution(req), {
        academicYearId:
          typeof req.query.academicYearId === "string"
            ? req.query.academicYearId
            : undefined,
        programId:
          typeof req.query.programId === "string" ? req.query.programId : undefined,
        sectionId:
          typeof req.query.sectionId === "string" ? req.query.sectionId : undefined,
      })
    )
  )
);

router.get(
  "/students/:id/history",
  authorize("promotions.read"),
  validateParams(idParams),
  asyncHandler(async (req, res) =>
    sendOk(
      res,
      await service.getStudentHistory(
        requireInstitution(req),
        requireAuthenticatedUser(req),
        req.params.id
      )
    )
  )
);

router.post(
  "/requests",
  authorize("promotions.manage"),
  validateBody(createMovementSchema),
  asyncHandler(async (req, res) =>
    sendOk(
      res,
      await service.createRequest(
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
  "/requests/bulk-promotion",
  authorize("promotions.manage"),
  validateBody(bulkPromotionSchema),
  asyncHandler(async (req, res) =>
    sendOk(
      res,
      await service.bulkPromote(
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
  "/requests/:id/decision",
  authorize("promotions.approve"),
  validateParams(idParams),
  validateBody(decideMovementSchema),
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

export default router;
