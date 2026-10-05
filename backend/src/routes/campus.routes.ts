import { Router } from "express";
import { z } from "zod";

import * as campusController from "../controllers/campus.controller";

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
  createCampusSchema,
  listCampusesQuerySchema,
  updateCampusSchema,
} from "../validators/campus.validators";

const router = Router();

router.use(authenticate);

router.get(
  "/",
  authorize("campuses.read"),
  validateQuery(
    listCampusesQuerySchema
  ),
  campusController.list
);

router.get(
  "/:id",
  authorize("campuses.read"),
  campusController.getById
);

router.post(
  "/",
  authorize("campuses.create"),
  validateBody(
    createCampusSchema
  ),
  campusController.create
);

router.patch(
  "/:id",
  authorize("campuses.update"),
  validateBody(
    updateCampusSchema
  ),
  campusController.update
);

router.get(
  "/:id/access",
  authorize("campuses.read"),
  campusController.listAccess
);

router.post(
  "/:id/access",
  authorize("campuses.update"),
  validateBody(z.object({
    userId: z.string().uuid(),
    scope: z.string().trim().min(1).max(50).optional(),
  })),
  campusController.assignAccess
);

router.delete(
  "/:id/access/:userId",
  authorize("campuses.update"),
  campusController.revokeAccess
);

router.delete(
  "/:id",
  authorize("campuses.delete"),
  campusController.deactivate
);

export default router;
