import { AppError } from "../../middleware/errorHandler";
import { recordAuditLog } from "../../services/audit.service";
import { exportData, EXPORT_TYPES } from "../../services/export.service";
import type { ExportFormat, ExportRequestOptions, ExportType } from "../../services/export.service";
import { loadActiveJobActor } from "../../services/backgroundJob.service";
import { deleteFile, deleteFilesByReference, storeFile } from "../../services/fileStorage.service";
import { registerJobHandler } from "../registry";
import { JOB_TYPES } from "../types";

registerJobHandler(JOB_TYPES.BULK_EXPORT, async (ctx) => {
  if (!ctx.institutionId || !ctx.createdById) throw new AppError("Export jobs require an institutional creator.", 400);
  const type = typeof ctx.payload.exportType === "string" ? ctx.payload.exportType : "";
  const format = typeof ctx.payload.format === "string" ? ctx.payload.format : "";
  if (!EXPORT_TYPES.includes(type as ExportType)) throw new AppError("Export job type is invalid.", 400);
  if (!["xlsx", "csv", "docx", "pdf", "json"].includes(format)) throw new AppError("Export job format is invalid.", 400);
  if (await ctx.isCancellationRequested()) return { cancelled: true };
  const rawOptions = ctx.payload.options;
  if (!rawOptions || typeof rawOptions !== "object" || Array.isArray(rawOptions)) throw new AppError("Export options are invalid.", 400);
  const options = rawOptions as ExportRequestOptions;
  const actor = await loadActiveJobActor(ctx.institutionId, ctx.createdById);
  await deleteFilesByReference(ctx.institutionId, "exports", ctx.jobId);
  const artifact = await exportData(ctx.institutionId, actor, type as ExportType, format as ExportFormat, options, true);
  if (await ctx.isCancellationRequested()) return { cancelled: true };
  const stored = await storeFile({
    institutionId: ctx.institutionId,
    module: "exports",
    buffer: artifact.buffer,
    filename: artifact.filename,
    mimeType: artifact.contentType.split(";")[0],
    ownerId: actor.id,
    referenceId: ctx.jobId,
    visibility: "private",
    resourceType: "raw",
  });
  if (await ctx.isCancellationRequested()) {
    await deleteFile(stored.id, ctx.institutionId);
    return { cancelled: true };
  }
  await ctx.progress(artifact.rowCount, 0, artifact.rowCount);
  await recordAuditLog({
    institutionId: ctx.institutionId, userId: actor.id, action: "DATA_EXPORT",
    entityType: type, entityId: ctx.jobId,
    metadata: { format, rowCount: artifact.rowCount, selection: options.selection || "all-filtered", backgroundJobId: ctx.jobId, filterKeys: Object.keys(options.filters || {}) },
  });
  return { fileId: stored.id, filename: artifact.filename, contentType: artifact.contentType, rowCount: artifact.rowCount, type, format };
});
