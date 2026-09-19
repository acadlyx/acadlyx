import { Router } from "express";
import multer from "multer";
import * as institutionController from "../controllers/institution.controller";
import { authenticate } from "../middleware/authenticate";
import { authorize } from "../middleware/authorize";
import {
  createInstitutionSchema,
  listInstitutionsQuerySchema,
  updateInstitutionSchema,
  updateTenantEntitlementsSchema,
} from "../validators/institution.validators";
import {
  validateBody,
  validateQuery,
} from "../middleware/validate";

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 2 * 1024 * 1024, files: 1 } });

router.use(authenticate);

router.get(
  "/stats",
  authorize("institutions.manage"),
  institutionController.stats
);

router.get(
  "/",
  authorize("institutions.manage"),
  validateQuery(listInstitutionsQuerySchema),
  institutionController.list
);

router.get(
  "/:id",
  authorize("institutions.manage"),
  institutionController.getById
);

router.get("/:id/entitlements", authorize("institutions.manage"), institutionController.entitlements);
router.put("/:id/entitlements", authorize("institutions.manage"), validateBody(updateTenantEntitlementsSchema), institutionController.updateEntitlements);

router.post(
  "/",
  authorize("institutions.manage"),
  validateBody(createInstitutionSchema),
  institutionController.create
);

router.patch(
  "/:id",
  authorize("institutions.manage"),
  validateBody(updateInstitutionSchema),
  institutionController.update
);

router.post("/:id/logo", authorize("institutions.manage"), upload.single("file"), institutionController.uploadLogo);

router.patch(
  "/:id/status",
  authorize("institutions.manage"),
  institutionController.setActive
);

export default router;
