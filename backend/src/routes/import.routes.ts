import { Router } from "express";
import multer from "multer";
import * as controller from "../controllers/import.controller";
import { authenticate } from "../middleware/authenticate";
import { authorize } from "../middleware/authorize";
import { requireFeature } from "../middleware/requireFeature";
import { requireAuthenticatedUser } from "../utils/requireInstitution";

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 15 * 1024 * 1024 } });
const IMPORT_TYPE_PERMISSIONS: Record<string, string> = {
  users: "users.create",
  students: "students.create",
  faculty: "users.create",
  campuses: "campuses.create",
  departments: "departments.create",
  programs: "programs.create",
  "academic-years": "academic-years.create",
  semesters: "semesters.create",
  sections: "sections.create",
  courses: "courses.create",
  "course-offerings": "course-offerings.create",
  exams: "exams.manage",
  marks: "marks.enter",
  attendance: "attendance.mark",
  fees: "fees.manage",
  "fee-payments": "fees.pay",
  "fee-structures": "fees.manage",
  notices: "notices.manage",
  timetable: "timetable.manage",
  "parent-links": "parent-links.manage",
};

router.use(
  authenticate,
  requireFeature("import_export"),
  authorize("imports.manage")
);

function authorizeImportType(
  req: Parameters<import("express").RequestHandler>[0],
  res: Parameters<import("express").RequestHandler>[1],
  next: Parameters<import("express").RequestHandler>[2]
) {
  const permission = IMPORT_TYPE_PERMISSIONS[req.params.type];
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

