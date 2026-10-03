import { Router } from "express";
import { authenticate } from "../middleware/authenticate";
import { authorize } from "../middleware/authorize";
import { asyncHandler } from "../utils/asyncHandler";
import { requireInstitution } from "../utils/requireInstitution";
import { buildPaginationMeta, parsePagination } from "../utils/pagination";
import * as service from "../services/batch.service";

const router = Router();
router.use(authenticate);

router.get("/", authorize("batches.read"), asyncHandler(async (req, res) => {
  const institutionId = requireInstitution(req);
  const pagination = parsePagination(req);
  const result = await service.listBatches(institutionId, {
    ...pagination,
    search: typeof req.query.search === "string" ? req.query.search : undefined,
    programId: typeof req.query.programId === "string" ? req.query.programId : undefined,
    isActive: req.query.isActive === undefined ? undefined : req.query.isActive === "true",
  });
  res.json({ success: true, data: result.items, meta: buildPaginationMeta(result.total, pagination) });
}));

router.get("/:id", authorize("batches.read"), asyncHandler(async (req, res) => {
  res.json({ success: true, data: await service.getBatch(requireInstitution(req), req.params.id) });
}));

router.post("/", authorize("batches.create"), asyncHandler(async (req, res) => {
  const input = req.body ?? {};
  res.status(201).json({ success: true, data: await service.createBatch(requireInstitution(req), input) });
}));

router.patch("/:id", authorize("batches.update"), asyncHandler(async (req, res) => {
  res.json({ success: true, data: await service.updateBatch(requireInstitution(req), req.params.id, req.body ?? {}) });
}));

router.delete("/:id", authorize("batches.delete"), asyncHandler(async (req, res) => {
  res.json({ success: true, data: await service.deactivateBatch(requireInstitution(req), req.params.id) });
}));

export default router;
