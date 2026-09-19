import { Router } from "express";
import * as assignmentController from "../controllers/assignment.controller";
import { authenticate } from "../middleware/authenticate";
import { authorize } from "../middleware/authorize";
import { requireFeature } from "../middleware/requireFeature";
import { validateBody, validateQuery } from "../middleware/validate";
import {
  createAssignmentSchema,
  listAssignmentsQuerySchema,
  reviewSubmissionSchema,
  submitAssignmentSchema,
  updateAssignmentSchema,
} from "../validators/assignment.validators";

const router = Router();

router.use(authenticate);
router.use(requireFeature("assignments"));

router.get(
  "/",
  authorize("assignments.read"),
  validateQuery(listAssignmentsQuerySchema),
  assignmentController.list
);
router.get("/:id", authorize("assignments.read"), assignmentController.getById);
router.post(
  "/",
  authorize("assignments.create"),
  validateBody(createAssignmentSchema),
  assignmentController.create
);
router.patch(
  "/:id",
  authorize("assignments.update"),
  validateBody(updateAssignmentSchema),
  assignmentController.update
);
router.get(
  "/:id/submissions",
  authorize("assignments.review"),
  assignmentController.submissions
);
router.post(
  "/:id/submit",
  authorize("assignments.submit"),
  validateBody(submitAssignmentSchema),
  assignmentController.submit
);
router.patch(
  "/:id/submissions/:studentId",
  authorize("assignments.review"),
  validateBody(reviewSubmissionSchema),
  assignmentController.review
);

export default router;
