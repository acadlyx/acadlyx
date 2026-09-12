import { Router } from "express";
import * as programController from "../controllers/program.controller";
import { authenticate } from "../middleware/authenticate";
import { authorize } from "../middleware/authorize";
import { validateBody, validateQuery } from "../middleware/validate";
import {
  createProgramSchema,
  listProgramsQuerySchema,
  updateProgramSchema,
} from "../validators/program.validators";

const router = Router();

router.use(authenticate);

router.get(
  "/",
  authorize("programs.read"),
  validateQuery(listProgramsQuerySchema),
  programController.list
);
router.get("/:id", authorize("programs.read"), programController.getById);
router.post(
  "/",
  authorize("programs.create"),
  validateBody(createProgramSchema),
  programController.create
);
router.patch(
  "/:id",
  authorize("programs.update"),
  validateBody(updateProgramSchema),
  programController.update
);
router.delete(
  "/:id",
  authorize("programs.delete"),
  programController.deactivate
);

export default router;
