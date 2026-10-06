import { Router } from "express";
import { authenticate } from "../middleware/authenticate";
import { authorize } from "../middleware/authorize";
import { requireFeature } from "../middleware/requireFeature";
import { validateBody, validateQuery, validateParams } from "../middleware/validate";
import { asyncHandler } from "../utils/asyncHandler";
import { buildPaginationMeta, parsePagination } from "../utils/pagination";
import { sendOk, searchTerm } from "../utils/http";
import { requireAuthenticatedUser, requireInstitution } from "../utils/requireInstitution";
import { idParams } from "../validators/common";
import {
  enrollmentRequestListQuery,
  submitEnrollmentRequestSchema,
  decideEnrollmentRequestSchema,
  bulkEnrollmentDecisionSchema,
} from "../validators/enrollmentRequest.validators";
import * as service from "../services/enrollmentRequest.service";

const router = Router();
router.use(authenticate, requireFeature("students"));

router.get("/mine", authorize("enrollment.read"), asyncHandler(async (req,res) =>
  sendOk(res, await service.getMyEnrollmentWorkflow(requireInstitution(req), requireAuthenticatedUser(req)))
));

router.get("/eligible-contexts", authorize("enrollment.submit"), asyncHandler(async (req,res) =>
  sendOk(res, await service.listEligibleContexts(requireInstitution(req), requireAuthenticatedUser(req).id))
));

router.post("/", authorize("enrollment.submit"), validateBody(submitEnrollmentRequestSchema), asyncHandler(async (req,res) =>
  sendOk(res, await service.submitEnrollmentRequest(requireInstitution(req), requireAuthenticatedUser(req), req.body), 201)
));

router.get("/", authorize("enrollment.read"), validateQuery(enrollmentRequestListQuery), asyncHandler(async (req,res) => {
  const pagination = parsePagination(req);
  const result = await service.listEnrollmentRequests(requireInstitution(req), requireAuthenticatedUser(req), pagination, {
    status: typeof req.query.status === "string" ? req.query.status : undefined,
    programId: typeof req.query.programId === "string" ? req.query.programId : undefined,
    academicYearId: typeof req.query.academicYearId === "string" ? req.query.academicYearId : undefined,
    semesterId: typeof req.query.semesterId === "string" ? req.query.semesterId : undefined,
    sectionId: typeof req.query.sectionId === "string" ? req.query.sectionId : undefined,
    search: searchTerm(req.query.search),
  });
  return res.status(200).json({ success: true, data: result.items, meta: buildPaginationMeta(result.total, pagination) });
}));

router.post("/bulk-decision", authorize("enrollment.approve"), validateBody(bulkEnrollmentDecisionSchema), asyncHandler(async(req,res) =>
  sendOk(res, await service.bulkDecideEnrollmentRequests(requireInstitution(req), requireAuthenticatedUser(req), req.body.requestIds, req.body.decision, req.body.reason))
));

router.post("/:id/decision", authorize("enrollment.approve"), validateParams(idParams), validateBody(decideEnrollmentRequestSchema), asyncHandler(async(req,res) =>
  sendOk(res, await service.decideEnrollmentRequest(requireInstitution(req), requireAuthenticatedUser(req), req.params.id, req.body.decision, req.body.reason))
));

export default router;
