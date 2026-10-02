import { Router } from "express";
import multer from "multer";
import { authenticate } from "../middleware/authenticate";
import { asyncHandler } from "../utils/asyncHandler";
import * as controller from "../controllers/fileStorage.controller";

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === "application/octet-stream") {
      cb(new Error("Generic binary MIME type is not accepted; provide the actual file type."));
      return;
    }
    cb(null, true);
  },
});

router.use(authenticate);
router.post("/", upload.single("file"), asyncHandler(controller.upload));
router.get("/:id", asyncHandler(controller.get));
router.delete("/:id", asyncHandler(controller.remove));

export default router;
