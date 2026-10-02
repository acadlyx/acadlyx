import { Router } from "express";

import { authenticate } from "../middleware/authenticate";
import * as controller from "../controllers/export.controller";
import { requireFeature } from "../middleware/requireFeature";
import { authorize } from "../middleware/authorize";

const router = Router();

router.use(
  authenticate,
  requireFeature("import_export"),
  authorize("reports.read"),
);

// Attendance has a dedicated scoped exporter. It must be registered before /:type.
router.get("/attendance/options", controller.attendanceOptions);
router.get("/attendance", controller.attendanceExport);

// Remaining generic exports are restricted by export.service to institution-wide authority.
router.get("/:type", controller.exportData);

export default router;
