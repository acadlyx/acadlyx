import { Request, Response } from "express";
import { AppError } from "../middleware/errorHandler";

import * as userService from "../services/user.service";
import * as userDeletionService from "../services/userDeletion.service";
import * as userLifecycleService from "../services/userLifecycle.service";

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
      401,
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
      403,
    );
  }

  return user;
}

function normalizeRequestedRole(
  role: string | undefined,
): string | undefined {
  if (!role) {
    return undefined;
  }

  return role.trim().toUpperCase();
}

export const list = asyncHandler(
  async (
    req: Request,
    res: Response,
  ) => {
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

    const requestedRole =
      typeof req.query.role === "string"
        ? normalizeRequestedRole(req.query.role)
        : undefined;

    const isActive =
      req.query.isActive === undefined
        ? undefined
        : req.query.isActive === "true";

    const isSuperAdmin =
      user.roles.includes("SUPER_ADMIN");

    const isInstitutionAdmin =
      user.roles.includes("INSTITUTION_ADMIN");

    if (
      !isSuperAdmin &&
      !isInstitutionAdmin
    ) {
      throw new AppError(
        "User management is not available for this role",
        403,
      );
    }

    if (
      !isSuperAdmin &&
      requestedInstitutionId &&
      requestedInstitutionId !== user.institutionId
    ) {
      throw new AppError(
        "You cannot query users outside your institution",
        403,
      );
    }

    const result =
      await userService.listUsers({
        ...pagination,

        search,

        institutionId:
          isSuperAdmin
            ? requestedInstitutionId
            : user.institutionId ?? undefined,

        role: requestedRole,

        isActive,

        scopeInstitutionId:
          isSuperAdmin
            ? requestedInstitutionId ?? null
            : user.institutionId,
      });

    res.status(200).json({
      success: true,
      data: result.items,
      meta: buildPaginationMeta(
        result.total,
        pagination,
      ),
    });
  },
);

export const getById = asyncHandler(
  async (
    req: Request,
    res: Response,
  ) => {
    const user =
      requireUserManagementRole(req);

    const isSuperAdmin =
      user.roles.includes("SUPER_ADMIN");

    const target =
      await userService.getUserById(
        req.params.id,
        isSuperAdmin
          ? null
          : user.institutionId,
      );

    if (
      !isSuperAdmin &&
      target.institutionId !== user.institutionId
    ) {
      throw new AppError(
        "You cannot access users outside your institution",
        403,
      );
    }

    res.status(200).json({
      success: true,
      data: target,
    });
  },
);

export const create = asyncHandler(
  async (
    req: Request,
    res: Response,
  ) => {
    const actor =
      requireUserManagementRole(req);

    const input =
      req.body as CreateUserInput;

    const created =
      await userService.createUser(
        {
          ...input,

          role:
            normalizeRequestedRole(
              input.role,
            ) ?? input.role,
        },

        actor,
      );

    res.status(201).json({
      success: true,
      data: created,
    });
  },
);

export const update = asyncHandler(
  async (
    req: Request,
    res: Response,
  ) => {
    const actor =
      requireUserManagementRole(req);

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
                    input.role,
                  ) ?? input.role,
              }
            : {}),
        },

        actor,
      );

    res.status(200).json({
      success: true,
      data: updated,
    });
  },
);


export const getDepartments = asyncHandler(
  async (req: Request, res: Response) => {
    const actor = requireUserManagementRole(req);

    const data = await userService.getUserDepartmentAccess(
      req.params.id,
      actor,
    );

    res.status(200).json({
      success: true,
      data,
    });
  },
);

export const updateDepartments = asyncHandler(
  async (req: Request, res: Response) => {
    const actor = requireUserManagementRole(req);

    const departmentIds = req.body?.departmentIds;

    if (!Array.isArray(departmentIds) || !departmentIds.every((id) => typeof id === "string")) {
      throw new AppError("departmentIds must be an array of department IDs", 400);
    }

    const data = await userService.setUserDepartmentAccess(
      req.params.id,
      departmentIds,
      actor,
    );

    res.status(200).json({
      success: true,
      data,
    });
  },
);

export const setActive = asyncHandler(
  async (
    req: Request,
    res: Response,
  ) => {
    const actor =
      requireUserManagementRole(req);

    if (
      typeof req.body?.isActive !==
      "boolean"
    ) {
      throw new AppError(
        "isActive must be a boolean",
        400,
      );
    }

    const updated = req.body.isActive
      ? await userLifecycleService.reactivateUser(req.params.id, actor)
      : await userLifecycleService.deactivateUser(req.params.id, actor);

    res.status(200).json({
      success: true,
      data: updated,
    });
  },
);

