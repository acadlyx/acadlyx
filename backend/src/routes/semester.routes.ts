import { Router } from "express";
import * as semesterController from "../controllers/semester.controller";
import { authenticate } from "../middleware/authenticate";
import { authorize } from "../middleware/authorize";
import { validateBody, validateQuery } from "../middleware/validate";
import {
  createSemesterSchema,
  listSemestersQuerySchema,
  updateSemesterSchema,
} from "../validators/semester.validators";

const router = Router();

router.use(authenticate);

router.get(
  "/",
  authorize("semesters.read"),
  validateQuery(listSemestersQuerySchema),
  semesterController.list
);
router.get("/:id", authorize("semesters.read"), semesterController.getById);
router.post(
  "/",
  authorize("semesters.create"),
  validateBody(createSemesterSchema),
  semesterController.create
);
router.patch(
  "/:id",
  authorize("semesters.update"),
  validateBody(updateSemesterSchema),
  semesterController.update
);
router.delete(
  "/:id",
  authorize("semesters.delete"),
  semesterController.deactivate
);

export default router;
