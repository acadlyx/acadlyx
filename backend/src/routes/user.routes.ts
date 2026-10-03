import { Router } from "express";

import * as userController from "../controllers/user.controller";

import {
  authenticate,
} from "../middleware/authenticate";

import {
  authorize,
} from "../middleware/authorize";

import {
  validateBody,
  validateQuery,
} from "../middleware/validate";

import {
  createUserSchema,
  listUsersQuerySchema,
  updateUserSchema,
} from "../validators/user.validators";

import {
  AppError,
} from "../middleware/errorHandler";

import {
  prisma,
} from "../lib/prisma";

import {
  deleteProfilePhoto,
  getProfilePhotos,
  uploadProfilePhotoDataUrl,
} from "../services/profilePhoto.service";

const router =
  Router();

router.use(
  authenticate,
);

router.get(
  "/deleted",
  authorize("users.read"),
  userController.listDeleted,
);

router.post("/:id/reset-password", authorize("users.update"), userController.issuePasswordReset);
router.post("/:id/force-password-change", authorize("users.update"), userController.forcePasswordChange);
router.post("/:id/revoke-sessions", authorize("users.update"), userController.revokeSessions);
router.post("/:id/unlock", authorize("users.update"), userController.unlock);

router.get(
  "/:id/lifecycle",
  authorize("users.read"),
  userController.lifecycleDetails,
);

router.post(
  "/:id/deactivate",
  authorize("users.update"),
  userController.deactivateLifecycle,
);

router.post(
  "/:id/reactivate",
  authorize("users.update"),
  userController.reactivateLifecycle,
);

/*
 * Legacy-compatible user deletion endpoint.
 *
 * The frontend uses this endpoint for the normal Archive/Delete action.
 * Keep this route explicit and separate from the permanent-delete endpoint
 * so older dashboard builds continue to resolve POST /users/:id/delete.
 */
router.post(
  "/:id/delete",
  authorize("users.delete"),
  userController.softDeleteLifecycle,
);

/*
 * Explicit soft-delete alias for clients that distinguish lifecycle
 * operations by name. The original /:id/delete endpoint remains supported.
 */
router.post(
  "/:id/soft-delete",
  authorize("users.delete"),
  userController.softDeleteLifecycle,
);

router.post(
  "/:id/recover",
  authorize("users.update"),
  userController.recoverLifecycle,
);

router.get(
  "/",
  authorize(
    "users.read",
  ),
  validateQuery(
    listUsersQuerySchema,
  ),
  userController.list,
);

/**
 * Batch profile-photo lookup.
 *
 * The tenant boundary is applied here before
 * profile photos are returned.
 */
router.get(
  "/photos",
  authorize(
    "users.read",
  ),
  async (
    req,
    res,
    next,
  ) => {
    try {
      if (!req.user) {
        throw new AppError(
          "Authentication required",
          401,
        );
      }

      const ids =
        typeof req.query
          .ids === "string"
          ? req.query.ids
              .split(",")
              .map(
                (id) =>
                  id.trim(),
              )
              .filter(Boolean)
              .slice(0, 100)
          : [];

      const targets =
        await prisma.user.findMany(
          {
            where:
              req.user.roles.includes(
                "SUPER_ADMIN",
              )
                ? {
                    id: {
                      in: ids,
                    },
                  }
                : {
                    id: {
                      in: ids,
                    },

                    institutionId:
                      req.user
                        .institutionId,
                  },

            select: {
              id: true,
            },
          },
        );

      const allowedIds =
        targets.map(
          (target) =>
            target.id,
        );

      const photos =
        await getProfilePhotos(
          allowedIds,
        );

      const data =
        Object.fromEntries(
          allowedIds.map(
            (id) => [
              id,
              photos.get(
                id,
              )?.url ??
                null,
            ],
          ),
        );

      res.json({
        success: true,
        data,
      });
    } catch (
      error
    ) {
      next(error);
    }
  },
);

/**
 * Permanent-deletion approval queue.
 *
 * The backend decides which requests the authenticated authority
 * may approve. The frontend never chooses the approver.
 */
router.get(
  "/permanent-deletion-requests",
  authorize(
    "users.read",
  ),
  userController.listPermanentDeletionRequests,
);

router.post(
  "/permanent-deletion-requests/:requestId/approve",
  authorize(
    "users.read",
  ),
  userController.approvePermanentDeletion,
);

