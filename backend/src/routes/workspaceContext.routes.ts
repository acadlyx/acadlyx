import { Router } from "express";
import { authenticate } from "../middleware/authenticate";
import { asyncHandler } from "../utils/asyncHandler";
import { requireAuthenticatedUser, requireInstitution } from "../utils/requireInstitution";
import * as service from "../services/workspaceContext.service";

const router = Router();

router.use(authenticate);

router.get(
  "/context",
  asyncHandler(async (req, res) => {
    const actor = requireAuthenticatedUser(req);

    const data = await service.getWorkspaceContext(
      requireInstitution(req),
      actor,
      {
        departmentId: typeof req.query.departmentId === "string" ? req.query.departmentId : undefined,
        programId: typeof req.query.programId === "string" ? req.query.programId : undefined,
        academicYearId: typeof req.query.academicYearId === "string" ? req.query.academicYearId : undefined,
        semesterId: typeof req.query.semesterId === "string" ? req.query.semesterId : undefined,
        sectionId: typeof req.query.sectionId === "string" ? req.query.sectionId : undefined,
      }
    );

    res.status(200).json({ success: true, data });
  })
);

export default router;
