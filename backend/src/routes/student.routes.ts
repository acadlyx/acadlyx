import { Router } from "express";

import * as studentController from "../controllers/student.controller";
import * as studentAdminController from "../controllers/studentAdmin.controller";

import { authenticate } from "../middleware/authenticate";
import {
  authorize,
  authorizeRoles,
} from "../middleware/authorize";
import {
  validateBody,
  validateQuery,
} from "../middleware/validate";
import {
  createStudentSchema,
  enrollStudentSchema,
  listStudentsQuerySchema,
  updateStudentSchema,
} from "../validators/studentAdmin.validators";

const router = Router();

router.use(authenticate);

/*
 * Self-service routes must stay above /:id so "me" is never
 * interpreted as a user id. These routes are restricted to
 * actual student accounts.
 */
router.get(
  "/me",
  authorizeRoles("STUDENT"),
  studentController.me
);

router.get(
  "/me/dashboard",
  authorizeRoles("STUDENT"),
  studentController.dashboard
);

router.get(
  "/me/attendance",
  authorizeRoles("STUDENT"),
  studentController.attendance
);

router.get(
  "/me/marks",
  authorizeRoles("STUDENT"),
  studentController.marks
);

router.get(
  "/me/assignments",
  authorizeRoles("STUDENT"),
  studentController.assignments
);

/*
 * Institution student master / enrollment management.
 *
 * Tenant identity is derived from the authenticated JWT by
 * requireInstitution(). The browser never supplies institutionId.
 */
router.get(
  "/",
  authorize("students.read"),
  validateQuery(listStudentsQuerySchema),
  studentAdminController.list
);

router.get(
  "/:id/enrollments",
  authorize("students.read"),
  studentAdminController.enrollments
);

router.get(
  "/:id",
  authorize("students.read"),
  studentAdminController.getById
);

router.post(
  "/",
  authorize("students.create"),
  validateBody(createStudentSchema),
  studentAdminController.create
);

router.patch(
  "/:id",
  authorize("students.update"),
  validateBody(updateStudentSchema),
  studentAdminController.update
);

router.post(
  "/:id/enrollments",
  authorize("students.create", "students.update"),
  validateBody(enrollStudentSchema),
  studentAdminController.enroll
);

export default router;
