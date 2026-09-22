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

/**
 * User management is an authority capability, not a generic "admin"
 * capability.
 *
 * The route itself additionally uses users.read/users.create/users.update/
 * users.delete. This function protects the workspace-level boundary.
 */
function requireUserManagementRole(req: Request) {
  const user = requireUser(req);

  const canManageUsers =
    user.roles.includes("SUPER_ADMIN") ||
    user.roles.includes("INSTITUTION_ADMIN");

  if (!canManageUsers) {
    throw new AppError(
      "This account does not have user-management authority",
      403
    );
  }

  return user;
}

function normalizeRequestedRole(
  role: string | undefined
): string | undefined {
  if (!role) {
    return undefined;
  }

  return role.trim().toUpperCase();
}

export const list = asyncHandler(
  async (
    req: Request,
    res: Response
  ) => {
    const user = requireUser(req);

    const pagination =
      parsePagination(req);

    const search =
      typeof req.query.search ===
      "string"
        ? req.query.search
        : undefined;

    const requestedInstitutionId =
      typeof req.query
        .institutionId === "string"
        ? req.query
            .institutionId
        : undefined;

    const requestedRole =
      typeof req.query.role ===
      "string"
        ? normalizeRequestedRole(
            req.query.role
          )
        : undefined;

    const isActive =
      req.query.isActive ===
      undefined
        ? undefined
        : req.query.isActive ===
          "true";

    const isSuperAdmin =
      user.roles.includes(
        "SUPER_ADMIN"
      );

    const isInstitutionAdmin =
      user.roles.includes(
        "INSTITUTION_ADMIN"
      );

    if (
      !isSuperAdmin &&
      !isInstitutionAdmin
    ) {
      throw new AppError(
        "User management is not available for this role",
        403
      );
    }

    /*
     * Institution administrators can never override their tenant
     * boundary through a query parameter.
     */
    if (
      !isSuperAdmin &&
      requestedInstitutionId &&
      requestedInstitutionId !==
        user.institutionId
    ) {
      throw new AppError(
        "You cannot query users outside your institution",
        403
      );
    }

    /*
     * The service receives the authoritative tenant scope.
     */
    const result =
      await userService.listUsers({
        ...pagination,

        search,

        institutionId:
          isSuperAdmin
            ? requestedInstitutionId
            : user.institutionId ??
              undefined,

        role: requestedRole,

        isActive,

        scopeInstitutionId:
          isSuperAdmin
            ? requestedInstitutionId ??
              null
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
  async (
    req: Request,
    res: Response
  ) => {
    const user =
      requireUserManagementRole(
        req
      );

    const isSuperAdmin =
      user.roles.includes(
        "SUPER_ADMIN"
      );

    const target =
      await userService.getUserById(
        req.params.id,
        isSuperAdmin
          ? null
          : user.institutionId
      );

    /*
     * Explicit second-level tenant check.
     *
     * This protects against future service changes accidentally widening
     * getUserById().
     */
    if (
      !isSuperAdmin &&
      target.institutionId !==
        user.institutionId
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
  async (
    req: Request,
    res: Response
  ) => {
    const actor =
      requireUserManagementRole(
        req
      );

    const input =
      req.body as CreateUserInput;

    /*
     * Do not rely on the frontend role dropdown.
     *
     * userService.createUser() performs the authoritative role boundary,
     * including the Super Admin restriction against creating ordinary
     * institutional operational accounts through this generic endpoint.
     */
    const created =
      await userService.createUser(
        {
          ...input,
          role:
            normalizeRequestedRole(
              input.role
            ) ?? input.role,
        },
        actor
      );

    res.status(201).json({
      success: true,
      data: created,
    });
  }
);

export const update = asyncHandler(
  async (
    req: Request,
    res: Response
  ) => {
    const actor =
      requireUserManagementRole(
        req
      );

    const input =
      req.body as UpdateUserInput;

    const updated =
      await userService.updateUser(
        req.params.id,
        {
          ...input,
          ...(input.role
            ? {
                role:
                  normalizeRequestedRole(
                    input.role
                  ) ?? input.role,
              }
            : {}),
        },
        actor
      );

    res.status(200).json({
      success: true,
      data: updated,
    });
  }
);

export const setActive = asyncHandler(
  async (
    req: Request,
    res: Response
  ) => {
    const actor =
      requireUserManagementRole(
        req
      );

    if (
      typeof req.body?.isActive !==
      "boolean"
    ) {
      throw new AppError(
        "isActive must be a boolean",
        400
      );
    }

    const updated =
      await userService.setUserActive(
        req.params.id,
        req.body.isActive,
        actor
      );

    res.status(200).json({
      success: true,
      data: updated,
    });
  }
);
