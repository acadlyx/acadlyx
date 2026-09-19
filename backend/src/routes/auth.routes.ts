import { Router } from "express";
import * as authController from "../controllers/auth.controller";
import { authenticate } from "../middleware/authenticate";
import { loginRateLimit, tokenRateLimit } from "../middleware/rateLimit";
import { validateBody } from "../middleware/validate";
import {
  loginSchema,
  logoutSchema,
  refreshSchema,
  changePasswordSchema,
  updateMyProfileSchema,
} from "../validators/auth.validators";

const router = Router();

router.post("/login", loginRateLimit, validateBody(loginSchema), authController.login);
router.post("/refresh", tokenRateLimit, validateBody(refreshSchema), authController.refresh);
router.post("/logout", validateBody(logoutSchema), authController.logout);
router.get("/recovery-institutions", authController.recoveryInstitutions);
router.get("/me", authenticate, authController.me);
router.get("/account", authenticate, authController.account);
router.patch("/account", authenticate, validateBody(updateMyProfileSchema), authController.updateProfile);
router.post("/change-password", authenticate, validateBody(changePasswordSchema), authController.changePassword);

export default router;