export const requestPermanentDeletion =
  asyncHandler(
    async (
      req: Request,
      res: Response,
    ) => {
      const actor =
        requireUserManagementRole(req);

      const reason =
        typeof req.body?.reason === "string"
          ? req.body.reason
          : undefined;

      const result =
        await userDeletionService.requestPermanentDeletion(
          req.params.id,
          actor,
          reason,
        );

      /**
       * The deletion service returns two possible shapes:
       *
       * 1. Immediate deletion by an authorized SUPER_ADMIN:
       *    {
       *      userId,
       *      permanentlyDeleted
       *    }
       *
       * 2. Approval request:
       *    {
       *      status: "PENDING",
       *      ...
       *    }
       *
       * We must discriminate the union before reading `status`.
       */
      const isPendingRequest =
        "status" in result &&
        result.status === "PENDING";

      res
        .status(
          isPendingRequest
            ? 202
            : 200,
        )
        .json({
          success: true,
          data: result,
        });
    },
  );

export const listPermanentDeletionRequests =
  asyncHandler(
    async (
      req: Request,
      res: Response,
    ) => {
      const actor =
        requireUser(req);

      const requests =
        await userDeletionService.listPermanentDeletionRequests(
          actor,
        );

      res.status(200).json({
        success: true,
        data: requests,
      });
    },
  );

export const approvePermanentDeletion =
  asyncHandler(
    async (
      req: Request,
      res: Response,
    ) => {
      const actor =
        requireUser(req);

      const result =
        await userDeletionService.approvePermanentDeletion(
          req.params.requestId,
          actor,
        );

      res.status(200).json({
        success: true,
        data: result,
      });
    },
  );

export const rejectPermanentDeletion =
  asyncHandler(
    async (
      req: Request,
      res: Response,
    ) => {
      const actor =
        requireUser(req);

      const result =
        await userDeletionService.rejectPermanentDeletion(
          req.params.requestId,
          actor,
        );

      res.status(200).json({
        success: true,
        data: result,
      });
    },
  );


export const lifecycleDetails = asyncHandler(async (req: Request, res: Response) => {
  const actor = requireUserManagementRole(req);
  const data = await userLifecycleService.getUserLifecycleDetails(req.params.id, actor);
  res.status(200).json({ success: true, data });
});

export const deactivateLifecycle = asyncHandler(async (req: Request, res: Response) => {
  const actor = requireUserManagementRole(req);
  const reason = typeof req.body?.reason === "string" ? req.body.reason : undefined;
  const note = typeof req.body?.note === "string" ? req.body.note : undefined;
  const data = await userLifecycleService.deactivateUser(req.params.id, actor, reason, note);
  res.status(200).json({ success: true, data });
});

export const reactivateLifecycle = asyncHandler(async (req: Request, res: Response) => {
  const actor = requireUserManagementRole(req);
  const reason = typeof req.body?.reason === "string" ? req.body.reason : undefined;
  const data = await userLifecycleService.reactivateUser(req.params.id, actor, reason);
  res.status(200).json({ success: true, data });
});

export const softDeleteLifecycle = asyncHandler(async (req: Request, res: Response) => {
  const actor = requireUserManagementRole(req);
  const reason = typeof req.body?.reason === "string" ? req.body.reason : "";
  const note = typeof req.body?.note === "string" ? req.body.note : undefined;
  const data = await userLifecycleService.softDeleteUser(req.params.id, actor, reason, note);
  res.status(200).json({ success: true, data });
});

export const listDeleted = asyncHandler(async (req: Request, res: Response) => {
  const actor = requireUserManagementRole(req);
  const page = Math.max(1, Number(req.query.page) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize) || 25));
  const role = typeof req.query.role === "string" ? req.query.role : undefined;
  const search = typeof req.query.search === "string" ? req.query.search : undefined;
  const expiringSoon = req.query.expiringSoon === "true";
  const result = await userLifecycleService.listDeletedUsers(actor, { page, pageSize, role, search, expiringSoon });
  res.status(200).json({ success: true, data: result.items, meta: buildPaginationMeta(result.total, { page, pageSize }) });
});

export const recoverLifecycle = asyncHandler(async (req: Request, res: Response) => {
  const actor = requireUserManagementRole(req);
  const reason = typeof req.body?.reason === "string" ? req.body.reason : undefined;
  const data = await userLifecycleService.recoverUser(req.params.id, actor, reason);
  res.status(200).json({ success: true, data });
});
