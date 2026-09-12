import { Router } from "express";
import * as courseOfferingController from "../controllers/courseOffering.controller";
import { authenticate } from "../middleware/authenticate";
import { authorize } from "../middleware/authorize";
import { validateBody, validateQuery } from "../middleware/validate";
import {
  createCourseOfferingSchema,
  listCourseOfferingsQuerySchema,
  updateCourseOfferingSchema,
} from "../validators/courseOffering.validators";

const router = Router();

router.use(authenticate);

router.get(
  "/",
  authorize("course-offerings.read"),
  validateQuery(listCourseOfferingsQuerySchema),
  courseOfferingController.list
);
router.get(
  "/:id",
  authorize("course-offerings.read"),
  courseOfferingController.getById
);
router.post(
  "/",
  authorize("course-offerings.create"),
  validateBody(createCourseOfferingSchema),
  courseOfferingController.create
);
router.patch(
  "/:id",
  authorize("course-offerings.update"),
  validateBody(updateCourseOfferingSchema),
  courseOfferingController.update
);
router.delete(
  "/:id",
  authorize("course-offerings.delete"),
  courseOfferingController.deactivate
);
router.get(
  "/:id/roster",
  authorize("students.read"),
  courseOfferingController.roster
);

export default router;
