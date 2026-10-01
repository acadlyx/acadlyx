import { Router } from "express";
import multer from "multer";
import { authenticate } from "../middleware/authenticate";
import { authorizeAnyPermission } from "../middleware/authorize";
import { requireFeature } from "../middleware/requireFeature";
import * as controller from "../controllers/peopleImport.controller";

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 15 * 1024 * 1024 } });
router.use(authenticate, requireFeature("import_export"), authorizeAnyPermission("people.import", "imports.manage"));
router.post("/:type/preview", upload.single("file"), controller.preview);
router.post("/:type/commit", upload.single("file"), controller.commit);
export default router;
