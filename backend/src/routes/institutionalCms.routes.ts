import { Router } from "express";
import { authenticate } from "../middleware/authenticate";
import { authorize } from "../middleware/authorize";
import { requireFeature } from "../middleware/requireFeature";
import * as controller from "../controllers/institutionalCms.controller";

const router = Router();
router.use(authenticate);
router.use(requireFeature("cms"));
router.get("/", authorize("site.manage"), controller.get);
router.put("/", authorize("site.manage"), controller.update);
export default router;
