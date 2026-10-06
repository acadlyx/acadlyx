import { Request, Response } from "express";
import { requireAuthenticatedUser } from "../utils/requireInstitution";
import { assertCourseInScope, assertDepartmentInScope, getAuthorizedDepartmentIds, isInstitutionWide } from "../services/accessScope.service";
import * as courseService from "../services/course.service";
import { asyncHandler } from "../utils/asyncHandler";
import { buildPaginationMeta, parsePagination } from "../utils/pagination";
import { requireInstitution } from "../utils/requireInstitution";
import {
  CreateCourseInput,
  UpdateCourseInput,
} from "../validators/course.validators";

export const list = asyncHandler(async (req: Request, res: Response) => {
  const institutionId = requireInstitution(req);
  const actor = requireAuthenticatedUser(req);
  const pagination = parsePagination(req);
  const search = (req.query.search as string | undefined) || undefined;
  const departmentId =
    (req.query.departmentId as string | undefined) || undefined;
  const isActive =
    req.query.isActive === undefined ? undefined : req.query.isActive === "true";

  const { items, total } = await courseService.listCourses(institutionId, {
    ...pagination,
    search,
    departmentId,
    departmentIds: isInstitutionWide(actor) ? undefined : await getAuthorizedDepartmentIds(institutionId, actor),
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
  const actor = requireAuthenticatedUser(req);
  await assertCourseInScope(institutionId, actor, req.params.id);
  const course = await courseService.getCourseById(institutionId, req.params.id);
  res.status(200).json({ success: true, data: course });
});

export const create = asyncHandler(async (req: Request, res: Response) => {
  const institutionId = requireInstitution(req);
  const actor = requireAuthenticatedUser(req);
  await assertDepartmentInScope(institutionId, actor, (req.body as CreateCourseInput).departmentId);
  const course = await courseService.createCourse(
    institutionId,
    req.body as CreateCourseInput
  );
  res.status(201).json({ success: true, data: course });
});

export const update = asyncHandler(async (req: Request, res: Response) => {
  const institutionId = requireInstitution(req);
  const actor = requireAuthenticatedUser(req);
  await assertCourseInScope(institutionId, actor, req.params.id);
  if ((req.body as UpdateCourseInput).departmentId) await assertDepartmentInScope(institutionId, actor, (req.body as UpdateCourseInput).departmentId!);
  const course = await courseService.updateCourse(
    institutionId,
    req.params.id,
    req.body as UpdateCourseInput
  );
  res.status(200).json({ success: true, data: course });
});

export const deactivate = asyncHandler(async (req: Request, res: Response) => {
  const institutionId = requireInstitution(req);
  const actor = requireAuthenticatedUser(req);
  await assertCourseInScope(institutionId, actor, req.params.id);
  const course = await courseService.deactivateCourse(
    institutionId,
    req.params.id
  );
  res.status(200).json({ success: true, data: course });
});
