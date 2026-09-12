import { Router } from "express";
import * as marksController from "../controllers/internalMark.controller";
import { authenticate } from "../middleware/authenticate";
import { authorize } from "../middleware/authorize";
import { validateBody, validateQuery } from "../middleware/validate";
import {
  enterMarksSchema,
  listMarksQuerySchema,
} from "../validators/internalMark.validators";

const router = Router();

router.use(authenticate);

router.get(
  "/",
  authorize("marks.read"),
  validateQuery(listMarksQuerySchema),
  marksController.list
);
router.post(
  "/",
  authorize("marks.enter"),
  validateBody(enterMarksSchema),
  marksController.enter
);

export default router;
