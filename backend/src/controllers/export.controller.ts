import { Request, Response } from "express";
import { randomUUID } from "crypto";

import { asyncHandler } from "../utils/asyncHandler";
import { requireInstitution } from "../utils/requireInstitution";
import { AppError } from "../middleware/errorHandler";
import * as exporter from "../services/export.service";
import { recordAuditLog } from "../services/audit.service";
import * as attendanceReport from "../services/attendanceReport.service";
import { enqueueJob, getOwnedJob, requestCancellation } from "../services/backgroundJob.service";
import { JOB_TYPES } from "../jobs/types";
import { getFileDelivery } from "../services/fileStorage.service";
import { exportJobSchema } from "../validators/export.validators";
import { attendanceReportQuery } from "../validators/attendanceReport.validators";

export const exportData = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) {
    throw new AppError("Authentication required", 401);
  }

  const type = String(req.params.type) as exporter.ExportType;
  const format = String(req.query.format || "xlsx").toLowerCase() as exporter.ExportFormat;
  const readText = (key: string): string | undefined => {
    const value = req.query[key];
    if (value === undefined) return undefined;
    if (typeof value !== "string") throw new AppError("Invalid export option: " + key, 400);
    return value;
  };
  const readInt = (key: string): number | undefined => {
    const value = readText(key);
    if (value === undefined) return undefined;
    const parsed = Number(value);
    if (!Number.isSafeInteger(parsed)) throw new AppError("Invalid integer export option: " + key, 400);
    return parsed;
  };
  const rawIds = req.query.ids;
  let ids: string[] | undefined;
  if (rawIds !== undefined) {
    if (typeof rawIds === "string") ids = rawIds.split(",").filter(Boolean);
    else if (Array.isArray(rawIds) && rawIds.every((value) => typeof value === "string")) ids = rawIds as string[];
    else throw new AppError("Invalid selected row IDs", 400);
  }
  const filters: Record<string, string> = {};
  for (const [key, value] of Object.entries(req.query)) {
    if (!key.startsWith("filter_")) continue;
    if (typeof value !== "string") throw new AppError("Invalid export filter: " + key.slice(7), 400);
    filters[key.slice(7)] = value;
  }
  const options: exporter.ExportRequestOptions = {
    selection: (readText("selection") || "all-filtered") as exporter.ExportRequestOptions["selection"],
    ids,
    page: readInt("page"),
    pageSize: readInt("pageSize"),
    filters,
  };
  const file = await exporter.exportData(
    requireInstitution(req),
    req.user,
    type,
    format,
    options,
  );

  await recordAuditLog({
    institutionId: requireInstitution(req),
    userId: req.user.id,
    action: "DATA_EXPORT",
    entityType: type,
    metadata: {
      format,
      rowCount: file.rowCount,
      selection: options.selection || "all-filtered",
      page: options.page ?? null,
      pageSize: options.pageSize ?? null,
      selectedCount: options.ids?.length ?? 0,
      filterKeys: Object.keys(options.filters || {}),
    },
    ipAddress: req.ip,
    userAgent: req.get("user-agent") || undefined,
  });

  res.setHeader("Content-Type", file.contentType);
  res.setHeader("Content-Disposition", `attachment; filename="${file.filename}"`);
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Length", String(file.buffer.length));
  res.setHeader("X-Acadlyx-Export-Rows", String(file.rowCount));
  res.send(file.buffer);
});

export const enqueueExportJob = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new AppError("Authentication required", 401);
  const type = String(req.params.type) as exporter.ExportType;
  if (!exporter.EXPORT_TYPES.includes(type)) throw new AppError("Unsupported export type: " + type, 400);
  const parsed = exportJobSchema.safeParse(req.body);
  if (!parsed.success) throw new AppError(parsed.error.issues[0]?.message || "Invalid export job options", 400);
  const institutionId = requireInstitution(req);
  const { format, selection, ids, page, pageSize, filters } = parsed.data;
  const job = await enqueueJob({
    institutionId,
    type: JOB_TYPES.BULK_EXPORT,
    payload: { exportType: type, format, options: { selection, ...(ids ? { ids } : {}), ...(page ? { page } : {}), ...(pageSize ? { pageSize } : {}), ...(filters ? { filters } : {}) } },
    createdById: req.user.id,
    priority: 80,
    maxAttempts: 3,
    idempotencyKey: "BULK_EXPORT:" + req.user.id + ":" + randomUUID(),
  });
  await recordAuditLog({
    institutionId, userId: req.user.id, action: "DATA_EXPORT_QUEUED", entityType: type,
    entityId: job.id, metadata: { format, selection, page: page ?? null, pageSize: pageSize ?? null, selectedCount: ids?.length ?? 0, filterKeys: Object.keys(filters || {}) },
    ipAddress: req.ip, userAgent: req.get("user-agent") || undefined,
  });
  res.status(202).json({ success: true, data: { jobId: job.id, status: job.status, type, format } });
});

