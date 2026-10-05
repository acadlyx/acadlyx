import { randomUUID } from "crypto";
import { prisma } from "./lib/prisma";
import { logger } from "./utils/logger";
import { claimNextJob, completeJob, cancelClaimedJob, failJob, heartbeatJob, recoverStaleJobs, isCancellationRequested, updateJobProgress } from "./services/backgroundJob.service";
import { getJobHandler } from "./jobs/registry";
import "./handlers/admitCard.handler";
import "./handlers/import.handler";
import "./handlers/result.handler";

const workerId = "worker-" + randomUUID();
const POLL_MS = Number(process.env.JOB_POLL_MS || 1000);
const HEARTBEAT_MS = Number(process.env.JOB_HEARTBEAT_MS || 15000);
const STALE_MS = Number(process.env.JOB_STALE_MS || 120000);
const CONCURRENCY = Math.max(1, Math.min(8, Number(process.env.JOB_CONCURRENCY || 2)));
let stopping = false;
const active = new Set<Promise<void>>();

function retryable(error: unknown) {
  if (error && typeof error === "object" && "statusCode" in error && typeof (error as {statusCode?:unknown}).statusCode === "number") {
    const status = (error as {statusCode:number}).statusCode;
    return status >= 500;
  }
  return true;
}

async function execute(job: NonNullable<Awaited<ReturnType<typeof claimNextJob>>>) {
  const ctx = {
    jobId: job.id, workerId, institutionId: job.institutionId, createdById: job.createdById,
    payload: (job.payload ?? {}) as Record<string, unknown>,
    heartbeat: () => heartbeatJob(job.id, workerId),
    progress: (processed: number, failed: number, total: number) => updateJobProgress(job.id, workerId, processed, failed, total),
    isCancellationRequested: () => isCancellationRequested(job.id),
  };
  const heartbeatTimer = setInterval(() => { void heartbeatJob(job.id, workerId); }, HEARTBEAT_MS);
  try {
    logger.info("Background job started", { jobId: job.id, type: job.type, workerId });
    const result = await getJobHandler(job.type as never)(ctx);
    const cancelled = await isCancellationRequested(job.id);
    if (cancelled || result?.cancelled === true) await cancelClaimedJob(job.id, workerId);
    else if (!await completeJob(job.id, workerId, (result ?? undefined) as never)) await cancelClaimedJob(job.id, workerId);
    logger.info("Background job finished", { jobId: job.id, type: job.type, workerId, cancelled });
  } catch (error) {
    await failJob(job.id, workerId, error, retryable(error));
    logger.error("Background job failed", { jobId: job.id, type: job.type, workerId, error: error instanceof Error ? error.message : String(error) });
  } finally {
    clearInterval(heartbeatTimer);
  }
}

async function reap() {
  const recovered = await recoverStaleJobs(STALE_MS);
  if (recovered) logger.warn("Recovered stale background jobs", { recovered });
}

async function loop() {
  while (!stopping) {
    try {
      await reap();
      while (!stopping && active.size < CONCURRENCY) {
        const job = await claimNextJob(workerId);
        if (!job) break;
        const task = execute(job).finally(() => active.delete(task));
        active.add(task);
      }
    } catch (error) {
      logger.error("Background worker loop failure", { error: error instanceof Error ? error.message : String(error) });
    }
    if (!stopping) await new Promise(resolve => setTimeout(resolve, POLL_MS));
  }
  await Promise.allSettled([...active]);
}

async function shutdown(signal: string) {
  if (stopping) return;
  stopping = true;
  logger.info("Background worker shutting down", { signal, workerId });
  await Promise.race([
    Promise.allSettled([...active]),
    new Promise(resolve => setTimeout(resolve, 25_000)),
  ]);
  await prisma.$disconnect();
  process.exit(0);
}
process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));
loop().catch(async error => {
  logger.error("Background worker terminated", { error: error instanceof Error ? error.message : String(error) });
  await prisma.$disconnect();
  process.exit(1);
});
