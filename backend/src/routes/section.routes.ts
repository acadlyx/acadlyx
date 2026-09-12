import { Router } from "express";
import * as sectionController from "../controllers/section.controller";
import { authenticate } from "../middleware/authenticate";
import { authorize } from "../middleware/authorize";
import { validateBody, validateQuery } from "../middleware/validate";
import {
  createSectionSchema,
  listSectionsQuerySchema,
  updateSectionSchema,
} from "../validators/section.validators";

const router = Router();

router.use(authenticate);

router.get(
  "/",
  authorize("sections.read"),
  validateQuery(listSectionsQuerySchema),
  sectionController.list
);
router.get("/:id", authorize("sections.read"), sectionController.getById);
router.post(
  "/",
  authorize("sections.create"),
  validateBody(createSectionSchema),
  sectionController.create
);
router.patch(
  "/:id",
  authorize("sections.update"),
  validateBody(updateSectionSchema),
  sectionController.update
);
router.delete(
  "/:id",
  authorize("sections.delete"),
  sectionController.deactivate
);

export default router;
