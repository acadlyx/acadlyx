import { Router } from "express";

import * as authController from "../controllers/auth.controller";

import { authenticate } from "../middleware/authenticate";

import {
  loginRateLimit,
  tokenRateLimit,
} from "../middleware/rateLimit";

import {
  validateBody,
} from "../middleware/validate";

import {
  verifyMfaSchema,
} from "../validators/coreErp.validators";

import {
  loginSchema,
  logoutSchema,
  refreshSchema,
  changePasswordSchema,
  updateMyProfileSchema,
} from "../validators/auth.validators";

import {
  AppError,
} from "../middleware/errorHandler";

import {
  getProfilePhoto,
  uploadProfilePhotoDataUrl,
} from "../services/profilePhoto.service";

const router =
  Router();

router.post(
  "/login",
  loginRateLimit,
  validateBody(
    loginSchema
  ),
  authController.login
);

router.post(
  "/mfa/verify",
  loginRateLimit,
  validateBody(
    verifyMfaSchema
  ),
  authController.verifyMfa
);

router.post(
  "/refresh",
  tokenRateLimit,
  validateBody(
    refreshSchema
  ),
  authController.refresh
);

router.post(
  "/logout",
  validateBody(
    logoutSchema
  ),
  authController.logout
);

router.get(
  "/recovery-institutions",
  authController.recoveryInstitutions
);

router.get(
  "/me",
  authenticate,
  authController.me
);

router.get(
  "/account",
  authenticate,
  authController.account
);

router.get(
  "/account/photo",
  authenticate,
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

      const photo =
        await getProfilePhoto(
          req.user.id
        );

      res.json({
        success:
          true,
        data: {
          userId:
            req.user.id,
          url:
            photo?.url ??
            null,
        },
      });
    } catch (
      error
    ) {
      next(error);
    }
  }
);

router.patch(
  "/account",
  authenticate,
  validateBody(
    updateMyProfileSchema
  ),
  authController.updateProfile
);

router.post(
  "/change-password",
  authenticate,
  validateBody(
    changePasswordSchema
  ),
  authController.changePassword
);

/**
 * Every authenticated user can update
 * their own profile picture.
 */
router.post(
  "/account/photo",
  authenticate,
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

      const photo =
        await uploadProfilePhotoDataUrl(
          req.user.id,
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

export default router;
