import { Router } from "express";
import { authenticate } from "../middleware/authenticate";
import * as controller from "../controllers/export.controller";

const router = Router();
router.use(authenticate);
router.get("/:type", controller.exportData);
export default router;
