import { Prisma } from "@prisma/client";
import { randomUUID } from "crypto";
import { prisma } from "../lib/prisma";
import { AppError } from "../middleware/errorHandler";
import { AuthenticatedUser } from "../types/auth";
import { recordAuditLog } from "./audit.service";

export const JOB_STATUS = {
  QUEUED: "QUEUED", PROCESSING: "PROCESSING", COMPLETED: "COMPLETED",
  FAILED: "FAILED", CANCEL_REQUESTED: "CANCEL_REQUESTED", CANCELLED: "CANCELLED",
} as const;
export type JobStatus = typeof JOB_STATUS[keyof typeof JOB_STATUS];

export interface EnqueueJobInput {
  institutionId: string | null; type: string; payload: Prisma.InputJsonValue;
  createdById?: string | null; priority?: number; total?: number;
  maxAttempts?: number; idempotencyKey?: string;
}

export async function enqueueJob(input: EnqueueJobInput) {
  try {
    const job = await prisma.backgroundJob.create({ data: {
      id: randomUUID(), institutionId: input.institutionId, type: input.type,
      status: JOB_STATUS.QUEUED, priority: input.priority ?? 100,
      payload: input.payload, total: input.total ?? 0,
      maxAttempts: input.maxAttempts ?? 5, createdById: input.createdById ?? null,
      idempotencyKey: input.idempotencyKey ?? null,
    }});
    if (input.institutionId && input.createdById) await recordAuditLog({
      institutionId: input.institutionId, userId: input.createdById, action: "job.created",
      entityType: "BackgroundJob", entityId: job.id, metadata: { type: input.type, total: input.total ?? 0 },
    });
    return job;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002" && input.idempotencyKey) {
      const existing = await prisma.backgroundJob.findFirst({ where: { institutionId: input.institutionId, idempotencyKey: input.idempotencyKey }});
      if (!existing) throw error;
      if (existing.type !== input.type) throw new AppError("Idempotency key is already associated with another job type.", 409);
      return existing;
    }
    throw error;
  }
}


export async function loadActiveJobActor(institutionId: string, userId: string): Promise<AuthenticatedUser> {
  const user = await prisma.user.findFirst({
    where: { id: userId, institutionId, isActive: true, deletedAt: null },
    include: {
      userRoles: {
        include: {
          role: {
            include: {
              rolePermissions: { include: { permission: true } },
            },
          },
        },
      },
    },
  });
  if (!user) throw new AppError("The job creator is no longer an active institutional user.", 409);

  const permissions = Array.from(new Set(
    user.userRoles.flatMap(binding =>
      binding.role.rolePermissions.map(rolePermission => rolePermission.permission.key)
    )
  ));

  return {
    id: user.id,
    institutionId: user.institutionId,
    email: user.email,
    idNumber: user.idNumber,
    firstName: user.firstName,
    lastName: user.lastName,
    roles: user.userRoles.map(x => x.role.name),
    permissions,
  };
}

export async function getJob(institutionId: string, actor: AuthenticatedUser, id: string) {
  const job = await prisma.backgroundJob.findFirst({ where: { id, institutionId }});
  if (!job) throw new AppError("Job not found.", 404);
  return job;
}

export async function requestCancellation(institutionId: string, actor: AuthenticatedUser, id: string) {
  const job = await prisma.backgroundJob.findFirst({ where: { id, institutionId }});
  if (!job) throw new AppError("Job not found.", 404);
  if ([JOB_STATUS.COMPLETED, JOB_STATUS.FAILED, JOB_STATUS.CANCELLED].includes(job.status as JobStatus)) return job;
  if (job.status === JOB_STATUS.QUEUED) {
    await prisma.backgroundJob.updateMany({
      where: { id, institutionId, status: JOB_STATUS.QUEUED },
      data: { status: JOB_STATUS.CANCELLED, cancelledAt: new Date(), updatedAt: new Date() },
    });
  } else {
    await prisma.backgroundJob.updateMany({
      where: { id, institutionId, status: JOB_STATUS.PROCESSING },
      data: { status: JOB_STATUS.CANCEL_REQUESTED, updatedAt: new Date() },
    });
  }
  await recordAuditLog({ institutionId, userId: actor.id, action: "job.cancel_requested", entityType: "BackgroundJob", entityId: id });
  return prisma.backgroundJob.findFirstOrThrow({ where: { id, institutionId }});
}

