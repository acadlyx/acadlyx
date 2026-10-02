import { Router } from "express";
import multer from "multer";
import * as controller from "../controllers/import.controller";
import { authenticate } from "../middleware/authenticate";
import { requireFeature } from "../middleware/requireFeature";
import { requireAuthenticatedUser } from "../utils/requireInstitution";
import { IMPORT_PERMISSION_BY_TYPE } from "../services/import.service";

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 15 * 1024 * 1024 } });
router.use(
  authenticate,
  requireFeature("import_export")
);

function authorizeImportType(
  req: Parameters<import("express").RequestHandler>[0],
  res: Parameters<import("express").RequestHandler>[1],
  next: Parameters<import("express").RequestHandler>[2]
) {
  const permission = IMPORT_PERMISSION_BY_TYPE[req.params.type as keyof typeof IMPORT_PERMISSION_BY_TYPE];
  const user = requireAuthenticatedUser(req);

  if (!permission) {
    res.status(404).json({
      success: false,
      error: { code: "IMPORT_TYPE_NOT_FOUND", message: "Unsupported import type" },
    });
    return;
  }

  if (!user.permissions.includes(permission)) {
    res.status(403).json({
      success: false,
      error: { code: "FORBIDDEN", message: "You are not authorized to import this data type" },
    });
    return;
  }

  next();
}

router.post("/:type/preview", upload.single("file"), authorizeImportType, controller.preview);
router.post("/:type/commit", upload.single("file"), authorizeImportType, controller.commit);
export default router;

