import { Request } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { requireInstitution } from "../utils/requireInstitution";
import { AppError } from "../middleware/errorHandler";
import * as service from "../services/obe.service";

function user(req: Request) {
  if (!req.user) throw new AppError("Authentication required", 401);
  return req.user;
}

export const courseOfferings = asyncHandler(async (req, res) => res.json({ success: true, data: await service.listCourseOfferings(requireInstitution(req), user(req)) }));
export const programmeOutcomes = asyncHandler(async (req, res) => res.json({ success: true, data: await service.listProgrammeOutcomes(requireInstitution(req), user(req), req.params.programId) }));
export const createProgrammeOutcome = asyncHandler(async (req, res) => res.status(201).json({ success: true, data: await service.createProgrammeOutcome(requireInstitution(req), user(req), req.params.programId, req.body) }));
export const updateProgrammeOutcome = asyncHandler(async (req, res) => res.json({ success: true, data: await service.updateProgrammeOutcome(requireInstitution(req), user(req), req.params.id, req.body) }));
export const courseOutcomes = asyncHandler(async (req, res) => res.json({ success: true, data: await service.listCourseOutcomes(requireInstitution(req), user(req), req.params.courseId) }));
export const createCourseOutcome = asyncHandler(async (req, res) => res.status(201).json({ success: true, data: await service.createCourseOutcome(requireInstitution(req), user(req), req.params.courseId, req.body) }));
export const updateCourseOutcome = asyncHandler(async (req, res) => res.json({ success: true, data: await service.updateCourseOutcome(requireInstitution(req), user(req), req.params.id, req.body) }));
export const mapping = asyncHandler(async (req, res) => res.json({ success: true, data: await service.getMapping(requireInstitution(req), user(req), req.params.courseOfferingId) }));
export const replaceMapping = asyncHandler(async (req, res) => res.json({ success: true, data: await service.replaceMapping(requireInstitution(req), user(req), req.params.courseOfferingId, req.body) }));
export const submitMapping = asyncHandler(async (req, res) => res.json({ success: true, data: await service.submitMapping(requireInstitution(req), user(req), req.params.courseOfferingId) }));
export const approveMapping = asyncHandler(async (req, res) => res.json({ success: true, data: await service.reviewMapping(requireInstitution(req), user(req), req.params.courseOfferingId, "APPROVED") }));
export const returnMapping = asyncHandler(async (req, res) => res.json({ success: true, data: await service.reviewMapping(requireInstitution(req), user(req), req.params.courseOfferingId, "RETURNED") }));
export const assessments = asyncHandler(async (req, res) => res.json({ success: true, data: await service.listAssessments(requireInstitution(req), user(req), req.params.courseOfferingId) }));
export const createAssessment = asyncHandler(async (req, res) => res.status(201).json({ success: true, data: await service.createAssessment(requireInstitution(req), user(req), req.body) }));
export const updateAssessment = asyncHandler(async (req, res) => res.json({ success: true, data: await service.updateAssessment(requireInstitution(req), user(req), req.params.assessmentId, req.body) }));
export const replaceAssessmentItems = asyncHandler(async (req, res) => res.json({ success: true, data: await service.replaceAssessmentItems(requireInstitution(req), user(req), req.params.assessmentId, req.body) }));
export const assessmentItemScores = asyncHandler(async (req, res) => res.json({ success: true, data: await service.getAssessmentItemScores(requireInstitution(req), user(req), req.params.assessmentItemId) }));
export const replaceItemScores = asyncHandler(async (req, res) => res.json({ success: true, data: await service.replaceItemScores(requireInstitution(req), user(req), req.params.assessmentItemId, req.body) }));
export const calculateAttainment = asyncHandler(async (req, res) => res.json({ success: true, data: await service.calculateAttainment(requireInstitution(req), user(req), req.params.courseOfferingId, req.body) }));
export const attainment = asyncHandler(async (req, res) => res.json({ success: true, data: await service.getAttainment(requireInstitution(req), user(req), req.params.courseOfferingId) }));
export const policies = asyncHandler(async (req, res) => res.json({ success: true, data: await service.listPolicies(requireInstitution(req), user(req)) }));
export const createPolicy = asyncHandler(async (req, res) => res.status(201).json({ success: true, data: await service.createPolicy(requireInstitution(req), user(req), req.body) }));
export const updatePolicy = asyncHandler(async (req, res) => res.json({ success: true, data: await service.updatePolicy(requireInstitution(req), user(req), req.params.id, req.body) }));
export const calculateProgrammeAttainment = asyncHandler(async (req, res) => res.json({ success: true, data: await service.calculateProgrammeAttainment(requireInstitution(req), user(req), req.body) }));
export const createRun = asyncHandler(async (req, res) => res.status(201).json({ success: true, data: await service.createRun(requireInstitution(req), user(req), req.body) }));
