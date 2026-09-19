import { Router } from "express";
import { authenticate } from "../middleware/authenticate";
import * as controller from "../controllers/export.controller";
import { requireFeature } from "../middleware/requireFeature";
import { authorize } from "../middleware/authorize";

const router = Router();
router.use(authenticate, requireFeature("import_export"), authorize("reports.read"));
router.get("/:type", controller.exportData);
export default router;
