import { Request, Response } from "express";
import * as sectionService from "../services/section.service";
import { asyncHandler } from "../utils/asyncHandler";
import { buildPaginationMeta, parsePagination } from "../utils/pagination";
import { requireInstitution } from "../utils/requireInstitution";
import {
  CreateSectionInput,
  UpdateSectionInput,
} from "../validators/section.validators";

export const list = asyncHandler(async (req: Request, res: Response) => {
  const institutionId = requireInstitution(req);
  const pagination = parsePagination(req);
  const search = (req.query.search as string | undefined) || undefined;
  const semesterId = (req.query.semesterId as string | undefined) || undefined;
  const isActive =
    req.query.isActive === undefined ? undefined : req.query.isActive === "true";

  const { items, total } = await sectionService.listSections(institutionId, {
    ...pagination,
    search,
    semesterId,
    isActive,
  });

  res.status(200).json({
    success: true,
    data: items,
    meta: buildPaginationMeta(total, pagination),
  });
});

export const getById = asyncHandler(async (req: Request, res: Response) => {
  const institutionId = requireInstitution(req);
  const section = await sectionService.getSectionById(
    institutionId,
    req.params.id
  );
  res.status(200).json({ success: true, data: section });
});

export const create = asyncHandler(async (req: Request, res: Response) => {
  const institutionId = requireInstitution(req);
  const section = await sectionService.createSection(
    institutionId,
    req.body as CreateSectionInput
  );
  res.status(201).json({ success: true, data: section });
});

export const update = asyncHandler(async (req: Request, res: Response) => {
  const institutionId = requireInstitution(req);
  const section = await sectionService.updateSection(
    institutionId,
    req.params.id,
    req.body as UpdateSectionInput
  );
  res.status(200).json({ success: true, data: section });
});

export const deactivate = asyncHandler(async (req: Request, res: Response) => {
  const institutionId = requireInstitution(req);
  const section = await sectionService.deactivateSection(
    institutionId,
    req.params.id
  );
  res.status(200).json({ success: true, data: section });
});
