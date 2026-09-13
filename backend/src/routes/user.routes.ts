import { Router } from "express";
import * as userController from "../controllers/user.controller";
import { authenticate } from "../middleware/authenticate";
import { authorize } from "../middleware/authorize";
import {
  createUserSchema,
  listUsersQuerySchema,
  updateUserSchema,
} from "../validators/user.validators";
import {
  validateBody,
  validateQuery,
} from "../middleware/validate";

const router = Router();

router.use(authenticate);

router.get(
  "/",
  authorize("institutions.manage"),
  validateQuery(listUsersQuerySchema),
  userController.list
);

router.get(
  "/:id",
  authorize("institutions.manage"),
  userController.getById
);

router.post(
  "/",
  authorize("institutions.manage"),
  validateBody(createUserSchema),
  userController.create
);

router.patch(
  "/:id",
  authorize("institutions.manage"),
  validateBody(updateUserSchema),
  userController.update
);

router.patch(
  "/:id/status",
  authorize("institutions.manage"),
  userController.setActive
);

export default router;
