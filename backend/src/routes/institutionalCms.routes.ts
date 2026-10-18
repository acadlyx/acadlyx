import { Router } from "express";
import { authenticate } from "../middleware/authenticate";
import { authorize } from "../middleware/authorize";
import { requireFeature } from "../middleware/requireFeature";
import * as controller from "../controllers/institutionalCms.controller";

const router = Router();
router.use(authenticate);
router.use(requireFeature("cms"));
router.get("/", authorize("institutional-cms.read"), controller.get);
router.put("/", authorize("institutional-cms.manage"), controller.update);
router.post("/submit", authorize("institutional-cms.manage"), controller.submit);
router.post("/approve", authorize("institutional-cms.approve"), controller.approve);
router.post("/reject", authorize("institutional-cms.approve"), controller.reject);
export default router;
