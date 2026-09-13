import { Request, Response } from "express";
import { AppError } from "../middleware/errorHandler";
import * as institutionService from "../services/institution.service";
import { asyncHandler } from "../utils/asyncHandler";
import { buildPaginationMeta, parsePagination } from "../utils/pagination";
import {
  CreateInstitutionInput,
  UpdateInstitutionInput,
} from "../validators/institution.validators";

function requireSuperAdmin(req: Request): void {
  if (!req.user?.roles.includes("SUPER_ADMIN")) {
    throw new AppError("SUPER_ADMIN access required", 403);
  }
}

export const list = asyncHandler(async (req: Request, res: Response) => {
  requireSuperAdmin(req);

  const pagination = parsePagination(req);

  const search =
    typeof req.query.search === "string"
      ? req.query.search
      : undefined;

  const isActive =
    req.query.isActive === undefined
      ? undefined
      : req.query.isActive === "true";

  const result = await institutionService.listInstitutions({
    ...pagination,
    search,
    isActive,
  });

  res.status(200).json({
    success: true,
    data: result.items,
    meta: buildPaginationMeta(result.total, pagination),
  });
});

export const getById = asyncHandler(async (req: Request, res: Response) => {
  requireSuperAdmin(req);

  const institution = await institutionService.getInstitutionById(
    req.params.id
  );

  res.status(200).json({
    success: true,
    data: institution,
  });
});

export const create = asyncHandler(async (req: Request, res: Response) => {
  requireSuperAdmin(req);

  const institution = await institutionService.createInstitution(
    req.body as CreateInstitutionInput
  );

  res.status(201).json({
    success: true,
    data: institution,
  });
});

export const update = asyncHandler(async (req: Request, res: Response) => {
  requireSuperAdmin(req);

  const institution = await institutionService.updateInstitution(
    req.params.id,
    req.body as UpdateInstitutionInput
  );

  res.status(200).json({
    success: true,
    data: institution,
  });
});

export const setActive = asyncHandler(
  async (req: Request, res: Response) => {
    requireSuperAdmin(req);

    const isActive = req.body.isActive === true;

    const institution = await institutionService.setInstitutionActive(
      req.params.id,
      isActive
    );

    res.status(200).json({
      success: true,
      data: institution,
    });
  }
);

export const stats = asyncHandler(
  async (req: Request, res: Response) => {
    requireSuperAdmin(req);

    const data = await institutionService.getPlatformStats();

    res.status(200).json({
      success: true,
      data,
    });
  }
);
