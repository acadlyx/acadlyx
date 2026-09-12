import { Request, Response } from "express";
import { AppError } from "../middleware/errorHandler";
import * as programService from "../services/program.service";
import { asyncHandler } from "../utils/asyncHandler";
import { buildPaginationMeta, parsePagination } from "../utils/pagination";
import {
  CreateProgramInput,
  UpdateProgramInput,
} from "../validators/program.validators";

function requireInstitution(req: Request): string {
  const institutionId = req.user?.institutionId;
  if (!institutionId) {
    throw new AppError(
      "This action requires a user scoped to an institution",
      403
    );
  }
  return institutionId;
}

export const list = asyncHandler(async (req: Request, res: Response) => {
  const institutionId = requireInstitution(req);
  const pagination = parsePagination(req);
  const search = (req.query.search as string | undefined) || undefined;
  const departmentId =
    (req.query.departmentId as string | undefined) || undefined;
  const isActive =
    req.query.isActive === undefined
      ? undefined
      : req.query.isActive === "true";

  const { items, total } = await programService.listPrograms(institutionId, {
    ...pagination,
    search,
    departmentId,
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
  const program = await programService.getProgramById(
    institutionId,
    req.params.id
  );
  res.status(200).json({ success: true, data: program });
});

export const create = asyncHandler(async (req: Request, res: Response) => {
  const institutionId = requireInstitution(req);
  const program = await programService.createProgram(
    institutionId,
    req.body as CreateProgramInput
  );
  res.status(201).json({ success: true, data: program });
});

export const update = asyncHandler(async (req: Request, res: Response) => {
  const institutionId = requireInstitution(req);
  const program = await programService.updateProgram(
    institutionId,
    req.params.id,
    req.body as UpdateProgramInput
  );
  res.status(200).json({ success: true, data: program });
});

export const deactivate = asyncHandler(async (req: Request, res: Response) => {
  const institutionId = requireInstitution(req);
  const program = await programService.deactivateProgram(
    institutionId,
    req.params.id
  );
  res.status(200).json({ success: true, data: program });
});
