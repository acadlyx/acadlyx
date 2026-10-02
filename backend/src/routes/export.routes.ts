import { Router, Request, Response, NextFunction } from "express";

import { authenticate } from "../middleware/authenticate";
import * as controller from "../controllers/export.controller";
import { requireFeature } from "../middleware/requireFeature";
import { authorize } from "../middleware/authorize";
import type { PermissionKey } from "../config/rbac";
import type { ExportType } from "../services/export.service";

const router = Router();

/*
 * Export authority is intentionally data-type specific.
 *
 * The old reports.read gate was too broad: a user who could read reports
 * could potentially reach every generic exporter. The exporter now uses the
 * same permission model as the corresponding CRUD/reporting domain.
 */
const EXPORT_PERMISSION_BY_TYPE: Record<ExportType, PermissionKey> = {
  users: "users.read",
  students: "students.read",
  faculty: "users.read",
  departments: "departments.read",
  programs: "programs.read",
  "academic-years": "academic-years.read",
  semesters: "semesters.read",
  sections: "sections.read",
  courses: "courses.read",
  "course-offerings": "course-offerings.read",
  exams: "exams.read",
  marks: "marks.read",
  attendance: "attendance.read",
  fees: "fees.read",
  "fee-payments": "fees.read",
  "fee-structures": "fees.read",
  notices: "notices.read",
  timetable: "timetable.read",
  "parent-links": "parent-links.read",
};

function authorizeExportType(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const type = String(req.params.type) as ExportType;
  const permission = EXPORT_PERMISSION_BY_TYPE[type];

  if (!permission) {
    next();
    return;
  }

  authorize(permission)(req, res, next);
}

router.use(
  authenticate,
  requireFeature("import_export"),
);

// Attendance has a dedicated scoped exporter. It must be registered before /:type.
router.get("/attendance/options", authorize("attendance.read"), controller.attendanceOptions);
router.get(
  "/attendance",
  authorize("attendance.read"),
  controller.attendanceExport,
);

// Remaining exports require the permission for the exported domain.
router.get("/:type", authorizeExportType, controller.exportData);

export default router;
