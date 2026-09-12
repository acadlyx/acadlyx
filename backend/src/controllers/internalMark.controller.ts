import { Request, Response } from "express";
import * as marksService from "../services/internalMark.service";
import { AppError } from "../middleware/errorHandler";
import { asyncHandler } from "../utils/asyncHandler";
import { buildPaginationMeta, parsePagination } from "../utils/pagination";
import { requireInstitution } from "../utils/requireInstitution";
import { EnterMarksInput } from "../validators/internalMark.validators";

function requireUser(req: Request) {
  if (!req.user) throw new AppError("Authentication required", 401);
  return req.user;
}

export const enter = asyncHandler(async (req: Request, res: Response) => {
  const institutionId = requireInstitution(req);
  const user = requireUser(req);
  const result = await marksService.enterMarks(
    institutionId,
    user,
    req.body as EnterMarksInput
  );
  res.status(200).json({ success: true, data: result });
});

export const list = asyncHandler(async (req: Request, res: Response) => {
  const institutionId = requireInstitution(req);
  const user = requireUser(req);
  const pagination = parsePagination(req);
  const courseOfferingId =
    (req.query.courseOfferingId as string | undefined) || undefined;
  const studentId = (req.query.studentId as string | undefined) || undefined;
  const component = (req.query.component as string | undefined) || undefined;

  const { items, total } = await marksService.listMarks(institutionId, user, {
    ...pagination,
    courseOfferingId,
    studentId,
    component,
  });

  res.status(200).json({
    success: true,
    data: items,
    meta: buildPaginationMeta(total, pagination),
  });
});
