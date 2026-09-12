import { Router } from "express";
import * as academicYearController from "../controllers/academicYear.controller";
import { authenticate } from "../middleware/authenticate";
import { authorize } from "../middleware/authorize";
import { validateBody, validateQuery } from "../middleware/validate";
import {
  createAcademicYearSchema,
  listAcademicYearsQuerySchema,
  updateAcademicYearSchema,
} from "../validators/academicYear.validators";

const router = Router();

router.use(authenticate);

router.get(
  "/",
  authorize("academic-years.read"),
  validateQuery(listAcademicYearsQuerySchema),
  academicYearController.list
);
router.get(
  "/:id",
  authorize("academic-years.read"),
  academicYearController.getById
);
router.post(
  "/",
  authorize("academic-years.create"),
  validateBody(createAcademicYearSchema),
  academicYearController.create
);
router.patch(
  "/:id",
  authorize("academic-years.update"),
  validateBody(updateAcademicYearSchema),
  academicYearController.update
);

export default router;
