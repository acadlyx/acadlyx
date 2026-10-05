import { loadActiveJobActor } from "../../services/backgroundJob.service";
import { publishExamResults } from "../../services/examination.service";
import { AppError } from "../../middleware/errorHandler";
import { registerJobHandler } from "../registry";
import { JOB_TYPES } from "../types";

registerJobHandler(JOB_TYPES.RESULT_PROCESSING, async ctx => {
  if (!ctx.institutionId || !ctx.createdById) throw new AppError("Result jobs require an institutional creator.", 400);
  const examScheduleId = typeof ctx.payload.examScheduleId === "string" ? ctx.payload.examScheduleId : "";
  if (!examScheduleId) throw new AppError("Result job payload is invalid.", 400);
  if (await ctx.isCancellationRequested()) return { cancelled: true };
  const actor = await loadActiveJobActor(ctx.institutionId, ctx.createdById);
  const result = await publishExamResults(ctx.institutionId, actor, examScheduleId, {});
  await ctx.progress(result.published, 0, result.published);
  return result;
});
