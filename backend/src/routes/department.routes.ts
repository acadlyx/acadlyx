import { Router } from "express";
import * as departmentController from "../controllers/department.controller";
import { authenticate } from "../middleware/authenticate";
import { authorize } from "../middleware/authorize";
import { validateBody, validateQuery } from "../middleware/validate";
import {
  createDepartmentSchema,
  listDepartmentsQuerySchema,
  updateDepartmentSchema,
} from "../validators/department.validators";

const router = Router();

router.use(authenticate);

router.get(
  "/",
  authorize("departments.read"),
  validateQuery(listDepartmentsQuerySchema),
  departmentController.list
);
router.get(
  "/:id",
  authorize("departments.read"),
  departmentController.getById
);
router.post(
  "/",
  authorize("departments.create"),
  validateBody(createDepartmentSchema),
  departmentController.create
);
router.patch(
  "/:id",
  authorize("departments.update"),
  validateBody(updateDepartmentSchema),
  departmentController.update
);
router.delete(
  "/:id",
  authorize("departments.delete"),
  departmentController.deactivate
);

export default router;
