import { Router } from "express";
import * as facultyController from "../controllers/faculty.controller";
import { authenticate } from "../middleware/authenticate";
import { authorize, authorizeRoles } from "../middleware/authorize";

/**
 * Self-service routes only ("my course offerings", "my dashboard") —
 * same pattern as /students/me. Gated by attendance.read (the core
 * capability this dashboard exposes); data is additionally always
 * scoped to req.user.id inside the service layer, so no permission
 * grant lets a caller see another faculty member's dashboard.
 */
const router = Router();

router.use(authenticate);
router.use(authorizeRoles("FACULTY"));

router.get(
  "/me/course-offerings",
  authorize("course-offerings.read"),
  facultyController.myCourseOfferings
);
router.get(
  "/me/dashboard",
  authorize("attendance.read"),
  facultyController.dashboard
);

export default router;
