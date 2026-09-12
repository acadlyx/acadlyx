import { Router } from "express";
import * as courseController from "../controllers/course.controller";
import { authenticate } from "../middleware/authenticate";
import { authorize } from "../middleware/authorize";
import { validateBody, validateQuery } from "../middleware/validate";
import {
  createCourseSchema,
  listCoursesQuerySchema,
  updateCourseSchema,
} from "../validators/course.validators";

const router = Router();

router.use(authenticate);

router.get(
  "/",
  authorize("courses.read"),
  validateQuery(listCoursesQuerySchema),
  courseController.list
);
router.get("/:id", authorize("courses.read"), courseController.getById);
router.post(
  "/",
  authorize("courses.create"),
  validateBody(createCourseSchema),
  courseController.create
);
router.patch(
  "/:id",
  authorize("courses.update"),
  validateBody(updateCourseSchema),
  courseController.update
);
router.delete(
  "/:id",
  authorize("courses.delete"),
  courseController.deactivate
);

export default router;
