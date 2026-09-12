import { Request, Response } from "express";
import * as courseOfferingService from "../services/courseOffering.service";
import { AppError } from "../middleware/errorHandler";
import { asyncHandler } from "../utils/asyncHandler";
import { buildPaginationMeta, parsePagination } from "../utils/pagination";
import { requireInstitution } from "../utils/requireInstitution";
import {
  CreateCourseOfferingInput,
  UpdateCourseOfferingInput,
} from "../validators/courseOffering.validators";

function requireUser(req: Request) {
  if (!req.user) throw new AppError("Authentication required", 401);
  return req.user;
}

export const list = asyncHandler(async (req: Request, res: Response) => {
  const institutionId = requireInstitution(req);
  const pagination = parsePagination(req);
  const courseId = (req.query.courseId as string | undefined) || undefined;
  const semesterId = (req.query.semesterId as string | undefined) || undefined;
  const sectionId = (req.query.sectionId as string | undefined) || undefined;
  const facultyId = (req.query.facultyId as string | undefined) || undefined;
  const isActive =
    req.query.isActive === undefined ? undefined : req.query.isActive === "true";

  const { items, total } = await courseOfferingService.listCourseOfferings(
    institutionId,
    { ...pagination, courseId, semesterId, sectionId, facultyId, isActive }
  );

  res.status(200).json({
    success: true,
    data: items,
    meta: buildPaginationMeta(total, pagination),
  });
});

export const getById = asyncHandler(async (req: Request, res: Response) => {
  const institutionId = requireInstitution(req);
  const offering = await courseOfferingService.getCourseOfferingById(
    institutionId,
    req.params.id
  );
  res.status(200).json({ success: true, data: offering });
});

export const create = asyncHandler(async (req: Request, res: Response) => {
  const institutionId = requireInstitution(req);
  const offering = await courseOfferingService.createCourseOffering(
    institutionId,
    req.body as CreateCourseOfferingInput
  );
  res.status(201).json({ success: true, data: offering });
});

export const update = asyncHandler(async (req: Request, res: Response) => {
  const institutionId = requireInstitution(req);
  const offering = await courseOfferingService.updateCourseOffering(
    institutionId,
    req.params.id,
    req.body as UpdateCourseOfferingInput
  );
  res.status(200).json({ success: true, data: offering });
});

export const deactivate = asyncHandler(async (req: Request, res: Response) => {
  const institutionId = requireInstitution(req);
  const offering = await courseOfferingService.deactivateCourseOffering(
    institutionId,
    req.params.id
  );
  res.status(200).json({ success: true, data: offering });
});

/** GET /:id/roster — real section roster, ownership-gated (Phase 5). */
export const roster = asyncHandler(async (req: Request, res: Response) => {
  const institutionId = requireInstitution(req);
  const user = requireUser(req);
  const rosterList = await courseOfferingService.getRoster(
    institutionId,
    user,
    req.params.id
  );
  res.status(200).json({ success: true, data: rosterList });
});
