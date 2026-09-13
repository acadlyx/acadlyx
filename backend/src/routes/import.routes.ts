import { Router } from "express";
import multer from "multer";
import * as controller from "../controllers/import.controller";
import { authenticate } from "../middleware/authenticate";
import { authorize } from "../middleware/authorize";

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 15 * 1024 * 1024 } });
router.use(authenticate, authorize("imports.manage"));
router.post("/:type/preview", upload.single("file"), controller.preview);
router.post("/:type/commit", upload.single("file"), controller.commit);
export default router;