router.post(
  "/permanent-deletion-requests/:requestId/reject",
  authorize(
    "users.read",
  ),
  userController.rejectPermanentDeletion,
);

router.get(
  "/:id/departments",
  authorize(
    "users.read",
  ),
  userController.getDepartments,
);

router.put(
  "/:id/departments",
  authorize(
    "users.update",
  ),
  userController.updateDepartments,
);

router.get(
  "/:id",
  authorize(
    "users.read",
  ),
  userController.getById,
);

router.post(
  "/",
  authorize(
    "users.create",
  ),
  validateBody(
    createUserSchema,
  ),
  userController.create,
);

router.patch(
  "/:id",
  authorize(
    "users.update",
  ),
  validateBody(
    updateUserSchema,
  ),
  userController.update,
);

/**
 * Normal Delete action.
 *
 * This is a SOFT DELETE:
 * User remains in the database but becomes inactive.
 */
router.patch(
  "/:id/status",
  authorize(
    "users.delete",
  ),
  userController.setActive,
);

/**
 * Permanent deletion.
 *
 * SUPER_ADMIN deletes immediately.
 *
 * Other user-management authorities create a permanent-deletion
 * approval request.
 */
router.post(
  "/:id/permanent-delete",
  authorize(
    "users.delete",
  ),
  userController.requestPermanentDeletion,
);

/**
 * Institution Admin can update the
 * profile photo of users in their
 * own institution.
 *
 * SUPER_ADMIN can do this platform-wide.
 */
router.post(
  "/:id/photo",
  authorize(
    "users.update",
  ),
  async (
    req,
    res,
    next,
  ) => {
    try {
      if (!req.user) {
        throw new AppError(
          "Authentication required",
          401,
        );
      }

      const dataUrl =
        req.body?.dataUrl;

      if (
        typeof dataUrl !==
        "string"
      ) {
        throw new AppError(
          "Profile photo is required",
          400,
        );
      }

      const target =
        await prisma.user.findUnique(
          {
            where: {
              id:
                req.params.id,
            },

            select: {
              id: true,

              institutionId:
                true,
            },
          },
        );

      if (!target) {
        throw new AppError(
          "User not found",
          404,
        );
      }

      const superAdmin =
        req.user.roles.includes(
          "SUPER_ADMIN",
        );

      const institutionAdmin =
        req.user.roles.includes(
          "INSTITUTION_ADMIN",
        );

      if (
        !superAdmin &&
        !institutionAdmin
      ) {
        throw new AppError(
          "This account cannot edit user profile photos",
          403,
        );
      }

      if (
        !superAdmin &&
        target.institutionId !==
          req.user.institutionId
      ) {
        throw new AppError(
          "You cannot edit a user outside your institution",
          403,
        );
      }

      const photo =
        await uploadProfilePhotoDataUrl(
          target.id,
          dataUrl,
        );

      res.status(200).json({
        success: true,
        data: photo,
      });
    } catch (
      error
    ) {
      next(error);
    }
  },
);

router.delete(
  "/:id/photo",
  authorize(
    "users.update",
  ),
  async (
    req,
    res,
    next,
  ) => {
    try {
      if (!req.user) {
        throw new AppError(
          "Authentication required",
          401,
        );
      }

      const target =
        await prisma.user.findUnique(
          {
            where: {
              id:
                req.params.id,
            },

            select: {
              id: true,

              institutionId:
                true,
            },
          },
        );

      if (!target) {
        throw new AppError(
          "User not found",
          404,
        );
      }

      const superAdmin =
        req.user.roles.includes(
          "SUPER_ADMIN",
        );

      const institutionAdmin =
        req.user.roles.includes(
          "INSTITUTION_ADMIN",
        );

      if (
        !superAdmin &&
        !institutionAdmin
      ) {
        throw new AppError(
          "This account cannot edit user profile photos",
          403,
        );
      }

      if (
        !superAdmin &&
        target.institutionId !==
          req.user.institutionId
      ) {
        throw new AppError(
          "You cannot edit a user outside your institution",
          403,
        );
      }

      await deleteProfilePhoto(
        target.id,
      );

      res.status(200).json({
        success: true,

        data: {
          userId:
            target.id,
        },
      });
    } catch (
      error
    ) {
      next(error);
    }
  },
);

export default router;
