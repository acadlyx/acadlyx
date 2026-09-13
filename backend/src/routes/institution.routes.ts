import { Router } from "express";
import * as institutionController from "../controllers/institution.controller";
import { authenticate } from "../middleware/authenticate";
import { authorize } from "../middleware/authorize";
import {
  createInstitutionSchema,
  listInstitutionsQuerySchema,
  updateInstitutionSchema,
} from "../validators/institution.validators";
import {
  validateBody,
  validateQuery,
} from "../middleware/validate";

const router = Router();

router.use(authenticate);

router.get(
  "/stats",
  authorize("institutions.manage"),
  institutionController.stats
);

router.get(
  "/",
  authorize("institutions.manage"),
  validateQuery(listInstitutionsQuerySchema),
  institutionController.list
);

router.get(
  "/:id",
  authorize("institutions.manage"),
  institutionController.getById
);

router.post(
  "/",
  authorize("institutions.manage"),
  validateBody(createInstitutionSchema),
  institutionController.create
);

router.patch(
  "/:id",
  authorize("institutions.manage"),
  validateBody(updateInstitutionSchema),
  institutionController.update
);

router.patch(
  "/:id/status",
  authorize("institutions.manage"),
  institutionController.setActive
);

export default router;
