import { Router } from "express";
import * as attendanceController from "../controllers/attendanceSession.controller";
import { authenticate } from "../middleware/authenticate";
import { authorize } from "../middleware/authorize";
import { validateBody, validateQuery } from "../middleware/validate";
import {
  createSessionSchema,
  listSessionsQuerySchema,
  updateRecordsSchema,
} from "../validators/attendanceSession.validators";

const router = Router();

router.use(authenticate);

router.get(
  "/",
  authorize("attendance.read"),
  validateQuery(listSessionsQuerySchema),
  attendanceController.list
);
router.get("/:id", authorize("attendance.read"), attendanceController.getById);
router.post(
  "/",
  authorize("attendance.mark"),
  validateBody(createSessionSchema),
  attendanceController.create
);
router.patch(
  "/:id/records",
  authorize("attendance.mark"),
  validateBody(updateRecordsSchema),
  attendanceController.updateRecords
);

export default router;
