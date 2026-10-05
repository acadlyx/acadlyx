import { Prisma } from "@prisma/client";
import { mkdir, rm, appendFile, writeFile, stat } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { prisma } from "../lib/prisma";
import { AuthenticatedUser } from "../types/auth";
import { AppError } from "../middleware/errorHandler";
import { assertExaminationController } from "./workflowAuthority.service";
import { generateStudentHallTicketPdf } from "./examination.service";
import { enqueueJob, getJob, loadActiveJobActor, requestCancellation } from "./backgroundJob.service";
import { JOB_TYPES } from "../jobs/types";
import { storeFileFromPath } from "./fileStorage.service";
import { recordAuditLog } from "./audit.service";

function crc32(buffer: Buffer): number {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function u16(n: number) { const b = Buffer.alloc(2); b.writeUInt16LE(n); return b; }
function u32(n: number) { const b = Buffer.alloc(4); b.writeUInt32LE(n >>> 0); return b; }

async function zipAppend(path: string, entries: Array<{ name: string; offset: number; crc: number; size: number }>, name: string, data: Buffer) {
  const nameBuffer = Buffer.from(name, "utf8");
  const crc = crc32(data);
  const fileStat = await stat(path);
  const local = Buffer.concat([
    Buffer.from("PK\x03\x04", "binary"), u16(20), u16(0x800), u16(0), u16(0), u16(0),
    u32(crc), u32(data.length), u32(data.length), u16(nameBuffer.length), u16(0), nameBuffer,
  ]);
  await appendFile(path, Buffer.concat([local, data]));
  entries.push({ name, offset: fileStat.size, crc, size: data.length });
}
async function finishZip(path: string, entries: Array<{ name: string; offset: number; crc: number; size: number }>) {
  const central: Buffer[] = [];
  for (const entry of entries) {
    const name = Buffer.from(entry.name, "utf8");
    central.push(Buffer.concat([
      Buffer.from("PK\x01\x02", "binary"), u16(20), u16(20), u16(0x800), u16(0), u16(0), u16(0),
      u32(entry.crc), u32(entry.size), u32(entry.size), u16(name.length), u16(0), u16(0), u16(0),
      u16(0), u32(0), u32(entry.offset), name,
    ]));
  }
  const centralBuffer = Buffer.concat(central);
  const fileStat = await stat(path);
  await appendFile(path, Buffer.concat([
    ...central,
    Buffer.concat([Buffer.from("PK\x05\x06", "binary"), u16(0), u16(0), u16(entries.length),
      u16(entries.length), u32(centralBuffer.length), u32(fileStat.size), u16(0)]),
  ]));
}

export async function enqueueBulkAdmitCardsZip(institutionId: string, actor: AuthenticatedUser, examSessionId: string) {
  assertExaminationController(actor);
  const rows = await prisma.$queryRaw<Array<{ count: number }>>(Prisma.sql`
    SELECT COUNT(*)::int AS count FROM "hall_tickets"
    WHERE "institutionId"=${institutionId} AND "examSessionId"=${examSessionId} AND "status"='ISSUED'
  `);
  const total = rows[0]?.count ?? 0;
  if (!total) throw new AppError("No issued hall tickets are available for this examination.", 404);
  const job = await enqueueJob({
    institutionId, type: JOB_TYPES.ADMIT_CARD_GENERATION, payload: { examSessionId },
    createdById: actor.id, total, maxAttempts: 3, priority: 20,
    idempotencyKey: "ADMIT_CARD_ZIP:" + examSessionId + ":" + actor.id,
  });
  return { jobId: job.id, status: job.status, total: job.total, progress: job.progress };
}

export async function processBulkAdmitCardsJob(ctx: {
  jobId: string; workerId: string; institutionId: string; createdById: string;
  payload: Record<string, unknown>; heartbeat(): Promise<void>;
  progress(processed: number, failed: number, total: number): Promise<boolean>;
  isCancellationRequested(): Promise<boolean>;
}) {
  const examSessionId = typeof ctx.payload.examSessionId === "string" ? ctx.payload.examSessionId : "";
  if (!examSessionId) throw new AppError("Admit-card job payload is invalid.", 400);
  const actor = await loadActiveJobActor(ctx.institutionId, ctx.createdById);
  assertExaminationController(actor);
  const students = await prisma.$queryRaw<Array<{ studentId: string; serialNumber: string }>>(Prisma.sql`
    SELECT "studentId","serialNumber" FROM "hall_tickets"
    WHERE "institutionId"=${ctx.institutionId} AND "examSessionId"=${examSessionId} AND "status"='ISSUED'
    ORDER BY "serialNumber" ASC
  `);
  if (!students.length) throw new AppError("No issued hall tickets are available for this examination.", 404);

  const dir = join(tmpdir(), "acadlyx-jobs", ctx.jobId);
  const zipPath = join(dir, "ACADLYX_" + examSessionId + "_AdmitCards.zip");
  await mkdir(dir, { recursive: true });
  await writeFile(zipPath, Buffer.alloc(0));
  const entries: Array<{ name: string; offset: number; crc: number; size: number }> = [];
  let processed = 0, failed = 0;

  try {
    for (const student of students) {
      if (await ctx.isCancellationRequested()) return { cancelled: true, processed, failed };
      try {
        const pdf = await generateStudentHallTicketPdf(ctx.institutionId, actor, examSessionId, student.studentId);
        await zipAppend(zipPath, entries, pdf.filename, pdf.buffer);
        processed += 1;
      } catch (error) {
        failed += 1;
        await recordAuditLog({
          institutionId: ctx.institutionId, userId: ctx.createdById,
          action: "exam.admit_card_generation_item_failed", entityType: "ExamSession", entityId: examSessionId,
          metadata: { studentId: student.studentId, error: error instanceof Error ? error.message : String(error) },
        });
      }
      if (!await ctx.progress(processed, failed, students.length)) return { cancelled: true, processed, failed };
    }
    if (!entries.length) throw new AppError("No hall tickets could be generated.", 422);
    await finishZip(zipPath, entries);
    const filename = "ACADLYX_" + examSessionId + "_AdmitCards.zip";
    const stored = await storeFileFromPath({
      institutionId: ctx.institutionId, module: "examinations", path: zipPath, filename,
      mimeType: "application/zip", ownerId: ctx.createdById, referenceId: ctx.jobId,
      visibility: "private", resourceType: "raw",
    });
    await recordAuditLog({
      institutionId: ctx.institutionId, userId: ctx.createdById, action: "exam.admit_cards_generated",
      entityType: "BackgroundJob", entityId: ctx.jobId,
      metadata: { examSessionId, processed, failed, fileId: stored.id },
    });
    return { fileId: stored.id, filename, processed, failed };
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => undefined);
  }
}

export async function getAdmitCardGenerationJob(institutionId: string, actor: AuthenticatedUser, id: string) {
  assertExaminationController(actor);
  return getJob(institutionId, actor, id);
}
export async function cancelAdmitCardGenerationJob(institutionId: string, actor: AuthenticatedUser, id: string) {
  assertExaminationController(actor);
  const job = await getJob(institutionId, actor, id);
  if (job.type !== JOB_TYPES.ADMIT_CARD_GENERATION) throw new AppError("This is not an admit-card generation job.", 400);
  return requestCancellation(institutionId, actor, id);
}
