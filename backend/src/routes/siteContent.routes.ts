import { Router } from "express";
import multer from "multer";
import * as controller from "../controllers/siteContent.controller";
import { authenticate } from "../middleware/authenticate";
import { authorize } from "../middleware/authorize";

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 8 * 1024 * 1024 } });

router.get("/public", controller.publicContent);
router.use(authenticate);
router.get("/", authorize("site.manage"), controller.get);
router.put("/", authorize("site.manage"), controller.update);
router.post("/media", authorize("site.manage"), upload.single("file"), controller.upload);

export default router;
