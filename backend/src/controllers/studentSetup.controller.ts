import { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { requireAuthenticatedUser, requireInstitution } from "../utils/requireInstitution";
import * as studentSetupService from "../services/studentSetup.service";

export const completeSetup = asyncHandler(async (req: Request, res: Response) => {
  const institutionId = requireInstitution(req);
  const actor = requireAuthenticatedUser(req);
  const data = await studentSetupService.completeStudentSetup(
    institutionId,
    req.params.id,
    actor,
    {
      ipAddress: req.ip,
      userAgent: req.get("user-agent") || undefined,
    }
  );
  res.status(200).json({ success: true, data });
});
