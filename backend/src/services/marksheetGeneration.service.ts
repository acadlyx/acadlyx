import { Prisma } from "@prisma/client";
import { mkdir, rm, writeFile } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { prisma } from "../lib/prisma";
import { AuthenticatedUser } from "../types/auth";
import { AppError } from "../middleware/errorHandler";
import { assertExaminationController } from "./workflowAuthority.service";
import { generateStudentMarksheetPdf } from "./examination.service";
import {
  enqueueJob,
  getJob,
  getOwnedJob,
  requestCancellation,
  loadActiveJobActor,
} from "./backgroundJob.service";
import { JOB_TYPES } from "../jobs/types";
import { appendZipEntry, finishZipArchive, type ZipEntry } from "./zipArchive.service";
import { storeFileFromPath } from "./fileStorage.service";
import { recordAuditLog } from "./audit.service";

async function assertSessionResultsFullyPublished(
  institutionId: string,
  examSessionId: string,
): Promise<void> {
  const rows = await prisma.$queryRaw<
    Array<{ schedules: number; publishedSchedules: number; approvedMarks: number; publishedPublications: number }>
  >(Prisma.sql`
    SELECT
      COUNT(s."id")::int AS "schedules",
      COUNT(s."id") FILTER (WHERE s."status"='RESULTS_PUBLISHED')::int AS "publishedSchedules",
      COALESCE((
        SELECT COUNT(*)::int
        FROM "exam_marks" m
        JOIN "exam_schedules" ms ON ms."id"=m."examScheduleId"
        WHERE ms."examSessionId"=${examSessionId}
          AND ms."institutionId"=${institutionId}
          AND m."status"='APPROVED'
      ),0) AS "approvedMarks",
      COALESCE((
        SELECT COUNT(*)::int
        FROM "exam_result_publications" p
        JOIN "exam_schedules" ps ON ps."id"=p."examScheduleId"
        WHERE ps."examSessionId"=${examSessionId}
          AND ps."institutionId"=${institutionId}
          AND p."status"='PUBLISHED'
      ),0) AS "publishedPublications"
    FROM "exam_schedules" s
    WHERE s."examSessionId"=${examSessionId}
      AND s."institutionId"=${institutionId}
  `);

  const state = rows[0];
  if (!state || state.schedules === 0) {
    throw new AppError("No examination schedules are available for this session.", 404);
  }
  if (
    state.publishedSchedules !== state.schedules ||
    state.publishedPublications !== state.schedules ||
    state.approvedMarks > 0
  ) {
    throw new AppError(
      "Bulk marksheets are available only after every examination result in the session is published.",
      409,
    );
  }
}

export async function enqueueBulkMarksheets(
  institutionId: string,
  actor: AuthenticatedUser,
  examSessionId: string,
) {
  assertExaminationController(actor);
  await assertSessionResultsFullyPublished(institutionId, examSessionId);

  const rows = await prisma.$queryRaw<Array<{ count: number }>>(Prisma.sql`
    SELECT COUNT(DISTINCT m."studentId")::int AS count
    FROM "exam_marks" m
    JOIN "exam_schedules" s ON s."id"=m."examScheduleId"
    WHERE m."institutionId"=${institutionId}
      AND s."institutionId"=${institutionId}
      AND s."examSessionId"=${examSessionId}
      AND m."status"='PUBLISHED'
  `);
  const total = rows[0]?.count ?? 0;
  if (!total) throw new AppError("No published results are available for this examination.", 404);

  const job = await enqueueJob({
    institutionId,
    type: JOB_TYPES.MARKSHEET_GENERATION,
    payload: { examSessionId },
    createdById: actor.id,
    total,
    maxAttempts: 3,
    priority: 25,
    idempotencyKey: "MARKSHEET_ZIP:" + examSessionId,
  });

  return { jobId: job.id, status: job.status, total: job.total, progress: job.progress };
}

