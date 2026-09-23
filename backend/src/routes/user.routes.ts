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
  authenticate
);

router.get(
  "/",
  authorize(
    "users.read"
  ),
  validateQuery(
    listUsersQuerySchema
  ),
  userController.list
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
    "users.read"
  ),
  async (
    req,
    res,
    next
  ) => {
    try {
      if (!req.user) {
        throw new AppError(
          "Authentication required",
          401
        );
      }

      const ids =
        typeof req.query
          .ids === "string"
          ? req.query.ids
              .split(",")
              .map(
                (
                  id
                ) =>
                  id.trim()
              )
              .filter(Boolean)
              .slice(0, 100)
          : [];

      const targets =
        await prisma.user.findMany(
          {
            where:
              req.user.roles.includes(
                "SUPER_ADMIN"
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
          }
        );

      const allowedIds =
        targets.map(
          (
            target
          ) =>
            target.id
        );

      const photos =
        await getProfilePhotos(
          allowedIds
        );

      const data =
        Object.fromEntries(
          allowedIds.map(
            (
              id
            ) => [
              id,
              photos.get(
                id
              )?.url ??
                null,
            ]
          )
        );

      res.json({
        success:
          true,
        data,
      });
    } catch (
      error
    ) {
      next(error);
    }
  }
);

router.get(
  "/:id",
  authorize(
    "users.read"
  ),
  userController.getById
);

router.post(
  "/",
  authorize(
    "users.create"
  ),
  validateBody(
    createUserSchema
  ),
  userController.create
);

router.patch(
  "/:id",
  authorize(
    "users.update"
  ),
  validateBody(
    updateUserSchema
  ),
  userController.update
);

router.patch(
  "/:id/status",
  authorize(
    "users.delete"
  ),
  userController.setActive
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
    "users.update"
  ),
  async (
    req,
    res,
    next
  ) => {
    try {
      if (!req.user) {
        throw new AppError(
          "Authentication required",
          401
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
          400
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
          }
        );

      if (!target) {
        throw new AppError(
          "User not found",
          404
        );
      }

      const superAdmin =
        req.user.roles.includes(
          "SUPER_ADMIN"
        );

      const institutionAdmin =
        req.user.roles.includes(
          "INSTITUTION_ADMIN"
        );

      if (
        !superAdmin &&
        !institutionAdmin
      ) {
        throw new AppError(
          "This account cannot edit user profile photos",
          403
        );
      }

      if (
        !superAdmin &&
        target.institutionId !==
          req.user.institutionId
      ) {
        throw new AppError(
          "You cannot edit a user outside your institution",
          403
        );
      }

      const photo =
        await uploadProfilePhotoDataUrl(
          target.id,
          dataUrl
        );

      res.status(200).json({
        success:
          true,
        data: photo,
      });
    } catch (
      error
    ) {
      next(error);
    }
  }
);

router.delete(
  "/:id/photo",
  authorize(
    "users.update"
  ),
  async (
    req,
    res,
    next
  ) => {
    try {
      if (!req.user) {
        throw new AppError(
          "Authentication required",
          401
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
          }
        );

      if (!target) {
        throw new AppError(
          "User not found",
          404
        );
      }

      const superAdmin =
        req.user.roles.includes(
          "SUPER_ADMIN"
        );

      const institutionAdmin =
        req.user.roles.includes(
          "INSTITUTION_ADMIN"
        );

      if (
        !superAdmin &&
        !institutionAdmin
      ) {
        throw new AppError(
          "This account cannot edit user profile photos",
          403
        );
      }

      if (
        !superAdmin &&
        target.institutionId !==
          req.user.institutionId
      ) {
        throw new AppError(
          "You cannot edit a user outside your institution",
          403
        );
      }

      await deleteProfilePhoto(
        target.id
      );

      res.status(200).json({
        success:
          true,
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
  }
);

export default router;
