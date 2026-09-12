import { Router } from "express";
import * as authController from "../controllers/auth.controller";
import { authenticate } from "../middleware/authenticate";
import { validateBody } from "../middleware/validate";
import {
  loginSchema,
  logoutSchema,
  refreshSchema,
} from "../validators/auth.validators";

const router = Router();

router.post("/login", validateBody(loginSchema), authController.login);
router.post("/refresh", validateBody(refreshSchema), authController.refresh);
router.post("/logout", validateBody(logoutSchema), authController.logout);
router.get("/me", authenticate, authController.me);

export default router;
