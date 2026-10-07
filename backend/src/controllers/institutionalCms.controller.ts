import { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { requireInstitution } from "../utils/requireInstitution";
import { AppError } from "../middleware/errorHandler";
import * as service from "../services/institutionalCms.service";

function user(req: Request) {
  if (!req.user) throw new AppError("Authentication is required", 401);
  return req.user;
}

export const get = asyncHandler(async (req: Request, res: Response) => {
  const actor = user(req);
  const institutionId = requireInstitution(req);
  res.json({ success: true, data: await service.getInstitutionalCms(institutionId, actor) });
});

export const update = asyncHandler(async (req: Request, res: Response) => {
  const actor = user(req);
  const institutionId = requireInstitution(req);
  res.json({ success: true, data: await service.updateInstitutionalCms(institutionId, actor, req.body?.content ?? req.body) });
});

export const submit = asyncHandler(async (req: Request, res: Response) => {
  const actor = user(req);
  const institutionId = requireInstitution(req);
  res.json({ success: true, data: await service.submitInstitutionalCms(institutionId, actor) });
});

export const approve = asyncHandler(async (req: Request, res: Response) => {
  const actor = user(req);
  const institutionId = requireInstitution(req);
  res.json({ success: true, data: await service.approveInstitutionalCms(institutionId, actor) });
});

export const reject = asyncHandler(async (req: Request, res: Response) => {
  const actor = user(req);
  const institutionId = requireInstitution(req);
  res.json({ success: true, data: await service.rejectInstitutionalCms(institutionId, actor, typeof req.body?.reason === "string" ? req.body.reason : "") });
});
