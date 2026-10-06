import { Request, Response } from "express";
import { getAcademicContextOptions } from "../services/academicContext.service";
import { asyncHandler } from "../utils/asyncHandler";
import { requireInstitution, requireAuthenticatedUser } from "../utils/requireInstitution";

export const academicContextOptions = asyncHandler(async (req: Request, res: Response) => {
  const institutionId = requireInstitution(req);
  const actor = requireAuthenticatedUser(req);

  const data = await getAcademicContextOptions(institutionId, actor, {
    departmentId: typeof req.query.departmentId === "string" ? req.query.departmentId : undefined,
    programId: typeof req.query.programId === "string" ? req.query.programId : undefined,
    academicYearId: typeof req.query.academicYearId === "string" ? req.query.academicYearId : undefined,
    semesterId: typeof req.query.semesterId === "string" ? req.query.semesterId : undefined,
  });

  res.status(200).json({ success: true, data });
});
