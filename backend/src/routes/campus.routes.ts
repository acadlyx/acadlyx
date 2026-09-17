import { Router } from "express";

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

router.delete(
  "/:id",
  authorize("campuses.delete"),
  campusController.deactivate
);

export default router;
