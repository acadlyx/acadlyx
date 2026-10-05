import { getFileDelivery } from "../../services/fileStorage.service";
import { loadActiveJobActor } from "../../services/backgroundJob.service";
import { commit, ImportType, IMPORT_TYPES } from "../../services/import.service";
import { AppError } from "../../middleware/errorHandler";
import { registerJobHandler } from "../registry";
import { JOB_TYPES } from "../types";

registerJobHandler(JOB_TYPES.BULK_IMPORT, async ctx => {
  if (!ctx.institutionId || !ctx.createdById) throw new AppError("Import jobs require an institutional creator.", 400);
  const fileId = typeof ctx.payload.fileId === "string" ? ctx.payload.fileId : "";
  const type = typeof ctx.payload.importType === "string" ? ctx.payload.importType : "";
  const mode = ctx.payload.mode === "partial" ? "partial" : "atomic";
  if (!fileId || !IMPORT_TYPES.includes(type as ImportType)) throw new AppError("Import job payload is invalid.", 400);
  const actor = await loadActiveJobActor(ctx.institutionId, ctx.createdById);
  const delivery = await getFileDelivery(fileId, ctx.institutionId, true);
  const response = await fetch(delivery.url);
  if (!response.ok) throw new Error("Stored import file could not be downloaded.");
  const buffer = Buffer.from(await response.arrayBuffer());
  const result = await commit(buffer, type as ImportType, ctx.institutionId, actor, {
    mode,
    onProgress: async (processed, failed, total) => {
      if (await ctx.isCancellationRequested()) return;
      await ctx.progress(processed, failed, total);
    },
  });
  return { ...result, fileId };
});
