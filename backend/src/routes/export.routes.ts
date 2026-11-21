import { Router, Request, Response, NextFunction } from "express";

import { authenticate } from "../middleware/authenticate";
import * as controller from "../controllers/export.controller";
import { validateBody, validateParams } from "../middleware/validate";
import { idParams } from "../validators/common";
import { exportJobSchema } from "../validators/export.validators";
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
  campuses: "campuses.read",
  "paid-fees": "fees.read",
  "outstanding-dues": "fees.read",
  "fee-heads": "fees.read",
  "fee-receipts": "fees.read",
  "fee-transactions": "fees.read",
  "fee-refunds": "fees.read",
  "fee-concessions": "fees.read",
  "fee-audit": "audit.read",
  assignments: "assignments.read",
  "assignment-submissions": "assignments.read",
  "library-books": "library.read",
  "library-copies": "library.read",
  "library-issues": "library.read",
  "library-fines": "library.read",
  "admission-applications": "admissions.read",
  employees: "hr.read",
  "leave-requests": "hr.read",
  "calendar-events": "calendar.read",
  "institutional-events": "events.read",
  "event-media": "events.read",
  "placement-companies": "placements.read",
  "placement-drives": "placements.read",
  "placement-openings": "placements.read",
  "placement-applications": "placements.read",
  "placement-offers": "placements.read",
  "placement-visits": "placements.read",
  "placement-tests": "placements.read",
  "placement-interviews": "placements.read",
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
router.get("/jobs/:id", validateParams(idParams), controller.getExportJob);
router.post("/jobs/:id/cancel", validateParams(idParams), controller.cancelExportJob);
router.get("/jobs/:id/download", validateParams(idParams), controller.downloadExportJob);
router.get(
  "/attendance",
  authorize("attendance.read"),
  controller.attendanceExport,
);

// Background exports use the same dataset-specific permission map and durable worker queue.
router.post("/:type/jobs", authorizeExportType, validateBody(exportJobSchema), controller.enqueueExportJob);

// Remaining exports require the permission for the exported domain.
router.get("/:type", authorizeExportType, controller.exportData);

export default router;
