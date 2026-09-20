import { Router } from "express";

import { authenticate } from "../middleware/authenticate";
import { authorize } from "../middleware/authorize";
import { loginRateLimit, tokenRateLimit } from "../middleware/rateLimit";
import { validateBody, validateParams } from "../middleware/validate";
import * as service from "../services/accountSecurity.service";
import { asyncHandler } from "../utils/asyncHandler";
import { auditMeta, sendOk } from "../utils/http";
import {
  requireAuthenticatedUser,
  requireInstitution,
} from "../utils/requireInstitution";
import { idParams } from "../validators/common";
import {
  confirmMfaSchema,
  disableMfaSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} from "../validators/coreErp.validators";

/**
 * Account security endpoints.
 *
 * The unauthenticated routes (forgot/reset) are rate limited with the
 * same limiter that protects sign-in, because they are the same attack
 * surface. Neither ever reveals whether an address exists.
 */
const router = Router();

router.post(
  "/forgot-password",
  loginRateLimit,
  validateBody(forgotPasswordSchema),
  asyncHandler(async (req, res) => {
    const issued = await service.requestPasswordReset(
      req.body.email,
      auditMeta(req)
    );

    /*
     * The token is only returned when no mailer is configured, so a
     * self-hosted institution without SMTP can still complete the flow
     * from the admin console. With MAIL_ENABLED=true it is emailed and
     * the response carries nothing exploitable.
     */
    const exposeToken = process.env.MAIL_ENABLED !== "true";

    sendOk(res, {
      message:
        "If that address belongs to an account, a reset link has been sent.",
      expiresInMinutes: service.passwordResetTtlMinutes,
      ...(exposeToken && issued.token ? { resetToken: issued.token } : {}),
    });
  })
);

router.post(
  "/reset-password",
  loginRateLimit,
  validateBody(resetPasswordSchema),
  asyncHandler(async (req, res) =>
    sendOk(
      res,
      await service.resetPassword(
        req.body.token,
        req.body.newPassword,
        auditMeta(req)
      )
    )
  )
);

router.use(authenticate);

router.get(
  "/mfa",
  asyncHandler(async (req, res) =>
    sendOk(res, await service.getMfaStatus(requireAuthenticatedUser(req)))
  )
);

router.post(
  "/mfa/enroll",
  tokenRateLimit,
  asyncHandler(async (req, res) =>
    sendOk(res, await service.beginMfaEnrollment(requireAuthenticatedUser(req)))
  )
);

router.post(
  "/mfa/confirm",
  tokenRateLimit,
  validateBody(confirmMfaSchema),
  asyncHandler(async (req, res) =>
    sendOk(
      res,
      await service.confirmMfaEnrollment(
        requireAuthenticatedUser(req),
        req.body.code,
        auditMeta(req)
      )
    )
  )
);

router.post(
  "/mfa/disable",
  tokenRateLimit,
  validateBody(disableMfaSchema),
  asyncHandler(async (req, res) =>
    sendOk(
      res,
      await service.disableMfa(
        requireAuthenticatedUser(req),
        req.body.password,
        auditMeta(req)
      )
    )
  )
);

router.post(
  "/sessions/revoke-all",
  asyncHandler(async (req, res) =>
    sendOk(
      res,
      await service.revokeAllSessions(
        requireAuthenticatedUser(req),
        auditMeta(req)
      )
    )
  )
);

router.post(
  "/users/:id/unlock",
  authorize("users.update"),
  validateParams(idParams),
  asyncHandler(async (req, res) =>
    sendOk(
      res,
      await service.unlockAccount(
        requireInstitution(req),
        requireAuthenticatedUser(req),
        req.params.id,
        auditMeta(req)
      )
    )
  )
);

router.post(
  "/users/:id/reset-link",
  authorize("users.update"),
  validateParams(idParams),
  asyncHandler(async (req, res) => {
    const issued = await service.adminIssueResetToken(
      requireInstitution(req),
      requireAuthenticatedUser(req),
      req.params.id,
      auditMeta(req)
    );
    sendOk(res, {
      expiresAt: issued.expiresAt,
      ...(process.env.MAIL_ENABLED !== "true" && issued.token
        ? { resetToken: issued.token }
        : {}),
    });
  })
);

export default router;
