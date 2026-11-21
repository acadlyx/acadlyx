import { Request, Response } from "express";
import { AppError } from "../middleware/errorHandler";
import * as academicYearService from "../services/academicYear.service";
import { assertAcademicYearInScope, assertCampusInScope, assertDepartmentInScope, assertProgramInScope, getAuthorizedDepartmentIds, isInstitutionWide } from "../services/accessScope.service";
import { requireAuthenticatedUser } from "../utils/requireInstitution";
import { asyncHandler } from "../utils/asyncHandler";
import { buildPaginationMeta, parsePagination } from "../utils/pagination";
import {
  CreateAcademicYearInput,
  UpdateAcademicYearInput,
} from "../validators/academicYear.validators";

function requireInstitution(req: Request): string {
  const institutionId = req.user?.institutionId;
  if (!institutionId) {
    throw new AppError(
      "This action requires a user scoped to an institution",
      403
    );
  }
  return institutionId;
}

export const list = asyncHandler(async (req: Request, res: Response) => {
  const institutionId = requireInstitution(req);
  const actor = requireAuthenticatedUser(req);
  const pagination = parsePagination(req);
  const search = (req.query.search as string | undefined) || undefined;
  const campusId = (req.query.campusId as string | undefined) || undefined;
  const departmentId = (req.query.departmentId as string | undefined) || undefined;
  const programId = (req.query.programId as string | undefined) || undefined;

  if (campusId) await assertCampusInScope(institutionId, actor, campusId);
  if (departmentId) await assertDepartmentInScope(institutionId, actor, departmentId);
  if (programId) await assertProgramInScope(institutionId, actor, programId);

  const { items, total } = await academicYearService.listAcademicYears(
    institutionId,
    {
      ...pagination,
      search,
      campusId,
      departmentId,
      programId,
      departmentIds: isInstitutionWide(actor) ? undefined : await getAuthorizedDepartmentIds(institutionId, actor),
    }
  );

  res.status(200).json({
    success: true,
    data: items,
    meta: buildPaginationMeta(total, pagination),
  });
});

export const getById = asyncHandler(async (req: Request, res: Response) => {
  const institutionId = requireInstitution(req);
  const actor = requireAuthenticatedUser(req);
  await assertAcademicYearInScope(institutionId, actor, req.params.id);
  const year = await academicYearService.getAcademicYearById(
    institutionId,
    req.params.id
  );
  res.status(200).json({ success: true, data: year });
});

export const create = asyncHandler(async (req: Request, res: Response) => {
  const institutionId = requireInstitution(req);
  const actor = requireAuthenticatedUser(req);
  if (!isInstitutionWide(actor)) throw new AppError("Only institution-wide administrators can create academic years", 403);
  const year = await academicYearService.createAcademicYear(
    institutionId,
    req.body as CreateAcademicYearInput
  );
  res.status(201).json({ success: true, data: year });
});

export const update = asyncHandler(async (req: Request, res: Response) => {
  const institutionId = requireInstitution(req);
  const actor = requireAuthenticatedUser(req);
  if (!isInstitutionWide(actor)) throw new AppError("Only institution-wide administrators can update academic years", 403);
  const year = await academicYearService.updateAcademicYear(
    institutionId,
    req.params.id,
    req.body as UpdateAcademicYearInput
  );
  res.status(200).json({ success: true, data: year });
});
