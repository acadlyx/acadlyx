import { Router } from "express";
import * as studentController from "../controllers/student.controller";
import { authenticate } from "../middleware/authenticate";

/**
 * Self-service routes only ("my profile", "my dashboard") — same
 * pattern as /auth/me. No RBAC permission is required beyond being
 * authenticated: a student should always be able to see their own
 * data. Admin-facing student management (listing/creating students
 * across an institution) is a separate concern for a later phase and
 * would use the existing students.read/create/update permissions
 * already reserved in the Phase 1 permission catalog.
 */
const router = Router();

router.use(authenticate);

router.get("/me", studentController.me);
router.get("/me/dashboard", studentController.dashboard);
router.get("/me/attendance", studentController.attendance);
router.get("/me/marks", studentController.marks);
router.get("/me/assignments", studentController.assignments);

export default router;
