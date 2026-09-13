import { Router } from "express";
import * as userController from "../controllers/user.controller";
import { authenticate } from "../middleware/authenticate";
import { authorize } from "../middleware/authorize";
import { validateBody, validateQuery } from "../middleware/validate";
import {
  createUserSchema,
  listUsersQuerySchema,
  updateUserSchema,
} from "../validators/user.validators";

const router = Router();

router.use(authenticate);

/*
 * Read access.
 *
 * The controller applies the actual role/tenant scope:
 * SUPER_ADMIN      -> platform-wide
 * INSTITUTION_ADMIN -> own institution
 */
router.get(
  "/",
  authorize("users.read"),
  validateQuery(listUsersQuerySchema),
  userController.list
);

router.get(
  "/:id",
  authorize("users.read"),
  userController.getById
);

/*
 * Create/update/deactivate require the specific capability AND
 * the controller verifies that the caller is actually permitted
 * to perform user administration.
 */
router.post(
  "/",
  authorize("users.create"),
  validateBody(createUserSchema),
  userController.create
);

router.patch(
  "/:id",
  authorize("users.update"),
  validateBody(updateUserSchema),
  userController.update
);

router.patch(
  "/:id/status",
  authorize("users.delete"),
  userController.setActive
);

export default router;
