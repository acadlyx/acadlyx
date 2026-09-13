import { Request, Response } from "express";
import { AppError } from "../middleware/errorHandler";
import * as userService from "../services/user.service";
import { asyncHandler } from "../utils/asyncHandler";
import { buildPaginationMeta, parsePagination } from "../utils/pagination";
import {
  CreateUserInput,
  UpdateUserInput,
} from "../validators/user.validators";

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

  const institutionId =
    typeof req.query.institutionId === "string"
      ? req.query.institutionId
      : undefined;

  const role =
    typeof req.query.role === "string"
      ? req.query.role
      : undefined;

  const isActive =
    req.query.isActive === undefined
      ? undefined
      : req.query.isActive === "true";

  const result = await userService.listUsers({
    ...pagination,
    search,
    institutionId,
    role,
    isActive,
  });

  res.status(200).json({
    success: true,
    data: result.items,
    meta: buildPaginationMeta(result.total, pagination),
  });
});

export const getById = asyncHandler(
  async (req: Request, res: Response) => {
    requireSuperAdmin(req);

    const user = await userService.getUserById(req.params.id);

    res.status(200).json({
      success: true,
      data: user,
    });
  }
);

export const create = asyncHandler(async (req: Request, res: Response) => {
  requireSuperAdmin(req);

  const user = await userService.createUser(
    req.body as CreateUserInput
  );

  res.status(201).json({
    success: true,
    data: user,
  });
});

export const update = asyncHandler(async (req: Request, res: Response) => {
  requireSuperAdmin(req);

  const user = await userService.updateUser(
    req.params.id,
    req.body as UpdateUserInput,
    req.user!.id
  );

  res.status(200).json({
    success: true,
    data: user,
  });
});

export const setActive = asyncHandler(
  async (req: Request, res: Response) => {
    requireSuperAdmin(req);

    const user = await userService.setUserActive(
      req.params.id,
      req.body.isActive === true,
      req.user!.id
    );

    res.status(200).json({
      success: true,
      data: user,
    });
  }
);