export async function claimNextJob(workerId: string) {
  return prisma.$transaction(async tx => {
    const rows = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
      SELECT "id" FROM "background_jobs"
      WHERE "status" = 'QUEUED' AND "availableAt" <= CURRENT_TIMESTAMP
      ORDER BY "priority" ASC, "createdAt" ASC
      FOR UPDATE SKIP LOCKED LIMIT 1
    `);
    if (!rows[0]) return null;
    const updated = await tx.backgroundJob.updateMany({
      where: { id: rows[0].id, status: JOB_STATUS.QUEUED },
      data: { status: JOB_STATUS.PROCESSING, workerId, attemptCount: { increment: 1 },
        startedAt: new Date(), lastHeartbeatAt: new Date(), updatedAt: new Date() },
    });
    return updated.count ? tx.backgroundJob.findUnique({ where: { id: rows[0].id }}) : null;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted });
}

export async function heartbeatJob(id: string, workerId: string) {
  await prisma.backgroundJob.updateMany({ where: { id, workerId, status: JOB_STATUS.PROCESSING },
    data: { lastHeartbeatAt: new Date(), updatedAt: new Date() }});
}

export function backoffMs(attempt: number) {
  return Math.min(15 * 60_000, 5_000 * Math.pow(2, Math.max(0, attempt - 1)));
}

export async function recoverStaleJobs(staleAfterMs: number) {
  const cutoff = new Date(Date.now() - staleAfterMs);
  const stale = await prisma.backgroundJob.findMany({
    where: { status: JOB_STATUS.PROCESSING, OR: [{ lastHeartbeatAt: { lt: cutoff } }, { lastHeartbeatAt: null, startedAt: { lt: cutoff } }] },
    select: { id: true, attemptCount: true, maxAttempts: true }, take: 100,
  });
  let recovered = 0;
  for (const job of stale) {
    const retry = job.attemptCount < job.maxAttempts;
    const result = await prisma.backgroundJob.updateMany({
      where: { id: job.id, status: JOB_STATUS.PROCESSING, OR: [{ lastHeartbeatAt: { lt: cutoff } }, { lastHeartbeatAt: null, startedAt: { lt: cutoff } }] },
      data: retry
        ? { status: JOB_STATUS.QUEUED, availableAt: new Date(Date.now() + backoffMs(job.attemptCount)),
            workerId: null, lastHeartbeatAt: null, errorCode: "STALE_WORKER",
            errorMessage: "Worker lease expired; job requeued.", updatedAt: new Date() }
        : { status: JOB_STATUS.FAILED, failedAt: new Date(), workerId: null,
            errorCode: "STALE_WORKER", errorMessage: "Worker lease expired after maximum attempts.", updatedAt: new Date() },
    });
    recovered += result.count;
  }
  return recovered;
}

export async function updateJobProgress(id: string, workerId: string, processed: number, failed: number, total: number) {
  const progress = total > 0 ? Math.min(100, Math.floor(((processed + failed) / total) * 100)) : 0;
  const result = await prisma.backgroundJob.updateMany({
    where: { id, workerId, status: { in: [JOB_STATUS.PROCESSING, JOB_STATUS.CANCEL_REQUESTED] }},
    data: { processed, failed, total, progress, lastHeartbeatAt: new Date(), updatedAt: new Date() },
  });
  return result.count > 0;
}

export async function completeJob(id: string, workerId: string, result?: Prisma.InputJsonValue) {
  const updated = await prisma.backgroundJob.updateMany({
    where: { id, workerId, status: JOB_STATUS.PROCESSING },
    data: { status: JOB_STATUS.COMPLETED, progress: 100, completedAt: new Date(),
      result, lastHeartbeatAt: new Date(), updatedAt: new Date() },
  });
  return updated.count > 0;
}

export async function failJob(id: string, workerId: string, error: unknown, retryable: boolean) {
  const job = await prisma.backgroundJob.findUnique({ where: { id }});
  if (!job || job.workerId !== workerId || ![JOB_STATUS.PROCESSING, JOB_STATUS.CANCEL_REQUESTED].includes(job.status as JobStatus)) return;
  const message = error instanceof Error ? error.message : String(error);
  const retry = retryable && job.attemptCount < job.maxAttempts && job.status !== JOB_STATUS.CANCEL_REQUESTED;
  await prisma.backgroundJob.update({ where: { id }, data: retry
    ? { status: JOB_STATUS.QUEUED, availableAt: new Date(Date.now() + backoffMs(job.attemptCount)),
        workerId: null, errorCode: "RETRY_SCHEDULED", errorMessage: message.slice(0,1000), updatedAt: new Date() }
    : { status: job.status === JOB_STATUS.CANCEL_REQUESTED ? JOB_STATUS.CANCELLED : JOB_STATUS.FAILED,
        failedAt: job.status === JOB_STATUS.CANCEL_REQUESTED ? undefined : new Date(),
        cancelledAt: job.status === JOB_STATUS.CANCEL_REQUESTED ? new Date() : undefined,
        workerId: null, errorCode: "JOB_FAILED",
        errorMessage: message.slice(0,1000), updatedAt: new Date() }});
}

export async function isCancellationRequested(id: string) {
  const job = await prisma.backgroundJob.findUnique({ where: { id }, select: { status: true }});
  return job?.status === JOB_STATUS.CANCEL_REQUESTED || job?.status === JOB_STATUS.CANCELLED;
}

export async function cancelClaimedJob(id: string, workerId: string) {
  await prisma.backgroundJob.updateMany({
    where: { id, workerId, status: JOB_STATUS.CANCEL_REQUESTED },
    data: { status: JOB_STATUS.CANCELLED, cancelledAt: new Date(), workerId: null, updatedAt: new Date() },
  });
}

export async function getOwnedJob(institutionId: string, actor: AuthenticatedUser, id: string) {
  const job = await prisma.backgroundJob.findFirst({ where: { id, institutionId, createdById: actor.id } });
  if (!job) throw new AppError("Job not found.", 404);
  return job;
}
