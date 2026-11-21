import { Router } from "express";
import { authenticate } from "../middleware/authenticate";
import { authorize } from "../middleware/authorize";
import { validateBody, validateQuery } from "../middleware/validate";
import { asyncHandler } from "../utils/asyncHandler";
import { requireAuthenticatedUser, requireInstitution } from "../utils/requireInstitution";
import { buildPaginationMeta, parsePagination } from "../utils/pagination";
import { assertCampusInScope, assertDepartmentInScope, assertProgramInScope, getAuthorizedDepartmentIds, isInstitutionWide } from "../services/accessScope.service";
import * as service from "../services/batch.service";
import { createBatchSchema, listBatchesQuerySchema, updateBatchSchema, CreateBatchInput, UpdateBatchInput } from "../validators/batch.validators";

const router = Router();
router.use(authenticate);

router.get("/", authorize("batches.read"), validateQuery(listBatchesQuerySchema), asyncHandler(async (req, res) => {
  const institutionId = requireInstitution(req);
  const actor = requireAuthenticatedUser(req);
  const pagination = parsePagination(req);
  const programId = typeof req.query.programId === "string" ? req.query.programId : undefined;
  const departmentId = typeof req.query.departmentId === "string" ? req.query.departmentId : undefined;
  const campusId = typeof req.query.campusId === "string" ? req.query.campusId : undefined;

  if (campusId) await assertCampusInScope(institutionId, actor, campusId);
  if (departmentId) await assertDepartmentInScope(institutionId, actor, departmentId);
  if (programId) await assertProgramInScope(institutionId, actor, programId);

  const result = await service.listBatches(institutionId, {
    ...pagination,
    search: typeof req.query.search === "string" ? req.query.search : undefined,
    programId,
    departmentId,
    campusId,
    departmentIds: isInstitutionWide(actor) ? undefined : await getAuthorizedDepartmentIds(institutionId, actor),
    isActive: req.query.isActive === undefined ? undefined : req.query.isActive === "true",
  });
  res.json({ success: true, data: result.items, meta: buildPaginationMeta(result.total, pagination) });
}));

router.get("/:id", authorize("batches.read"), asyncHandler(async (req, res) => {
  const institutionId = requireInstitution(req);
  const actor = requireAuthenticatedUser(req);
  const batch = await service.getBatch(institutionId, req.params.id);
  await assertProgramInScope(institutionId, actor, batch.programId);
  res.json({ success: true, data: batch });
}));

router.post("/", authorize("batches.create"), validateBody(createBatchSchema), asyncHandler(async (req, res) => {
  const institutionId = requireInstitution(req);
  const actor = requireAuthenticatedUser(req);
  const input = req.body as CreateBatchInput;
  await assertProgramInScope(institutionId, actor, input.programId);
  const batch = await service.createBatch(institutionId, input);
  res.status(201).json({ success: true, data: batch });
}));

router.patch("/:id", authorize("batches.update"), validateBody(updateBatchSchema), asyncHandler(async (req, res) => {
  const institutionId = requireInstitution(req);
  const actor = requireAuthenticatedUser(req);
  const input = req.body as UpdateBatchInput;
  const current = await service.getBatch(institutionId, req.params.id);
  await assertProgramInScope(institutionId, actor, current.programId);
  if (input.programId) await assertProgramInScope(institutionId, actor, input.programId);
  const batch = await service.updateBatch(institutionId, req.params.id, input);
  res.json({ success: true, data: batch });
}));

router.delete("/:id", authorize("batches.delete"), asyncHandler(async (req, res) => {
  const institutionId = requireInstitution(req);
  const actor = requireAuthenticatedUser(req);
  const current = await service.getBatch(institutionId, req.params.id);
  await assertProgramInScope(institutionId, actor, current.programId);
  const batch = await service.deactivateBatch(institutionId, req.params.id);
  res.json({ success: true, data: batch });
}));

export default router;