export const getExportJob = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new AppError("Authentication required", 401);
  const job = await getOwnedJob(requireInstitution(req), req.user, req.params.id);
  if (job.type !== JOB_TYPES.BULK_EXPORT) throw new AppError("Export job not found", 404);
  res.setHeader("Cache-Control", "no-store");
  res.status(200).json({ success: true, data: job });
});

export const cancelExportJob = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new AppError("Authentication required", 401);
  const institutionId = requireInstitution(req);
  const job = await getOwnedJob(institutionId, req.user, req.params.id);
  if (job.type !== JOB_TYPES.BULK_EXPORT) throw new AppError("Export job not found", 404);
  const updated = await requestCancellation(institutionId, req.user, req.params.id);
  res.status(200).json({ success: true, data: updated });
});

export const downloadExportJob = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new AppError("Authentication required", 401);
  const institutionId = requireInstitution(req);
  const job = await getOwnedJob(institutionId, req.user, req.params.id);
  if (job.type !== JOB_TYPES.BULK_EXPORT) throw new AppError("Export job not found", 404);
  if (job.status !== "COMPLETED") throw new AppError("Export file is not ready. Current status: " + job.status, 409);
  const result = job.result && typeof job.result === "object" && !Array.isArray(job.result) ? job.result as Record<string, unknown> : {};
  const exportType = typeof result.type === "string" ? result.type as exporter.ExportType : null;
  if (!exportType || !exporter.EXPORT_TYPES.includes(exportType)) throw new AppError("Export job result has an invalid dataset type", 500);
  await exporter.assertExportAccess(institutionId, req.user, exportType);
  const fileId = typeof result.fileId === "string" ? result.fileId : "";
  const filename = typeof result.filename === "string" ? result.filename.replaceAll("\\\"","").replaceAll(String.fromCharCode(13),"").replaceAll(String.fromCharCode(10),"") : "acadlyx-export";
  if (!fileId) throw new AppError("Completed export does not contain a file artifact", 500);
  const delivery = await getFileDelivery(fileId, institutionId, true);
  const storedResponse = await fetch(delivery.url);
  if (!storedResponse.ok) throw new AppError("The generated export artifact could not be retrieved", 502);
  const buffer = Buffer.from(await storedResponse.arrayBuffer());
  res.setHeader("Content-Type", delivery.file.mimeType || "application/octet-stream");
  res.setHeader("Content-Disposition", 'attachment; filename="' + filename + '"');
  res.setHeader("Content-Length", String(buffer.length));
  res.setHeader("Cache-Control", "private, no-store");
  res.setHeader("X-Acadlyx-Export-Rows", String(typeof result.rowCount === "number" ? result.rowCount : 0));
  res.status(200).send(buffer);
});

export const attendanceOptions = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) {
    throw new AppError("Authentication required", 401);
  }

  const data = await attendanceReport.getAttendanceReportOptions(
    requireInstitution(req),
    req.user,
  );

  res.setHeader("Cache-Control", "no-store");
  res.status(200).json({ success: true, data });
});

export const attendanceExport = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) {
    throw new AppError("Authentication required", 401);
  }

  const parsed = attendanceReportQuery.safeParse(req.query);
  if (!parsed.success) {
    throw new AppError(
      parsed.error.issues[0]?.message || "Invalid attendance export filters",
      400,
    );
  }

  const file = await attendanceReport.exportAttendance(
    requireInstitution(req),
    req.user,
    parsed.data,
  );

  res.setHeader("Content-Type", file.contentType);
  res.setHeader("Content-Disposition", `attachment; filename="${file.filename}"`);
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Acadlyx-Export-Rows", String(file.rowCount));
  res.send(file.buffer);
});
