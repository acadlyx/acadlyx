import { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { requireInstitution } from "../utils/requireInstitution";
import { AppError } from "../middleware/errorHandler";
import * as service from "../services/institutionalCms.service";

function assertAuthenticated(req: Request) {
  if (!req.user) throw new AppError("Authentication is required", 401);
  if (!req.user.roles.includes("SUPER_ADMIN") && !req.user.permissions.includes("site.manage")) {
    throw new AppError("Institutional CMS permission is required", 403);
  }
}

export const get = asyncHandler(async (req: Request, res: Response) => {
  assertAuthenticated(req);
  const institutionId = requireInstitution(req);
  res.json({ success: true, data: await service.getInstitutionalCms(institutionId, req.user!) });
});

export const update = asyncHandler(async (req: Request, res: Response) => {
  assertAuthenticated(req);
  const institutionId = requireInstitution(req);
  res.json({
    success: true,
    data: await service.updateInstitutionalCms(
      institutionId,
      req.user!,
      req.body?.content ?? req.body,
    ),
  });
});
