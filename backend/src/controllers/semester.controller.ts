import { Request, Response } from "express";
import * as semesterService from "../services/semester.service";
import { asyncHandler } from "../utils/asyncHandler";
import { buildPaginationMeta, parsePagination } from "../utils/pagination";
import { requireInstitution } from "../utils/requireInstitution";
import {
  CreateSemesterInput,
  UpdateSemesterInput,
} from "../validators/semester.validators";

export const list = asyncHandler(async (req: Request, res: Response) => {
  const institutionId = requireInstitution(req);
  const pagination = parsePagination(req);
  const search = (req.query.search as string | undefined) || undefined;
  const programId = (req.query.programId as string | undefined) || undefined;
  const academicYearId =
    (req.query.academicYearId as string | undefined) || undefined;
  const isActive =
    req.query.isActive === undefined ? undefined : req.query.isActive === "true";

  const { items, total } = await semesterService.listSemesters(institutionId, {
    ...pagination,
    search,
    programId,
    academicYearId,
    isActive,
  });

  res.status(200).json({
    success: true,
    data: items,
    meta: buildPaginationMeta(total, pagination),
  });
});

export const getById = asyncHandler(async (req: Request, res: Response) => {
  const institutionId = requireInstitution(req);
  const semester = await semesterService.getSemesterById(
    institutionId,
    req.params.id
  );
  res.status(200).json({ success: true, data: semester });
});

export const create = asyncHandler(async (req: Request, res: Response) => {
  const institutionId = requireInstitution(req);
  const semester = await semesterService.createSemester(
    institutionId,
    req.body as CreateSemesterInput
  );
  res.status(201).json({ success: true, data: semester });
});

export const update = asyncHandler(async (req: Request, res: Response) => {
  const institutionId = requireInstitution(req);
  const semester = await semesterService.updateSemester(
    institutionId,
    req.params.id,
    req.body as UpdateSemesterInput
  );
  res.status(200).json({ success: true, data: semester });
});

export const deactivate = asyncHandler(async (req: Request, res: Response) => {
  const institutionId = requireInstitution(req);
  const semester = await semesterService.deactivateSemester(
    institutionId,
    req.params.id
  );
  res.status(200).json({ success: true, data: semester });
});
