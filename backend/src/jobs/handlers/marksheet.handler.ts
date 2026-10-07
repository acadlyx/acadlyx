import { registerJobHandler } from "../registry";
import { JOB_TYPES } from "../types";
import { processBulkMarksheetsJob } from "../../services/marksheetGeneration.service";

registerJobHandler(JOB_TYPES.MARKSHEET_GENERATION, async (ctx) => {
  if (!ctx.institutionId || !ctx.createdById) {
    throw new Error("Marksheet jobs require an institutional creator.");
  }
  return processBulkMarksheetsJob({
    jobId: ctx.jobId,
    workerId: ctx.workerId,
    institutionId: ctx.institutionId,
    createdById: ctx.createdById,
    payload: ctx.payload,
    progress: ctx.progress,
    isCancellationRequested: ctx.isCancellationRequested,
  });
});
