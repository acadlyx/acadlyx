import { Request, Response } from "express";
import * as attendanceService from "../services/attendanceSession.service";
import { AppError } from "../middleware/errorHandler";
import { asyncHandler } from "../utils/asyncHandler";
import { buildPaginationMeta, parsePagination } from "../utils/pagination";
import { requireInstitution } from "../utils/requireInstitution";
import {
  CreateSessionInput,
  UpdateRecordsInput,
} from "../validators/attendanceSession.validators";

function requireUser(req: Request) {
  if (!req.user) throw new AppError("Authentication required", 401);
  return req.user;
}

export const list = asyncHandler(async (req: Request, res: Response) => {
  const institutionId = requireInstitution(req);
  const pagination = parsePagination(req);
  const courseOfferingId =
    (req.query.courseOfferingId as string | undefined) || undefined;
  const facultyId = (req.query.facultyId as string | undefined) || undefined;
  const dateFrom = req.query.dateFrom
    ? new Date(String(req.query.dateFrom))
    : undefined;
  const dateTo = req.query.dateTo ? new Date(String(req.query.dateTo)) : undefined;
  const isSubmitted =
    req.query.isSubmitted === undefined
      ? undefined
      : req.query.isSubmitted === "true";

  const { items, total } = await attendanceService.listSessions(institutionId, {
    ...pagination,
    courseOfferingId,
    facultyId,
    dateFrom,
    dateTo,
    isSubmitted,
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
  const session = await attendanceService.getSessionById(
    institutionId,
    user,
    req.params.id
  );
  res.status(200).json({ success: true, data: session });
});

export const create = asyncHandler(async (req: Request, res: Response) => {
  const institutionId = requireInstitution(req);
  const user = requireUser(req);
  const session = await attendanceService.getOrCreateSession(
    institutionId,
    user,
    req.body as CreateSessionInput
  );
  res.status(201).json({ success: true, data: session });
});

export const updateRecords = asyncHandler(async (req: Request, res: Response) => {
  const institutionId = requireInstitution(req);
  const user = requireUser(req);
  const session = await attendanceService.upsertRecords(
    institutionId,
    user,
    req.params.id,
    req.body as UpdateRecordsInput
  );
  res.status(200).json({ success: true, data: session });
});
