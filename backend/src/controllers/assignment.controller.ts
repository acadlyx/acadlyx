import { Request, Response } from "express";
import * as assignmentService from "../services/assignment.service";
import { AppError } from "../middleware/errorHandler";
import { asyncHandler } from "../utils/asyncHandler";
import { buildPaginationMeta, parsePagination } from "../utils/pagination";
import { requireInstitution } from "../utils/requireInstitution";
import {
  CreateAssignmentInput,
  ReviewSubmissionInput,
  SubmitAssignmentInput,
  UpdateAssignmentInput,
} from "../validators/assignment.validators";

function requireUser(req: Request) {
  if (!req.user) throw new AppError("Authentication required", 401);
  return req.user;
}

export const list = asyncHandler(async (req: Request, res: Response) => {
  const institutionId = requireInstitution(req);
  const user = requireUser(req);
  const pagination = parsePagination(req);
  const search = (req.query.search as string | undefined) || undefined;
  const courseOfferingId =
    (req.query.courseOfferingId as string | undefined) || undefined;
  const status = (req.query.status as "DRAFT" | "PUBLISHED" | undefined) || undefined;

  const { items, total } = await assignmentService.listAssignments(institutionId, user, {
    ...pagination,
    search,
    courseOfferingId,
    status,
  });

  res.status(200).json({
    success: true,
    data: items,
    meta: buildPaginationMeta(total, pagination),
  });
});

export const getById = asyncHandler(async (req: Request, res: Response) => {
  const institutionId = requireInstitution(req);
  const user = requireUser(req);
  const assignment = await assignmentService.getAssignmentById(
    institutionId,
    user,
    req.params.id
  );
  res.status(200).json({ success: true, data: assignment });
});

export const create = asyncHandler(async (req: Request, res: Response) => {
  const institutionId = requireInstitution(req);
  const user = requireUser(req);
  const assignment = await assignmentService.createAssignment(
    institutionId,
    user,
    req.body as CreateAssignmentInput
  );
  res.status(201).json({ success: true, data: assignment });
});

export const update = asyncHandler(async (req: Request, res: Response) => {
  const institutionId = requireInstitution(req);
  const user = requireUser(req);
  const assignment = await assignmentService.updateAssignment(
    institutionId,
    user,
    req.params.id,
    req.body as UpdateAssignmentInput
  );
  res.status(200).json({ success: true, data: assignment });
});

export const submissions = asyncHandler(async (req: Request, res: Response) => {
  const institutionId = requireInstitution(req);
  const user = requireUser(req);
  const result = await assignmentService.getSubmissionsForAssignment(
    institutionId,
    user,
    req.params.id
  );
  res.status(200).json({ success: true, data: result });
});

export const submit = asyncHandler(async (req: Request, res: Response) => {
  const institutionId = requireInstitution(req);
  const user = requireUser(req);
  const submission = await assignmentService.submitAssignment(
    institutionId,
    user,
    req.params.id,
    req.body as SubmitAssignmentInput
  );
  res.status(200).json({ success: true, data: submission });
});

export const review = asyncHandler(async (req: Request, res: Response) => {
  const institutionId = requireInstitution(req);
  const user = requireUser(req);
  const submission = await assignmentService.reviewSubmission(
    institutionId,
    user,
    req.params.id,
    req.params.studentId,
    req.body as ReviewSubmissionInput
  );
  res.status(200).json({ success: true, data: submission });
});
