import { Request, Response } from "express";
import { AppError } from "../middleware/errorHandler";
import * as userService from "../services/user.service";
import { asyncHandler } from "../utils/asyncHandler";
import {
  buildPaginationMeta,
  parsePagination,
} from "../utils/pagination";
import {
  CreateUserInput,
  UpdateUserInput,
} from "../validators/user.validators";

function requireUser(req: Request) {
  if (!req.user) {
    throw new AppError(
      "Authentication required",
      401
    );
  }

  return req.user;
}

function requireUserManagementRole(req: Request) {
  const user = requireUser(req);

  if (
    !user.roles.includes("SUPER_ADMIN") &&
    !user.roles.includes("INSTITUTION_ADMIN")
  ) {
    throw new AppError(
      "Only SUPER_ADMIN or INSTITUTION_ADMIN may manage users",
      403
    );
  }

  return user;
}

export const list = asyncHandler(
  async (req: Request, res: Response) => {
    const user = requireUser(req);

    const pagination = parsePagination(req);

    const search =
      typeof req.query.search === "string"
        ? req.query.search
        : undefined;

    const requestedInstitutionId =
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

    const isSuperAdmin =
      user.roles.includes("SUPER_ADMIN");

    const isInstitutionAdmin =
      user.roles.includes("INSTITUTION_ADMIN");

    if (!isSuperAdmin && !isInstitutionAdmin) {
      throw new AppError(
        "User management is not available for this role",
        403
      );
    }

    if (
      !isSuperAdmin &&
      requestedInstitutionId &&
      requestedInstitutionId !== user.institutionId
    ) {
      throw new AppError(
        "You cannot query users outside your institution",
        403
      );
    }

    const result =
      await userService.listUsers({
        ...pagination,
        search,
        institutionId: isSuperAdmin
          ? requestedInstitutionId
          : user.institutionId ?? undefined,
        role,
        isActive,
        scopeInstitutionId: isSuperAdmin
          ? requestedInstitutionId ?? null
          : user.institutionId,
      });

    res.status(200).json({
      success: true,
      data: result.items,
      meta: buildPaginationMeta(
        result.total,
        pagination
      ),
    });
  }
);

export const getById = asyncHandler(
  async (req: Request, res: Response) => {
    const user = requireUser(req);

    const isSuperAdmin =
      user.roles.includes("SUPER_ADMIN");

    const isInstitutionAdmin =
      user.roles.includes("INSTITUTION_ADMIN");

    if (!isSuperAdmin && !isInstitutionAdmin) {
      throw new AppError(
        "User management is not available for this role",
        403
      );
    }

    const target =
      await userService.getUserById(
        req.params.id,
        isSuperAdmin
          ? null
          : user.institutionId
      );

    if (
      !isSuperAdmin &&
      target.institutionId !== user.institutionId
    ) {
      throw new AppError(
        "You cannot access users outside your institution",
        403
      );
    }

    res.status(200).json({
      success: true,
      data: target,
    });
  }
);

export const create = asyncHandler(
  async (req: Request, res: Response) => {
    const actor =
      requireUserManagementRole(req);

    const created =
      await userService.createUser(
        req.body as CreateUserInput,
        actor
      );

    res.status(201).json({
      success: true,
      data: created,
    });
  }
);

export const update = asyncHandler(
  async (req: Request, res: Response) => {
    const actor =
      requireUserManagementRole(req);

    const updated =
      await userService.updateUser(
        req.params.id,
        req.body as UpdateUserInput,
        actor
      );

    res.status(200).json({
      success: true,
      data: updated,
    });
  }
);

export const setActive = asyncHandler(
  async (req: Request, res: Response) => {
    const actor =
      requireUserManagementRole(req);

    const updated =
      await userService.setUserActive(
        req.params.id,
        req.body.isActive === true,
        actor
      );

    res.status(200).json({
      success: true,
      data: updated,
    });
  }
);