export async function processBulkMarksheetsJob(ctx: {
  jobId: string;
  workerId: string;
  institutionId: string;
  createdById: string;
  payload: Record<string, unknown>;
  progress(processed: number, failed: number, total: number): Promise<boolean>;
  isCancellationRequested(): Promise<boolean>;
}) {
  const examSessionId =
    typeof ctx.payload.examSessionId === "string" ? ctx.payload.examSessionId : "";
  if (!examSessionId) throw new AppError("Marksheet job payload is invalid.", 400);

  const actor = await loadActiveJobActor(ctx.institutionId, ctx.createdById);
  assertExaminationController(actor);
  await assertSessionResultsFullyPublished(ctx.institutionId, examSessionId);

  const students = await prisma.$queryRaw<Array<{ studentId: string }>>(Prisma.sql`
    SELECT DISTINCT m."studentId"
    FROM "exam_marks" m
    JOIN "exam_schedules" s ON s."id"=m."examScheduleId"
    WHERE m."institutionId"=${ctx.institutionId}
      AND s."institutionId"=${ctx.institutionId}
      AND s."examSessionId"=${examSessionId}
      AND m."status"='PUBLISHED'
    ORDER BY m."studentId"
  `);
  if (!students.length) throw new AppError("No published results are available for this examination.", 404);

  const dir = join(tmpdir(), "acadlyx-jobs", ctx.jobId);
  const zipPath = join(dir, "ACADLYX_" + examSessionId + "_Marksheets.zip");
  await mkdir(dir, { recursive: true });
  await writeFile(zipPath, Buffer.alloc(0));

  const entries: ZipEntry[] = [];
  let processed = 0;
  let failed = 0;
  const concurrency = 4;

  try {
    for (let start = 0; start < students.length; start += concurrency) {
      if (await ctx.isCancellationRequested()) {
        return { cancelled: true, processed, failed };
      }

      const batch = students.slice(start, start + concurrency);
      const generated = await Promise.all(
        batch.map(async (student) => {
          try {
            const pdf = await generateStudentMarksheetPdf(
              ctx.institutionId,
              actor,
              examSessionId,
              student.studentId,
            );
            return { studentId: student.studentId, pdf };
          } catch (error) {
            return {
              studentId: student.studentId,
              error: error instanceof Error ? error.message : String(error),
            };
          }
        }),
      );

      for (const result of generated) {
        if ("pdf" in result) {
          await appendZipEntry(zipPath, entries, result.pdf.filename, result.pdf.buffer);
          processed += 1;
        } else {
          failed += 1;
          await recordAuditLog({
            institutionId: ctx.institutionId,
            userId: ctx.createdById,
            action: "exam.marksheet_generation_item_failed",
            entityType: "ExamSession",
            entityId: examSessionId,
            metadata: { studentId: result.studentId, error: result.error },
          });
        }
      }

      if (!await ctx.progress(processed, failed, students.length)) {
        return { cancelled: true, processed, failed };
      }
    }

    if (!entries.length) {
      throw new AppError("No marksheets could be generated.", 422);
    }

    await finishZipArchive(zipPath, entries);
    const filename = "ACADLYX_" + examSessionId + "_Marksheets.zip";
    const stored = await storeFileFromPath({
      institutionId: ctx.institutionId,
      module: "results",
      path: zipPath,
      filename,
      mimeType: "application/zip",
      ownerId: ctx.createdById,
      referenceId: ctx.jobId,
      visibility: "private",
      resourceType: "raw",
    });

    await recordAuditLog({
      institutionId: ctx.institutionId,
      userId: ctx.createdById,
      action: "exam.marksheets_generated",
      entityType: "BackgroundJob",
      entityId: ctx.jobId,
      metadata: {
        examSessionId,
        processed,
        failed,
        fileId: stored.id,
      },
    });

    return { fileId: stored.id, filename, processed, failed };
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => undefined);
  }
}

export async function getMarksheetGenerationJob(
  institutionId: string,
  actor: AuthenticatedUser,
  id: string,
) {
  const job = await getJob(institutionId, actor, id);
  if (job.type !== JOB_TYPES.MARKSHEET_GENERATION) {
    throw new AppError("Marksheet generation job not found.", 404);
  }
  return job;
}

export async function cancelMarksheetGenerationJob(
  institutionId: string,
  actor: AuthenticatedUser,
  id: string,
) {
  assertExaminationController(actor);
  const job = await getOwnedJob(institutionId, actor, id);
  if (job.type !== JOB_TYPES.MARKSHEET_GENERATION) {
    throw new AppError("This is not a marksheet generation job.", 400);
  }
  return requestCancellation(institutionId, actor, id);
}
