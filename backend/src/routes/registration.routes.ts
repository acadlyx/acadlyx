import { Router } from "express";
import { authenticate } from "../middleware/authenticate";
import { authorize } from "../middleware/authorize";
import { requireFeature } from "../middleware/requireFeature";
import {
  validateBody,
  validateParams,
  validateQuery,
} from "../middleware/validate";
import * as service from "../services/registration.service";
import { asyncHandler } from "../utils/asyncHandler";
import { auditMeta, searchTerm, sendOk } from "../utils/http";
import { buildPaginationMeta, parsePagination } from "../utils/pagination";
import {
  requireAuthenticatedUser,
  requireInstitution,
} from "../utils/requireInstitution";
import { idParams } from "../validators/common";
import {
  availableOfferingsQuery,
  decideRegistrationSchema,
  dropSchema,
  offeringCapacitySchema,
  registerSchema,
  registrationListQuery,
} from "../validators/registration.validators";

const router = Router();

router.use(authenticate, requireFeature("registration"));

router.get(
  "/offerings/available",
  authorize("registration.submit"),
  validateQuery(availableOfferingsQuery),
  asyncHandler(async (req, res) => {
    const pagination = parsePagination(req);
    const actor = requireAuthenticatedUser(req);
    const { items, total, enrollment } = await service.listAvailableOfferings(
      requireInstitution(req),
      actor,
      actor.id,
      pagination,
      {
        semesterId:
          typeof req.query.semesterId === "string" ? req.query.semesterId : undefined,
        electivesOnly: req.query.electivesOnly === "true",
        search: searchTerm(req.query.search),
      }
    );
    res.status(200).json({
      success: true,
      data: items,
      enrollment,
      meta: buildPaginationMeta(total, pagination),
    });
  })
);

router.get(
  "/mine",
  authorize("registration.submit"),
  asyncHandler(async (req, res) =>
    sendOk(
      res,
      await service.getMyRegistrationSummary(
        requireInstitution(req),
        requireAuthenticatedUser(req).id
      )
    )
  )
);

router.get(
  "/",
  authorize("registration.read"),
  validateQuery(registrationListQuery),
  asyncHandler(async (req, res) => {
    const pagination = parsePagination(req);
    const { items, total, summary } = await service.listRegistrations(
      requireInstitution(req),
      requireAuthenticatedUser(req),
      pagination,
      {
        status: typeof req.query.status === "string" ? req.query.status : undefined,
        courseOfferingId:
          typeof req.query.courseOfferingId === "string"
            ? req.query.courseOfferingId
            : undefined,
        studentId:
          typeof req.query.studentId === "string" ? req.query.studentId : undefined,
        semesterId:
          typeof req.query.semesterId === "string" ? req.query.semesterId : undefined,
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

router.post(
  "/",
  authorize("registration.submit"),
  validateBody(registerSchema),
  asyncHandler(async (req, res) =>
    sendOk(
      res,
      await service.register(
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
  "/:id/drop",
  authorize("registration.submit"),
  validateParams(idParams),
  validateBody(dropSchema),
  asyncHandler(async (req, res) =>
    sendOk(
      res,
      await service.drop(
        requireInstitution(req),
        requireAuthenticatedUser(req),
        req.params.id,
        req.body.reason,
        auditMeta(req)
      )
    )
  )
);

router.post(
  "/:id/decision",
  authorize("registration.approve"),
  validateParams(idParams),
  validateBody(decideRegistrationSchema),
  asyncHandler(async (req, res) =>
    sendOk(
      res,
      await service.decide(
        requireInstitution(req),
        requireAuthenticatedUser(req),
        req.params.id,
        req.body.decision,
        req.body.remarks,
        auditMeta(req)
      )
    )
  )
);

router.patch(
  "/offerings/:id",
  authorize("registration.approve"),
  validateParams(idParams),
  validateBody(offeringCapacitySchema),
  asyncHandler(async (req, res) =>
    sendOk(
      res,
      await service.updateOfferingCapacity(
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
