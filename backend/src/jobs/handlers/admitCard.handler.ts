import { registerJobHandler } from "./registry";
import { JOB_TYPES } from "./types";
import { processBulkAdmitCardsJob } from "../../services/admitCardGeneration.service";

registerJobHandler(JOB_TYPES.ADMIT_CARD_GENERATION, async ctx => {
  if (!ctx.institutionId || !ctx.createdById) throw new Error("Admit-card jobs require an institutional creator.");
  return processBulkAdmitCardsJob({
    jobId: ctx.jobId, workerId: ctx.workerId, institutionId: ctx.institutionId,
    createdById: ctx.createdById, payload: ctx.payload, heartbeat: ctx.heartbeat,
    progress: ctx.progress, isCancellationRequested: ctx.isCancellationRequested,
  });
});
