import { Router } from "express";
import multer from "multer";
import * as controller from "../controllers/import.controller";
import { authenticate } from "../middleware/authenticate";
import { requireFeature } from "../middleware/requireFeature";
import { requireAuthenticatedUser, requireInstitution } from "../utils/requireInstitution";
import { IMPORT_PERMISSION_BY_TYPE } from "../services/import.service";
import { getOwnedJob, requestCancellation } from "../services/backgroundJob.service";
import { validateParams } from "../middleware/validate";
import { idParams } from "../validators/common";

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 15 * 1024 * 1024 } });
router.use(
  authenticate,
  requireFeature("import_export")
);


router.get("/jobs/:id", validateParams(idParams), async (req, res, next) => {
  try {
    const job = await getOwnedJob(requireInstitution(req), req.user!, req.params.id);
    res.json({ success: true, data: job });
  } catch (error) { next(error); }
});

router.post("/jobs/:id/cancel", validateParams(idParams), async (req, res, next) => {
  try {
    const job = await getOwnedJob(req.user!.institutionId!, req.user!, req.params.id);
    if (job.type !== "BULK_IMPORT") return res.status(400).json({ success: false, error: { code: "INVALID_JOB_TYPE", message: "This is not a bulk import job." }});
    const updated = await requestCancellation(req.user!.institutionId!, req.user!, req.params.id);
    res.json({ success: true, data: updated });
  } catch (error) { next(error); }
});

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
router.post("/students/commit-partial", upload.single("file"), (req, res, next) => {
  const user = requireAuthenticatedUser(req);
  if (!user.permissions.includes("students.create")) {
    res.status(403).json({ success: false, error: { code: "FORBIDDEN", message: "You are not authorized to import students" } });
    return;
  }
  next();
}, controller.commitPartialStudents);
export default router;

