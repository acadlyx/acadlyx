import { Request, Response } from "express";
import { AppError } from "../middleware/errorHandler";
import * as departmentService from "../services/department.service";
import { asyncHandler } from "../utils/asyncHandler";
import { buildPaginationMeta, parsePagination } from "../utils/pagination";
import {
  CreateDepartmentInput,
  UpdateDepartmentInput,
} from "../validators/department.validators";

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
  const isActive =
    req.query.isActive === undefined
      ? undefined
      : req.query.isActive === "true";

  const { items, total } = await departmentService.listDepartments(
    institutionId,
    { ...pagination, search, isActive }
  );

  res.status(200).json({
    success: true,
    data: items,
    meta: buildPaginationMeta(total, pagination),
  });
});

export const getById = asyncHandler(async (req: Request, res: Response) => {
  const institutionId = requireInstitution(req);
  const department = await departmentService.getDepartmentById(
    institutionId,
    req.params.id
  );
  res.status(200).json({ success: true, data: department });
});

export const create = asyncHandler(async (req: Request, res: Response) => {
  const institutionId = requireInstitution(req);
  const department = await departmentService.createDepartment(
    institutionId,
    req.body as CreateDepartmentInput
  );
  res.status(201).json({ success: true, data: department });
});

export const update = asyncHandler(async (req: Request, res: Response) => {
  const institutionId = requireInstitution(req);
  const department = await departmentService.updateDepartment(
    institutionId,
    req.params.id,
    req.body as UpdateDepartmentInput
  );
  res.status(200).json({ success: true, data: department });
});

export const deactivate = asyncHandler(async (req: Request, res: Response) => {
  const institutionId = requireInstitution(req);
  const department = await departmentService.deactivateDepartment(
    institutionId,
    req.params.id
  );
  res.status(200).json({ success: true, data: department });
});
