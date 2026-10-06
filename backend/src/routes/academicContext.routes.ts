import { Router } from "express";
import { authorizeAnyPermission } from "../middleware/authorize";
import { academicContextOptions } from "../controllers/academicContext.controller";

const router = Router();

router.get(
  "/options",
  authorizeAnyPermission(
    "students.read",
    "programs.read",
    "courses.read",
    "course-offerings.read",
    "attendance.read",
    "exams.read",
    "fees.read",
  ),
  academicContextOptions,
);

export default router;
